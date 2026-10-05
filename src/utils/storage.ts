import { NoteItem } from '../types';

const DB_NAME = 'NoteStorageDB';
const DB_VERSION = 2;
const NOTES_STORE = 'notes';
const ATTACHMENTS_STORE = 'attachments';

const lastSavedUpdated = new Map<string, number>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;

      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
      }

      let attachmentsStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
        attachmentsStore = db.createObjectStore(ATTACHMENTS_STORE, { keyPath: 'noteId' });
      } else {
        attachmentsStore = tx!.objectStore(ATTACHMENTS_STORE);
      }

      // Migrate old v1 notes: move heavy PDF/image payloads out of the note record.
      if (tx && db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = tx.objectStore(NOTES_STORE);
        notesStore.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
          if (!cursor) return;

          const oldNote = cursor.value as NoteItem;
          const hasPdf = Boolean(oldNote.pdfData);
          const hasFile = Boolean(oldNote.fileDataUrl);

          if (hasPdf || hasFile) {
            const attachment = {
              noteId: oldNote.id,
              ...(hasPdf ? { pdfData: oldNote.pdfData } : {}),
              ...(hasFile ? { fileDataUrl: oldNote.fileDataUrl } : {}),
            };

            const { pdfData: _pdfData, fileDataUrl: _fileDataUrl, ...metadata } = oldNote;
            attachmentsStore.put(attachment);
            cursor.update(metadata);
          }

          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

type StoredNote = Omit<NoteItem, 'pdfData' | 'fileDataUrl'>;

type StoredAttachment = {
  noteId: string;
  pdfData?: NoteItem['pdfData'];
  fileDataUrl?: string;
};

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function splitNote(note: NoteItem): { metadata: StoredNote; attachment: StoredAttachment | null; attachmentExplicitlyChanged: boolean } {
  const pdfFieldPresent = hasOwn(note, 'pdfData');
  const fileFieldPresent = hasOwn(note, 'fileDataUrl');
  const { pdfData, fileDataUrl, ...metadata } = note;

  const hasAttachment = Boolean(pdfData || fileDataUrl);
  const attachmentExplicitlyChanged = pdfFieldPresent || fileFieldPresent;

  return {
    metadata,
    attachment: hasAttachment
      ? { noteId: note.id, pdfData, fileDataUrl }
      : null,
    attachmentExplicitlyChanged,
  };
}

function saveToLocalFallback(notes: NoteItem[]) {
  try {
    const lightweight = notes.map((note) => splitNote(note).metadata);
    localStorage.setItem('ns_notes_meta', JSON.stringify(lightweight));
  } catch {
    // IndexedDB remains the primary store.
  }
}

export async function saveNoteToStorage(note: NoteItem): Promise<void> {
  try {
    const db = await openDb();
    const { metadata, attachment, attachmentExplicitlyChanged } = splitNote(note);
    const tx = db.transaction([NOTES_STORE, ATTACHMENTS_STORE], 'readwrite');

    tx.objectStore(NOTES_STORE).put(metadata);

    if (attachment) {
      tx.objectStore(ATTACHMENTS_STORE).put(attachment);
    } else if (attachmentExplicitlyChanged) {
      // Only delete an attachment when the note explicitly changed the attachment field.
      // Metadata-only loads must not accidentally delete lazily stored PDFs/images.
      tx.objectStore(ATTACHMENTS_STORE).delete(note.id);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });

    lastSavedUpdated.set(note.id, note.updated);
  } catch (err) {
    console.warn('IndexedDB note write failed:', err);
    try {
      const saved = localStorage.getItem('ns_notes_meta');
      const existing: StoredNote[] = saved ? JSON.parse(saved) : [];
      const { metadata } = splitNote(note);
      const next = existing.filter((n) => n.id !== note.id);
      next.push(metadata);
      localStorage.setItem('ns_notes_meta', JSON.stringify(next));
    } catch {
      // Ignore quota errors.
    }
  }
}

export async function deleteNoteFromStorage(noteId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([NOTES_STORE, ATTACHMENTS_STORE], 'readwrite');
    tx.objectStore(NOTES_STORE).delete(noteId);
    tx.objectStore(ATTACHMENTS_STORE).delete(noteId);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });

    lastSavedUpdated.delete(noteId);
  } catch (err) {
    console.warn('IndexedDB note delete failed:', err);
  }
}

export async function loadNoteFromStorage(noteId: string): Promise<NoteItem | null> {
  try {
    const db = await openDb();
    const tx = db.transaction([NOTES_STORE, ATTACHMENTS_STORE], 'readonly');

    const metadata = await new Promise<StoredNote | undefined>((resolve, reject) => {
      const req = tx.objectStore(NOTES_STORE).get(noteId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!metadata) return null;

    const attachment = await new Promise<StoredAttachment | undefined>((resolve, reject) => {
      const req = tx.objectStore(ATTACHMENTS_STORE).get(noteId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return {
      ...metadata,
      ...(attachment?.pdfData ? { pdfData: attachment.pdfData } : {}),
      ...(attachment?.fileDataUrl ? { fileDataUrl: attachment.fileDataUrl } : {}),
    } as NoteItem;
  } catch (err) {
    console.warn('IndexedDB note read failed:', err);
    return null;
  }
}

/** Loads lightweight note records only. Heavy attachments are not loaded here. */
export async function loadNotesFromStorage(): Promise<NoteItem[] | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(NOTES_STORE, 'readonly');
    const store = tx.objectStore(NOTES_STORE);

    const notes: StoredNote[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (notes.length > 0) return notes as NoteItem[];
  } catch (err) {
    console.warn('IndexedDB metadata read failed, checking localStorage:', err);
  }

  try {
    const saved = localStorage.getItem('ns_notes_meta');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as NoteItem[];
    }
  } catch {
    // Ignore malformed or unavailable fallback data.
  }

  return null;
}

/** Incremental compatibility save. It no longer clears and rewrites the entire database. */
export async function saveNotesToStorage(notes: NoteItem[]): Promise<void> {
  saveToLocalFallback(notes);

  const changedNotes = notes.filter(
    (note) => lastSavedUpdated.get(note.id) !== note.updated
  );
  const notesToSave = lastSavedUpdated.size === 0 ? notes : changedNotes;

  await Promise.all(notesToSave.map((note) => saveNoteToStorage(note)));

  try {
    const db = await openDb();
    const tx = db.transaction([NOTES_STORE, ATTACHMENTS_STORE], 'readwrite');
    const store = tx.objectStore(NOTES_STORE);
    const existingIds: string[] = await new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result || []) as string[]);
      req.onerror = () => reject(req.error);
    });

    const activeIds = new Set(notes.map((note) => note.id));
    for (const id of existingIds) {
      if (!activeIds.has(id)) {
        store.delete(id);
        tx.objectStore(ATTACHMENTS_STORE).delete(id);
        lastSavedUpdated.delete(id);
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB cleanup aborted'));
    });
  } catch (err) {
    console.warn('IndexedDB cleanup failed:', err);
  }
}


/**
 * Read the complete IndexedDB contents without modifying or deleting anything.
 * Intended for recovery/backup tools.
 */
export async function exportStorageSnapshot(): Promise<{
  database: string;
  version: number;
  notes: StoredNote[];
  attachments: StoredAttachment[];
  exportedAt: string;
}> {
  const db = await openDb();

  const readAll = <T,>(storeName: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result || []) as T[]);
      request.onerror = () => reject(request.error);
    });

  try {
    const [notes, attachments] = await Promise.all([
      readAll<StoredNote>(NOTES_STORE),
      readAll<StoredAttachment>(ATTACHMENTS_STORE),
    ]);

    return {
      database: DB_NAME,
      version: db.version,
      notes,
      attachments,
      exportedAt: new Date().toISOString(),
    };
  } finally {
    db.close();
  }
}


/**
 * Restore a recovery snapshot by merging its records into IndexedDB.
 * Existing records with the same IDs are replaced; unrelated records are preserved.
 * This never performs the destructive cleanup used by saveNotesToStorage.
 */
export async function restoreStorageSnapshot(snapshot: {
  notes: StoredNote[];
  attachments?: StoredAttachment[];
}): Promise<number> {
  const db = await openDb();
  const tx = db.transaction([NOTES_STORE, ATTACHMENTS_STORE], 'readwrite');

  for (const note of snapshot.notes || []) {
    tx.objectStore(NOTES_STORE).put(note);
  }

  for (const attachment of snapshot.attachments || []) {
    tx.objectStore(ATTACHMENTS_STORE).put(attachment);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Recovery restore transaction aborted'));
  });

  db.close();
  return (snapshot.notes || []).length;
}

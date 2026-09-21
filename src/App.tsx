import { useState, useEffect, useRef, useMemo } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { NavPage, NoteItem, DrawingTool, EraserType, DrawingStroke, AppSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { NotesHeader } from './components/NotesHeader';
import { SubjectTopicBar } from './components/SubjectTopicBar';
import { SubjectTopicSidebar } from './components/SubjectTopicSidebar';
import { FormattingToolbar } from './components/FormattingToolbar';
import { DrawingToolbar } from './components/DrawingToolbar';
import { NoteCanvas } from './components/NoteCanvas';
import { DashboardView } from './components/DashboardView';
import { SubjectsView } from './components/SubjectsView';
import { RecentView } from './components/RecentView';
import { FavoritesView } from './components/FavoritesView';
import { SettingsView } from './components/SettingsView';
import { ExportModal } from './components/ExportModal';
import { ConfirmModal } from './components/ConfirmModal';
import { TopicCanvas } from './components/TopicCanvas';
import { StudyTimer } from './components/StudyTimer';
import { StudyTimerProvider } from './context/StudyTimerContext';
import { GoalsProvider } from './context/GoalsContext';
import { GoalsView } from './components/GoalsView';
import { StaticHeaderTimer } from './components/StaticHeaderTimer';
import { renderPdfPages } from './utils/pdfLoader';
import { saveNotesToStorage, loadNotesFromStorage, loadNoteFromStorage } from './utils/storage';
import { loadBrandingSettings, DEFAULT_THUNDER_CHARACTER } from './components/BrandingSettings';

const INITIAL_NOTE: NoteItem = {
  id: 'note_1',
  title: 'lets go',
  subject: 'dbms',
  topic: 'Week 6',
  content: '<p><br></p>',
  textBoxes: [
    {
      id: 'box_1',
      x: 36,
      y: 28,
      width: 760,
      content: '<p><br></p>',
    },
  ],
  paperStyle: 'ruled',
  strokes: [],
  created: Date.now() - 3600000,
  updated: Date.now(),
  favorite: false,
  type: 'written',
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  compact: false,
  animations: true,
  defaultView: 'grid',
  defaultSort: 'recent',
  defaultPaperStyle: 'ruled',
  editorFont: 'sans',
  rememberLastSubject: true,
  defaultSubject: 'dbms',
  confirmDelete: true,
  lastSubject: 'dbms',
};

export default function App() {
  // Navigation
  const [currentPage, setCurrentPage] = useState<NavPage>('notes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedSubjectForTopics, setSelectedSubjectForTopics] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('ns_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [mobileMascotSrc, setMobileMascotSrc] = useState<string>(() => {
    return loadBrandingSettings().dataUrl || DEFAULT_THUNDER_CHARACTER;
  });

  useEffect(() => {
    const handleBranding = () => {
      setMobileMascotSrc(loadBrandingSettings().dataUrl || DEFAULT_THUNDER_CHARACTER);
    };
    window.addEventListener('ns-branding-updated', handleBranding);
    return () => window.removeEventListener('ns-branding-updated', handleBranding);
  }, []);

  // Notes state
  // Keep only lightweight note metadata/content in React state. Heavy attachments are loaded on demand.
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    return [
      INITIAL_NOTE,
      {
        id: 'note_2',
        title: 'Relational Algebra & Normalization',
        subject: 'dbms',
        topic: 'Week 5',
        content: '<h2>Relational Algebra Basics</h2><p>Selection, Projection, Cartesian Product, Union, Set Difference.</p>',
        strokes: [],
        created: Date.now() - 86400000,
        updated: Date.now() - 86400000,
        favorite: true,
        type: 'written',
      },
      {
        id: 'note_3',
        title: 'Concurrency Control & ACID',
        subject: 'dbms',
        topic: 'Week 7',
        content: '<h2>ACID Properties</h2><ul><li><b>Atomicity</b></li><li><b>Consistency</b></li><li><b>Isolation</b></li><li><b>Durability</b></li></ul>',
        strokes: [],
        created: Date.now() - 172800000,
        updated: Date.now() - 172800000,
        favorite: false,
        type: 'written',
      },
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(INITIAL_NOTE.id);
  const [activeTopicCanvas, setActiveTopicCanvas] = useState<{ subject: string; topic: string } | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSubjectTopicSidebarOpen, setIsSubjectTopicSidebarOpen] = useState<boolean>(true);

  // Debounce ref for isSaved status to prevent rapid flickering
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markSavedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom subjects list persisted in storage
  const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ns_custom_subjects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ns_custom_subjects', JSON.stringify(customSubjects));
    } catch {
      // ignore
    }
  }, [customSubjects]);

  // Custom subjects drag order persisted in storage
  const [subjectsOrder, setSubjectsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ns_subjects_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Deleted subjects blacklist to allow deleting default/hardcoded subjects
  const [deletedSubjects, setDeletedSubjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ns_deleted_subjects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ns_deleted_subjects', JSON.stringify(deletedSubjects));
    } catch {
      // ignore
    }
  }, [deletedSubjects]);

  const handleUpdateSubjectsOrder = (newOrder: string[]) => {
    setSubjectsOrder(newOrder);
    try {
      localStorage.setItem('ns_subjects_order', JSON.stringify(newOrder));
    } catch {
      // ignore
    }
  };

  // Drawing state
  const [isDrawingToolbarOpen, setIsDrawingToolbarOpen] = useState<boolean>(true);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [eraserType, setEraserType] = useState<EraserType>('stroke-eraser');
  const [thickness, setThickness] = useState<number>(4);
  const [color, setColor] = useState<string>('#111111');

  // Drawing Undo/Redo stacks for active note
  const undoStackRef = useRef<DrawingStroke[][]>([]);
  const redoStackRef = useRef<DrawingStroke[][]>([]);
  const [, setStackTick] = useState(0);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0] || INITIAL_NOTE;

  // Load lightweight note metadata only on startup. Attachments are intentionally not loaded here.
  useEffect(() => {
    loadNotesFromStorage().then((saved) => {
      if (saved && saved.length > 0) {
        setNotes(saved);
        setActiveNoteId((currentId) => saved.some((n) => n.id === currentId) ? currentId : saved[0].id);
      }
    });
  }, []);

  // Load heavy PDF/image data only when the selected note changes.
  useEffect(() => {
    let cancelled = false;

    loadNoteFromStorage(activeNote.id).then((fullNote) => {
      if (cancelled || !fullNote) return;

      const hasAttachment = Boolean(fullNote.pdfData || fullNote.fileDataUrl);
      if (!hasAttachment) return;

      setNotes((prev) =>
        prev.map((note) =>
          note.id === fullNote.id
            ? {
                ...note,
                pdfData: fullNote.pdfData,
                fileDataUrl: fullNote.fileDataUrl,
              }
            : note
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, [activeNote.id]);

  // Persist notes using incremental IndexedDB writes.
  useEffect(() => {
    saveNotesToStorage(notes);
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem('ns_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Sync darkMode with settings.theme (handling system preference)
  useEffect(() => {
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(mq.matches);
      const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      setDarkMode(settings.theme === 'dark');
    }
  }, [settings.theme]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    setSettings((prev) => ({ ...prev, theme: next ? 'dark' : 'light' }));
  };

  // Update active note with smooth debounced saved indicator
  const updateActiveNote = (updates: Partial<NoteItem>) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === activeNote.id
          ? { ...n, ...updates, updated: Date.now() }
          : n
      )
    );

    if (markSavedTimerRef.current) {
      clearTimeout(markSavedTimerRef.current);
    }

    if (!saveDebounceTimerRef.current) {
      saveDebounceTimerRef.current = setTimeout(() => {
        setIsSaved(false);
      }, 500);
    }

    markSavedTimerRef.current = setTimeout(() => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
      }
      setIsSaved(true);
    }, 1200);
  };

  // Rename any note by id
  const handleRenameNote = (noteId: string, newTitle: string) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === noteId
          ? { ...n, title: newTitle.trim() || 'Untitled note', updated: Date.now() }
          : n
      )
    );
  };

  // Note creation
  const handleCreateNote = (presetSubject?: string, presetTopic?: string) => {
    const subject =
      presetSubject ||
      (settings.rememberLastSubject ? settings.lastSubject : settings.defaultSubject || 'dbms');
    const topic = presetTopic || 'Week 6';
    const noteId = `note_${Date.now()}`;
    const newNote: NoteItem = {
      id: noteId,
      title: 'Untitled note',
      subject,
      topic,
      content: '<p><br></p>',
      textBoxes: [
        {
          id: `box_${Date.now()}`,
          x: 36,
          y: 28,
          width: 760,
          content: '<p><br></p>',
        },
      ],
      paperStyle: settings.defaultPaperStyle || 'ruled',
      strokes: [],
      created: Date.now(),
      updated: Date.now(),
      favorite: false,
      type: 'written',
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setCurrentPage('notes');
    undoStackRef.current = [];
    redoStackRef.current = [];
  };

  // Add a brand-new subject with initial note
  const handleAddSubject = (subjectName: string, initialTopic: string = 'Introduction', openEditor: boolean = false) => {
    const trimmed = subjectName.trim();
    if (!trimmed) return;

    setDeletedSubjects((prev) => prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()));
    if (!customSubjects.includes(trimmed)) {
      setCustomSubjects((prev) => [...prev, trimmed]);
    }

    const noteId = `note_${Date.now()}`;
    const newNote: NoteItem = {
      id: noteId,
      title: `Intro to ${trimmed}`,
      subject: trimmed,
      topic: initialTopic.trim() || 'Introduction',
      content: '<p><br></p>',
      textBoxes: [
        {
          id: `box_${Date.now()}`,
          x: 36,
          y: 28,
          width: 760,
          content: '<p><br></p>',
        },
      ],
      paperStyle: 'ruled',
      strokes: [],
      created: Date.now(),
      updated: Date.now(),
      favorite: false,
      type: 'written',
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setSettings((s) => ({ ...s, lastSubject: trimmed }));
    undoStackRef.current = [];
    redoStackRef.current = [];

    if (openEditor) {
      setCurrentPage('notes');
    } else {
      setSelectedSubjectForTopics(trimmed);
      setCurrentPage('subjects');
    }
  };

  // In-app confirmation modal state (replaces window.confirm which fails in sandboxed iframes)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Note deletion by ID
  const handleDeleteNoteById = (noteId: string) => {
    const remaining = notes.filter((n) => n.id !== noteId);
    if (remaining.length === 0) {
      const fallback = { ...INITIAL_NOTE, id: `note_${Date.now()}`, title: 'New note' };
      setNotes([fallback]);
      setActiveNoteId(fallback.id);
    } else {
      setNotes(remaining);
      if (activeNoteId === noteId) {
        setActiveNoteId(remaining[0].id);
      }
    }
    closeConfirmModal();
  };

  const executeDeleteActiveNote = () => {
    handleDeleteNoteById(activeNote.id);
  };

  // Delete Topic under a Subject
  const handleDeleteTopic = (subjectName: string, topicName: string) => {
    const remainingNotes = notes.filter(
      (n) =>
        !(
          (n.subject || '').toLowerCase() === subjectName.toLowerCase() &&
          (n.topic || '').toLowerCase() === topicName.toLowerCase()
        )
    );
    if (remainingNotes.length === 0) {
      const fallback = {
        ...INITIAL_NOTE,
        id: `note_${Date.now()}`,
        title: 'New note',
        subject: subjectName,
        topic: 'General',
      };
      setNotes([fallback]);
      setActiveNoteId(fallback.id);
    } else {
      setNotes(remainingNotes);
      if (
        (activeNote.subject || '').toLowerCase() === subjectName.toLowerCase() &&
        (activeNote.topic || '').toLowerCase() === topicName.toLowerCase()
      ) {
        const sameSubjectNote = remainingNotes.find(
          (n) => (n.subject || '').toLowerCase() === subjectName.toLowerCase()
        );
        setActiveNoteId(sameSubjectNote ? sameSubjectNote.id : remainingNotes[0].id);
      }
    }
    if (
      activeTopicCanvas?.subject?.toLowerCase() === subjectName.toLowerCase() &&
      activeTopicCanvas?.topic?.toLowerCase() === topicName.toLowerCase()
    ) {
      setActiveTopicCanvas(null);
    }
  };

  // Delete entire Subject
  const handleDeleteSubject = (subjectName: string) => {
    const remainingNotes = notes.filter(
      (n) => (n.subject || '').toLowerCase() !== subjectName.toLowerCase()
    );
    if (remainingNotes.length === 0) {
      const fallback = {
        ...INITIAL_NOTE,
        id: `note_${Date.now()}`,
        title: 'New note',
        subject: 'General',
        topic: 'General',
      };
      setNotes([fallback]);
      setActiveNoteId(fallback.id);
    } else {
      setNotes(remainingNotes);
      if ((activeNote.subject || '').toLowerCase() === subjectName.toLowerCase()) {
        setActiveNoteId(remainingNotes[0].id);
      }
    }
    setCustomSubjects((prev) => prev.filter((s) => s.toLowerCase() !== subjectName.toLowerCase()));
    setDeletedSubjects((prev) => {
      if (!prev.some((s) => s.toLowerCase() === subjectName.toLowerCase())) {
        return [...prev, subjectName];
      }
      return prev;
    });
    setSubjectsOrder((prev) => prev.filter((s) => s.toLowerCase() !== subjectName.toLowerCase()));
    if (activeTopicCanvas?.subject?.toLowerCase() === subjectName.toLowerCase()) {
      setActiveTopicCanvas(null);
    }
  };

  const handleDeleteActiveNote = () => {
    if (settings.confirmDelete) {
      setConfirmModal({
        isOpen: true,
        title: 'Delete Note',
        message: `Are you sure you want to permanently delete "${activeNote.title || 'Untitled note'}"? This action cannot be undone.`,
        confirmLabel: 'Delete Note',
        confirmVariant: 'danger',
        onConfirm: executeDeleteActiveNote,
      });
    } else {
      executeDeleteActiveNote();
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, favorite: !n.favorite } : n))
    );
  };

  const handleDeleteCustomSubject = (subj: string) => {
    setCustomSubjects((prev) => prev.filter((s) => s !== subj));
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem('ns_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // ignore
    }
  };

  const handleResetDemoNotes = () => {
    const demo: NoteItem[] = [
      INITIAL_NOTE,
      {
        id: 'note_2',
        title: 'Relational Algebra & Normalization',
        subject: 'dbms',
        topic: 'Week 5',
        content: '<h2>Relational Algebra Basics</h2><p>Selection, Projection, Cartesian Product, Union, Set Difference.</p>',
        strokes: [],
        created: Date.now() - 86400000,
        updated: Date.now() - 86400000,
        favorite: true,
        type: 'written',
      },
      {
        id: 'note_3',
        title: 'Concurrency Control & ACID',
        subject: 'dbms',
        topic: 'Week 7',
        content: '<h2>ACID Properties</h2><ul><li><b>Atomicity</b></li><li><b>Consistency</b></li><li><b>Isolation</b></li><li><b>Durability</b></li></ul>',
        strokes: [],
        created: Date.now() - 172800000,
        updated: Date.now() - 172800000,
        favorite: false,
        type: 'written',
      },
    ];
    setNotes(demo);
    setActiveNoteId(demo[0].id);
    saveNotesToStorage(demo);
  };

  const handleImportNotes = (importedNotes: NoteItem[]) => {
    if (importedNotes.length > 0) {
      setNotes(importedNotes);
      setActiveNoteId(importedNotes[0].id);
      saveNotesToStorage(importedNotes);
    }
  };

  // Drawing strokes handling with undo/redo
  const handleStrokesChange = (newStrokes: DrawingStroke[]) => {
    undoStackRef.current.push([...activeNote.strokes]);
    redoStackRef.current = [];
    setStackTick((t) => t + 1);
    updateActiveNote({ strokes: newStrokes });
  };

  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push([...activeNote.strokes]);
    setStackTick((t) => t + 1);
    updateActiveNote({ strokes: previous });
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push([...activeNote.strokes]);
    setStackTick((t) => t + 1);
    updateActiveNote({ strokes: next });
  };

  const executeClearDrawing = () => {
    undoStackRef.current.push([...activeNote.strokes]);
    redoStackRef.current = [];
    setStackTick((t) => t + 1);
    updateActiveNote({ strokes: [] });
    closeConfirmModal();
  };

  const handleClearDrawing = () => {
    if (activeNote.strokes.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Clear Ink Drawing',
      message: 'Are you sure you want to clear all hand-drawn strokes on this note?',
      confirmLabel: 'Clear Ink',
      confirmVariant: 'danger',
      onConfirm: executeClearDrawing,
    });
  };

  // Track last active editor and user selection for resilient formatting (e.g. color picking)
  const lastActiveEditorRef = useRef<HTMLElement | null>(null);
  const savedSelectionRangeRef = useRef<Range | null>(null);
  const [activeFontFamily, setActiveFontFamily] = useState<string>('Plus Jakarta Sans');
  const [activeFontSize, setActiveFontSize] = useState<string>('16px');

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentNode;
      }
      if (container instanceof HTMLElement) {
        const editor =
          container.closest('.onenote-text-editor') ||
          container.closest('#note-editor-content');
        if (editor) {
          lastActiveEditorRef.current = editor as HTMLElement;
          savedSelectionRangeRef.current = range.cloneRange();

          try {
            const comp = window.getComputedStyle(container);
            if (comp.fontFamily) {
              setActiveFontFamily(comp.fontFamily);
            }
            if (comp.fontSize) {
              setActiveFontSize(comp.fontSize);
            }
          } catch {
            // ignore
          }
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Active editor finder for OneNote text boxes
  const getActiveEditor = (): HTMLElement | null => {
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.classList.contains('onenote-text-editor') ||
        activeEl.id === 'note-editor-content')
    ) {
      return activeEl as HTMLElement;
    }
    const parentEditor = activeEl?.closest('.onenote-text-editor') as HTMLElement;
    if (parentEditor) return parentEditor;

    if (lastActiveEditorRef.current && document.body.contains(lastActiveEditorRef.current)) {
      return lastActiveEditorRef.current;
    }

    const all = document.querySelectorAll('.onenote-text-editor');
    if (all.length > 0) return all[0] as HTMLElement;
    return document.getElementById('note-editor-content');
  };

  const syncEditorChanges = () => {
    const editor = getActiveEditor();
    if (!editor) return;
    const boxId = editor.getAttribute('data-box-id');
    if (boxId && activeNote.textBoxes && activeNote.textBoxes.length > 0) {
      const updated = activeNote.textBoxes.map((b) =>
        b.id === boxId ? { ...b, content: editor.innerHTML } : b
      );
      updateActiveNote({
        textBoxes: updated,
        content: updated.map((b) => b.content).join('<hr/>'),
      });
    } else {
      updateActiveNote({ content: editor.innerHTML });
    }
  };

  // Formatting commands for rich text
  const handleFormat = (command: string, value?: string) => {
    const editor = getActiveEditor();
    if (editor) {
      editor.focus();
      const sel = window.getSelection();
      if (savedSelectionRangeRef.current && sel) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRangeRef.current);
        } catch {
          // ignore
        }
      }
    }

    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      // ignore
    }

    if (command === 'fontName' && value) {
      setActiveFontFamily(value);
      const sel = window.getSelection();
      const hasSelection = sel && !sel.isCollapsed && sel.toString().length > 0;
      if (hasSelection) {
        document.execCommand('fontName', false, value);
      } else if (editor) {
        document.execCommand('fontName', false, value);
        editor.style.fontFamily = value;
        const boxId = editor.getAttribute('data-box-id');
        if (boxId && activeNote.textBoxes) {
          const updated = activeNote.textBoxes.map((b) =>
            b.id === boxId ? { ...b, fontFamily: value } : b
          );
          updateActiveNote({ textBoxes: updated });
        }
      }
    } else if (command === 'fontSize' && value) {
      setActiveFontSize(value);
      const sel = window.getSelection();
      const hasSelection = sel && !sel.isCollapsed && sel.toString().length > 0;
      if (hasSelection && editor) {
        document.execCommand('fontSize', false, '7');
        const fonts = editor.querySelectorAll('font[size="7"]');
        fonts.forEach((f) => {
          f.removeAttribute('size');
          (f as HTMLElement).style.fontSize = value;
        });
        const spans = editor.querySelectorAll('span');
        spans.forEach((s) => {
          if (
            s.style.fontSize === 'xxx-large' ||
            s.style.fontSize === '-webkit-xxx-large' ||
            s.style.fontSize === '48px'
          ) {
            s.style.fontSize = value;
          }
        });
      } else if (editor) {
        editor.style.fontSize = value;
        const boxId = editor.getAttribute('data-box-id');
        if (boxId && activeNote.textBoxes) {
          const updated = activeNote.textBoxes.map((b) =>
            b.id === boxId ? { ...b, fontSize: value } : b
          );
          updateActiveNote({ textBoxes: updated });
        }
      }
    } else if (command === 'foreColor' && (value === 'inherit' || value === 'default')) {
      const defaultColor = darkMode ? '#f4f4f5' : '#111827';
      document.execCommand('foreColor', false, defaultColor);
    } else if (command === 'hiliteColor' && (value === 'transparent' || value === 'none')) {
      try {
        document.execCommand('hiliteColor', false, 'transparent');
      } catch {
        document.execCommand('backColor', false, 'transparent');
      }
    } else if (command === 'hiliteColor') {
      try {
        document.execCommand('hiliteColor', false, value);
      } catch {
        document.execCommand('backColor', false, value);
      }
    } else {
      document.execCommand(command, false, value);
    }
    syncEditorChanges();
  };

  // List style indexing options handler
  const handleApplyListStyle = (
    command: 'insertOrderedList' | 'insertUnorderedList',
    styleType?: string
  ) => {
    const editor = getActiveEditor();
    if (!editor) return;

    editor.focus();

    const targetTag = command === 'insertOrderedList' ? 'OL' : 'UL';
    const sel = window.getSelection();
    let currentList: HTMLElement | null = null;

    if (sel && sel.anchorNode) {
      let curr: Node | null = sel.anchorNode;
      while (curr && curr !== editor && curr !== document.body) {
        if (curr.nodeName === 'OL' || curr.nodeName === 'UL') {
          currentList = curr as HTMLElement;
          break;
        }
        curr = curr.parentNode;
      }
    }

    if (currentList && currentList.tagName === targetTag) {
      if (styleType) {
        currentList.style.listStyleType = styleType;
      } else {
        document.execCommand(command, false);
      }
    } else {
      document.execCommand(command, false);

      const updatedSel = window.getSelection();
      if (updatedSel && updatedSel.anchorNode) {
        let node: Node | null = updatedSel.anchorNode;
        while (node && node !== editor && node !== document.body) {
          if (node.nodeName === 'OL' || node.nodeName === 'UL') {
            if (styleType) {
              (node as HTMLElement).style.listStyleType = styleType;
            }
            break;
          }
          node = node.parentNode;
        }
      }
    }

    syncEditorChanges();
  };

  const handleInsertChecklist = () => {
    const editor = getActiveEditor();
    if (editor) editor.focus();
    const html = `<div class="check-item flex items-center gap-2 my-1.5"><input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer" /><span contenteditable="true" class="outline-none">Checklist item</span></div><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    syncEditorChanges();
  };

  const handleInsertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const editor = getActiveEditor();
      if (editor) editor.focus();
      const dataUrl = reader.result as string;
      const html = `<img src="${dataUrl}" alt="Inserted image" class="note-image max-w-full rounded-xl my-3 cursor-pointer shadow-xs" style="width: 100%; height: auto;" /><p><br></p>`;
      document.execCommand('insertHTML', false, html);
      syncEditorChanges();
    };
    reader.readAsDataURL(file);
  };

  const handlePasteImage = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert('Click inside a note box and press Ctrl+V (or ⌘V) to paste an image.');
        return;
      }
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          found = true;
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => {
            const editor = getActiveEditor();
            if (editor) editor.focus();
            const dataUrl = reader.result as string;
            const html = `<img src="${dataUrl}" alt="Pasted image" class="note-image max-w-full rounded-xl my-3 cursor-pointer shadow-xs" style="width: 100%; height: auto;" /><p><br></p>`;
            document.execCommand('insertHTML', false, html);
            syncEditorChanges();
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
      if (!found) {
        alert('No image found on clipboard. Copy an image first, then click Paste image.');
      }
    } catch {
      alert('Press Ctrl+V (or ⌘V) directly in the note to paste your image.');
    }
  };

  // PDF Handlers
  const handleInsertPdfFile = async (file: File) => {
    try {
      const pdfData = await renderPdfPages(file);
      updateActiveNote({ pdfData });
      setIsSaved(false);
      setTimeout(() => setIsSaved(true), 500);
    } catch (err) {
      console.error('Error rendering PDF:', err);
      alert('Failed to parse PDF file. Please ensure it is a valid PDF document.');
    }
  };

  // Collect unique subjects and topics for pickers
  const allSubjects = useMemo(() => {
    const rawSet = new Set([
      ...notes.map((n) => n.subject).filter(Boolean),
      ...customSubjects,
      'dbms',
    ]);
    deletedSubjects.forEach((del) => {
      rawSet.delete(del);
      Array.from(rawSet).forEach((item) => {
        if (item.toLowerCase() === del.toLowerCase()) {
          rawSet.delete(item);
        }
      });
    });
    const rawList = Array.from(rawSet);

    if (subjectsOrder.length > 0) {
      const ordered: string[] = [];
      subjectsOrder.forEach((name) => {
        if (rawSet.has(name)) {
          ordered.push(name);
          rawSet.delete(name);
        }
      });
      rawList.forEach((name) => {
        if (rawSet.has(name)) {
          ordered.push(name);
          rawSet.delete(name);
        }
      });
      return ordered;
    }
    return rawList.sort();
  }, [notes, customSubjects, subjectsOrder, deletedSubjects]);

  const allTopicsForSubject = Array.from(
    new Set(
      notes
        .filter((n) => n.subject === (activeNote.subject || 'dbms'))
        .map((n) => n.topic)
        .filter(Boolean)
    )
  ).sort();
  if (!allTopicsForSubject.includes('Week 6')) allTopicsForSubject.unshift('Week 6');

  return (
    <GoalsProvider>
      <StudyTimerProvider>
        <div
        data-compact={settings.compact ? 'true' : 'false'}
        className={`flex h-screen w-screen overflow-hidden ${
          darkMode ? 'bg-[#121214] text-zinc-100' : 'bg-[#FAFAFA] text-gray-900'
        } ${!settings.animations ? '[&_*]:!transition-none [&_*]:!animation-none' : ''}`}
      >
      {/* Left Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={(page) => {
          if (page === 'subjects') {
            setSelectedSubjectForTopics(null);
          }
          setCurrentPage(page);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        compact={settings.compact}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile Navigation Header Bar (Shown on small screens < md) */}
        <header
          id="app-mobile-topbar"
          className={`md:hidden flex items-center justify-between px-3.5 py-2.5 border-b flex-shrink-0 z-30 select-none ${
            darkMode ? 'bg-[#18181b] border-zinc-800 text-zinc-100' : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <button
              id="mobile-menu-trigger-btn"
              onClick={() => setIsMobileNavOpen(true)}
              className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${
                darkMode
                  ? 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="flex items-center cursor-pointer transition-transform hover:scale-105"
              onClick={() => {
                setCurrentPage('dashboard');
              }}
              title="Dashboard"
            >
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src={mobileMascotSrc}
                  alt="Character"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Static Study Timer in Mobile Header */}
          <div className="flex items-center justify-center">
            <StaticHeaderTimer darkMode={darkMode} />
          </div>

          <button
            id="mobile-theme-toggle-btn"
            onClick={toggleDarkMode}
            className={`p-2 rounded-xl border transition-colors ${
              darkMode
                ? 'border-zinc-700 text-amber-400 hover:bg-zinc-800'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>
        {currentPage === 'notes' && (
          <div className="flex-1 flex flex-row h-full overflow-hidden min-w-0">
            {/* Subject & Topics Sidebar (Yellow highlighted side) */}
            <SubjectTopicSidebar
              notes={notes}
              activeNote={activeNote}
              allSubjects={allSubjects}
              customSubjects={customSubjects}
              subjectsOrder={subjectsOrder}
              onUpdateSubjectsOrder={handleUpdateSubjectsOrder}
              activeTopicCanvas={activeTopicCanvas}
              onOpenTopicCanvas={(subject, topic) => {
                setActiveTopicCanvas({ subject, topic });
              }}
              onSelectNote={(noteId) => {
                setActiveNoteId(noteId);
                setActiveTopicCanvas(null);
                undoStackRef.current = [];
                redoStackRef.current = [];
              }}
              onCreateNote={(subject, topic) => {
                handleCreateNote(subject, topic);
                setActiveTopicCanvas(null);
              }}
              onAddSubject={(subjectName, initialTopic) => {
                handleAddSubject(subjectName, initialTopic, true);
                setActiveTopicCanvas(null);
              }}
              onDeleteSubject={handleDeleteSubject}
              onDeleteTopic={handleDeleteTopic}
              onDeleteNote={handleDeleteNoteById}
              onUpdateActiveNoteSubject={(newSubject) => {
                updateActiveNote({ subject: newSubject });
                setSettings((s) => ({ ...s, lastSubject: newSubject }));
                if (!customSubjects.includes(newSubject)) {
                  setCustomSubjects((prev) => [...prev, newSubject]);
                }
              }}
              onUpdateActiveNoteTopic={(newTopic) => {
                updateActiveNote({ topic: newTopic });
              }}
              onToggleFavorite={handleToggleFavorite}
              onRenameNote={handleRenameNote}
              isOpen={isSubjectTopicSidebarOpen}
              onToggleOpen={() => setIsSubjectTopicSidebarOpen(!isSubjectTopicSidebarOpen)}
              darkMode={darkMode}
              compact={settings.compact}
            />

            {/* Note Editor Area OR Topic Canvas */}
            {activeTopicCanvas ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                <TopicCanvas
                  subject={activeTopicCanvas.subject}
                  topic={activeTopicCanvas.topic}
                  notes={notes}
                  darkMode={darkMode}
                  onBackToNotes={() => setActiveTopicCanvas(null)}
                  onOpenNote={(noteId) => {
                    setActiveNoteId(noteId);
                    setActiveTopicCanvas(null);
                  }}
                  onCreateNoteInTopic={(subj, top) => {
                    handleCreateNote(subj, top);
                    setActiveTopicCanvas(null);
                  }}
                />
              </div>
            ) : (
              <div
                className={`flex-1 flex flex-col h-full overflow-hidden min-w-0 ${
                  settings.compact ? 'px-3 py-2 sm:px-5 sm:py-2.5' : 'px-6 sm:px-8 py-3.5'
                }`}
              >
                {/* Top Header Row */}
                <NotesHeader
                  title={activeNote.title}
                  onTitleChange={(newTitle) => updateActiveNote({ title: newTitle })}
                  onBack={() => setCurrentPage('dashboard')}
                  onExport={() => setIsExportOpen(true)}
                  onDelete={handleDeleteActiveNote}
                  isSaved={isSaved}
                  subject={activeNote.subject}
                  topic={activeNote.topic}
                  isSidebarOpen={isSubjectTopicSidebarOpen}
                  onToggleSidebar={() => setIsSubjectTopicSidebarOpen(!isSubjectTopicSidebarOpen)}
                  darkMode={darkMode}
                  compact={settings.compact}
                  onOpenCanvas={() => {
                    setActiveTopicCanvas({ subject: activeNote.subject, topic: activeNote.topic });
                  }}
                />

            {/* First Toolbar: Rich Text & Insertion Formatting */}
            <div className="mb-2 relative z-30">
              <FormattingToolbar
                onFormat={handleFormat}
                onApplyListStyle={handleApplyListStyle}
                onInsertChecklist={handleInsertChecklist}
                onInsertImageFile={handleInsertImageFile}
                onPasteImage={handlePasteImage}
                onInsertPdfFile={handleInsertPdfFile}
                hasPdf={Boolean(activeNote.pdfData && activeNote.pdfData.pages.length > 0)}
                paperStyle={activeNote.paperStyle || 'ruled'}
                onPaperStyleChange={(paperStyle) => updateActiveNote({ paperStyle })}
                drawingOpen={isDrawingToolbarOpen}
                onToggleDrawing={() => setIsDrawingToolbarOpen(!isDrawingToolbarOpen)}
                darkMode={darkMode}
                activeFontFamily={activeFontFamily}
                activeFontSize={activeFontSize}
              />
            </div>

            {/* Second Toolbar: Drawing Canvas Tools (visible when drawing is active) */}
            {isDrawingToolbarOpen && (
              <div className="mb-3 relative z-40">
                <DrawingToolbar
                  currentTool={currentTool}
                  onSelectTool={(tool) => setCurrentTool(tool)}
                  eraserType={eraserType}
                  onSelectEraserType={(type) => setEraserType(type)}
                  thickness={thickness}
                  onThicknessChange={(t) => setThickness(t)}
                  color={color}
                  onColorChange={(c) => setColor(c)}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onClear={handleClearDrawing}
                  onDone={() => setIsDrawingToolbarOpen(false)}
                  canUndo={undoStackRef.current.length > 0}
                  canRedo={redoStackRef.current.length > 0}
                  darkMode={darkMode}
                />
              </div>
            )}

            {/* Canvas / Note Surface */}
            <div
              className={`flex-1 rounded-2xl border overflow-hidden flex flex-col shadow-xs ${
                darkMode ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-[#EAECF0]'
              }`}
            >
              <NoteCanvas
                key={activeNote.id}
                contentHtml={activeNote.content}
                onContentChange={(html) => updateActiveNote({ content: html })}
                textBoxes={activeNote.textBoxes}
                onTextBoxesChange={(boxes) =>
                  updateActiveNote({
                    textBoxes: boxes,
                    content: boxes.map((b) => b.content).join('<hr/>'),
                  })
                }
                paperStyle={activeNote.paperStyle || 'ruled'}
                onPaperStyleChange={(paperStyle) => updateActiveNote({ paperStyle })}
                strokes={activeNote.strokes}
                onStrokesChange={handleStrokesChange}
                isDrawingMode={isDrawingToolbarOpen}
                onToggleDrawing={() => setIsDrawingToolbarOpen(!isDrawingToolbarOpen)}
                currentTool={currentTool}
                eraserType={eraserType}
                thickness={thickness}
                color={color}
                pdfData={activeNote.pdfData}
                onPdfDataChange={(pdfData) => updateActiveNote({ pdfData })}
                darkMode={darkMode}
                editorFont={settings.editorFont || 'sans'}
              />
            </div>
          </div>
        )}
      </div>
    )}

        {currentPage === 'dashboard' && (
          <DashboardView
            notes={notes}
            onSelectNote={(id) => {
              setActiveNoteId(id);
              setCurrentPage('notes');
            }}
            onViewSubject={(sub) => {
              setSelectedSubjectForTopics(sub);
              setCurrentPage('subjects');
            }}
            onViewAllGoals={() => setCurrentPage('goals')}
            onCreateGoal={() => setCurrentPage('goals')}
            onNavigateToTimer={() => setCurrentPage('timer')}
            onCreateNote={handleCreateNote}
            darkMode={darkMode}
            compact={settings.compact}
            defaultView={settings.defaultView}
            defaultSort={settings.defaultSort}
            customSubjects={customSubjects}
          />
        )}

        {currentPage === 'goals' && (
          <GoalsView
            darkMode={darkMode}
            compact={settings.compact}
            subjects={allSubjects}
            onNavigateToTimer={() => setCurrentPage('timer')}
          />
        )}

        {currentPage === 'subjects' && (
          <SubjectsView
            notes={notes}
            onSelectNote={(id) => {
              setActiveNoteId(id);
              setCurrentPage('notes');
            }}
            onCreateNote={handleCreateNote}
            onAddSubject={handleAddSubject}
            customSubjects={customSubjects}
            subjectsOrder={subjectsOrder}
            onUpdateSubjectsOrder={handleUpdateSubjectsOrder}
            initialSubject={selectedSubjectForTopics}
            onClearInitialSubject={() => setSelectedSubjectForTopics(null)}
            onOpenTopicCanvas={(subject, topic) => {
              setActiveTopicCanvas({ subject, topic });
              setCurrentPage('notes');
            }}
            darkMode={darkMode}
            compact={settings.compact}
          />
        )}

        {currentPage === 'timer' && (
          <div className={`flex-1 overflow-y-auto max-w-4xl mx-auto w-full ${settings.compact ? 'py-4 px-4' : 'py-8 px-6'}`}>
            <StudyTimer
              darkMode={darkMode}
              compact={settings.compact}
              isStandalonePage={true}
              subjects={allSubjects}
              onNavigateToGoals={() => setCurrentPage('goals')}
            />
          </div>
        )}

        {currentPage === 'recent' && (
          <RecentView
            notes={notes}
            onSelectNote={(id) => {
              setActiveNoteId(id);
              setCurrentPage('notes');
            }}
            onToggleFavorite={handleToggleFavorite}
            darkMode={darkMode}
            compact={settings.compact}
            defaultView={settings.defaultView}
            defaultSort={settings.defaultSort}
          />
        )}

        {currentPage === 'favorites' && (
          <FavoritesView
            notes={notes}
            onSelectNote={(id) => {
              setActiveNoteId(id);
              setCurrentPage('notes');
            }}
            onToggleFavorite={handleToggleFavorite}
            darkMode={darkMode}
            compact={settings.compact}
            defaultView={settings.defaultView}
            defaultSort={settings.defaultSort}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
            notes={notes}
            allSubjects={allSubjects}
            customSubjects={customSubjects}
            onDeleteCustomSubject={handleDeleteCustomSubject}
            onImportNotes={handleImportNotes}
            onResetSettings={handleResetSettings}
            onResetDemoNotes={handleResetDemoNotes}
            onDeleteAllNotes={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Delete All Notes',
                message:
                  'Are you absolutely sure? This will permanently erase ALL notes in your notebook. This action cannot be undone.',
                confirmLabel: 'Delete Everything',
                confirmVariant: 'danger',
                onConfirm: () => {
                  const fresh = [{ ...INITIAL_NOTE, id: `note_${Date.now()}` }];
                  setNotes(fresh);
                  setActiveNoteId(fresh[0].id);
                  closeConfirmModal();
                },
              });
            }}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )}
      </main>

      {/* Export Modal */}
      <ExportModal
        note={activeNote}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        darkMode={darkMode}
      />

      {/* Universal In-App Confirmation Modal (Safe in iFrames and on all devices) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        darkMode={darkMode}
      />
      </div>
      </StudyTimerProvider>
    </GoalsProvider>
  );
}

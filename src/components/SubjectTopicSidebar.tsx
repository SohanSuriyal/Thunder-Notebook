import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Search,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  FolderPlus,
  Star,
  Check,
  Bookmark,
  Layers,
  Sparkles,
  MoreHorizontal,
  Trash2,
  Pencil,
  LayoutGrid,
} from 'lucide-react';
import { NoteItem } from '../types';
import { getSubjectTheme } from '../utils/subjectThemes';
import { ConfirmModal } from './ConfirmModal';

interface SubjectTopicSidebarProps {
  notes: NoteItem[];
  activeNote: NoteItem;
  allSubjects: string[];
  customSubjects: string[];
  onSelectNote: (noteId: string) => void;
  onCreateNote: (subject?: string, topic?: string) => void;
  onAddSubject: (subjectName: string, initialTopic?: string) => void;
  onDeleteSubject?: (subjectName: string) => void;
  onDeleteTopic?: (subjectName: string, topicName: string) => void;
  onUpdateActiveNoteSubject: (newSubject: string) => void;
  onUpdateActiveNoteTopic: (newTopic: string) => void;
  onRenameNote?: (noteId: string, newTitle: string) => void;
  onToggleFavorite?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  darkMode?: boolean;
  compact?: boolean;
  subjectsOrder?: string[];
  onUpdateSubjectsOrder?: (newOrder: string[]) => void;
  activeTopicCanvas?: { subject: string; topic: string } | null;
  onOpenTopicCanvas?: (subject: string, topic: string) => void;
}

export const SubjectTopicSidebar: React.FC<SubjectTopicSidebarProps> = ({
  notes,
  activeNote,
  allSubjects,
  customSubjects,
  onSelectNote,
  onCreateNote,
  onAddSubject,
  onDeleteSubject,
  onDeleteTopic,
  onUpdateActiveNoteSubject,
  onUpdateActiveNoteTopic,
  onRenameNote,
  onToggleFavorite,
  onDeleteNote,
  isOpen,
  onToggleOpen,
  darkMode = false,
  compact = false,
  subjectsOrder: subjectsOrderProp,
  onUpdateSubjectsOrder,
  activeTopicCanvas,
  onOpenTopicCanvas,
}) => {
  // Internal order fallback
  const [internalOrder, setInternalOrder] = useState<string[]>(() => {
    if (subjectsOrderProp && subjectsOrderProp.length > 0) return subjectsOrderProp;
    try {
      const saved = localStorage.getItem('ns_subjects_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (subjectsOrderProp && subjectsOrderProp.length > 0) {
      setInternalOrder(subjectsOrderProp);
    }
  }, [subjectsOrderProp]);

  // Drag and drop state for subjects
  const [draggedSubject, setDraggedSubject] = useState<string | null>(null);
  const [dragOverSubject, setDragOverSubject] = useState<string | null>(null);
  const didDragRef = useRef(false);

  // Computed ordered subjects
  const displaySubjects = useMemo(() => {
    const rawSet = new Set(allSubjects);
    const order = subjectsOrderProp && subjectsOrderProp.length > 0 ? subjectsOrderProp : internalOrder;
    if (order.length > 0) {
      const result: string[] = [];
      order.forEach((sub) => {
        if (rawSet.has(sub)) {
          result.push(sub);
          rawSet.delete(sub);
        }
      });
      allSubjects.forEach((sub) => {
        if (rawSet.has(sub)) {
          result.push(sub);
          rawSet.delete(sub);
        }
      });
      return result;
    }
    return allSubjects;
  }, [allSubjects, subjectsOrderProp, internalOrder]);

  const handleDragStart = (e: React.DragEvent, subName: string) => {
    didDragRef.current = false;
    setDraggedSubject(subName);
    e.dataTransfer.setData('text/plain', subName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetSubName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSubject !== targetSubName) {
      setDragOverSubject(targetSubName);
    }
  };

  const handleDragLeave = () => {
    setDragOverSubject(null);
  };

  const handleDrop = (e: React.DragEvent, targetSubName: string) => {
    e.preventDefault();
    setDragOverSubject(null);
    didDragRef.current = true;
    setTimeout(() => {
      didDragRef.current = false;
    }, 200);

    const sourceSubject = draggedSubject || e.dataTransfer.getData('text/plain');
    if (!sourceSubject || sourceSubject === targetSubName) {
      setDraggedSubject(null);
      return;
    }

    const currentOrder = [...displaySubjects];
    const sourceIdx = currentOrder.indexOf(sourceSubject);
    const targetIdx = currentOrder.indexOf(targetSubName);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      currentOrder.splice(sourceIdx, 1);
      currentOrder.splice(targetIdx, 0, sourceSubject);
      setInternalOrder(currentOrder);
      if (onUpdateSubjectsOrder) {
        onUpdateSubjectsOrder(currentOrder);
      }
      try {
        localStorage.setItem('ns_subjects_order', JSON.stringify(currentOrder));
      } catch {
        // ignore
      }
    }
    setDraggedSubject(null);
  };

  const handleDragEnd = () => {
    setDraggedSubject(null);
    setDragOverSubject(null);
    setTimeout(() => {
      didDragRef.current = false;
    }, 200);
  };
  // Currently selected / expanded subjects
  const [selectedSubject, setSelectedSubject] = useState<string>(
    activeNote.subject || allSubjects[0] || 'dbms'
  );
  
  // Set of expanded subjects (accordion support)
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>(() => ({
    [activeNote.subject || 'dbms']: true,
  }));

  // Set of expanded topics (to reveal list of notes)
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(() => {
    const key = `${activeNote.subject || 'dbms'}::${activeNote.topic || 'Week 6'}`;
    return { [key]: true };
  });

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Inline "New Subject" creator
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Inline "New Topic" creator per subject
  const [activeCreatingTopicSubject, setActiveCreatingTopicSubject] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');

  // Inline Note Renaming
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitleDraft, setEditingTitleDraft] = useState<string>('');

  const handleStartRename = (note: NoteItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setEditingNoteId(note.id);
    setEditingTitleDraft(note.title || 'Untitled note');
  };

  const handleSaveRename = (noteId: string) => {
    if (editingNoteId === noteId) {
      const trimmed = editingTitleDraft.trim();
      if (trimmed && onRenameNote) {
        onRenameNote(noteId, trimmed);
      }
      setEditingNoteId(null);
    }
  };

  const handleCancelRename = () => {
    setEditingNoteId(null);
  };

  // Confirmation modal state for deleting subjects, topics, or notes
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    onConfirm: () => {},
  });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handlePromptDeleteSubject = (subName: string, totalNotes: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Subject',
      message:
        totalNotes > 0
          ? `Are you sure you want to delete "${subName}"? This will permanently delete ${totalNotes} note${
              totalNotes === 1 ? '' : 's'
            } and all topics within this subject.`
          : `Are you sure you want to delete the subject "${subName}"?`,
      confirmLabel: 'Delete Subject',
      onConfirm: () => {
        closeConfirmModal();
        if (onDeleteSubject) {
          onDeleteSubject(subName);
        }
      },
    });
  };

  const handlePromptDeleteTopic = (subName: string, topName: string, notesCount: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Topic',
      message:
        notesCount > 0
          ? `Are you sure you want to delete "${topName}" under ${subName}? This will permanently delete ${notesCount} note${
              notesCount === 1 ? '' : 's'
            } inside this topic.`
          : `Are you sure you want to delete the topic "${topName}"?`,
      confirmLabel: 'Delete Topic',
      onConfirm: () => {
        closeConfirmModal();
        if (onDeleteTopic) {
          onDeleteTopic(subName, topName);
        }
      },
    });
  };

  const handlePromptDeleteNote = (note: NoteItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Note',
      message: `Are you sure you want to delete "${note.title || 'Untitled note'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Note',
      onConfirm: () => {
        closeConfirmModal();
        if (onDeleteNote) {
          onDeleteNote(note.id);
        }
      },
    });
  };

  // Keep selected subject and topic in sync when activeNote changes
  useEffect(() => {
    if (activeNote.subject) {
      setSelectedSubject(activeNote.subject);
      setExpandedSubjects((prev) => ({ ...prev, [activeNote.subject]: true }));
      if (activeNote.topic) {
        const topicKey = `${activeNote.subject}::${activeNote.topic}`;
        setExpandedTopics((prev) => ({ ...prev, [topicKey]: true }));
      }
    }
  }, [activeNote.id, activeNote.subject, activeNote.topic]);

  // Group notes by subject -> topic
  const groupedData = useMemo(() => {
    const map = new Map<string, Map<string, NoteItem[]>>();

    // Ensure all registered subjects appear even if empty
    allSubjects.forEach((sub) => {
      if (!map.has(sub)) {
        map.set(sub, new Map<string, NoteItem[]>());
      }
    });

    notes.forEach((note) => {
      const sub = note.subject || 'General';
      const top = note.topic || 'General';
      if (!map.has(sub)) {
        map.set(sub, new Map<string, NoteItem[]>());
      }
      const subjectMap = map.get(sub)!;
      if (!subjectMap.has(top)) {
        subjectMap.set(top, []);
      }
      subjectMap.get(top)!.push(note);
    });

    return map;
  }, [notes, allSubjects]);

  // Toggle expand subject
  const handleToggleSubject = (sub: string) => {
    setSelectedSubject(sub);
    setExpandedSubjects((prev) => ({
      ...prev,
      [sub]: !prev[sub],
    }));
  };

  // Toggle expand topic
  const handleToggleTopic = (sub: string, top: string) => {
    const key = `${sub}::${top}`;
    setExpandedTopics((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Submit new subject
  const handleCreateSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSubjectName.trim();
    if (val) {
      onAddSubject(val, 'Introduction');
      setSelectedSubject(val);
      setExpandedSubjects((prev) => ({ ...prev, [val]: true }));
      setNewSubjectName('');
      setIsCreatingSubject(false);
    }
  };

  // Submit new topic under a subject
  const handleCreateTopicSubmit = (sub: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = newTopicName.trim();
    if (val) {
      onCreateNote(sub, val);
      const key = `${sub}::${val}`;
      setExpandedTopics((prev) => ({ ...prev, [key]: true }));
      setNewTopicName('');
      setActiveCreatingTopicSubject(null);
    }
  };

  if (!isOpen) {
    return (
      <div
        className={`flex flex-col items-center py-4 border-r transition-all select-none w-12 shrink-0 ${
          darkMode ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-[#EAECF0]'
        }`}
      >
        <button
          id="open-subject-topic-sidebar-btn"
          type="button"
          onClick={onToggleOpen}
          className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-[#7F56D9] transition-colors cursor-pointer"
          title="Open Subjects & Topics sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <div className="mt-6 flex flex-col items-center gap-4 text-xs font-semibold text-gray-400 dark:text-zinc-500 writing-mode-vertical [writing-mode:vertical-rl] tracking-wider uppercase">
          <span>Subjects & Topics</span>
        </div>
      </div>
    );
  }

  const query = searchQuery.toLowerCase().trim();

  return (
    <aside
      id="subject-topic-sidebar"
      className={`flex flex-col h-full border-r transition-all duration-200 select-none shrink-0 w-72 sm:w-80 ${
        darkMode
          ? 'bg-[#18181b] border-zinc-800 text-zinc-200'
          : 'bg-[#FAFAFB] border-[#EAECF0] text-gray-800'
      }`}
    >
      {/* Sidebar Header */}
      <div
        className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${
          darkMode ? 'border-zinc-800 bg-[#1e1e24]' : 'border-[#EAECF0] bg-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#7F56D9]/10 text-[#7F56D9] flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">
              Subjects & Topics
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
              Select topic to view notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Add Subject Button */}
          <button
            id="add-subject-sidebar-btn"
            type="button"
            onClick={() => setIsCreatingSubject(true)}
            className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-[#7F56D9] transition-colors cursor-pointer"
            title="Add new subject"
          >
            <FolderPlus className="w-4 h-4" />
          </button>

          {/* Collapse Sidebar Button */}
          <button
            id="close-subject-topic-sidebar-btn"
            type="button"
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Search Input */}
      <div className="px-3.5 py-2.5 shrink-0">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
            darkMode
              ? 'bg-zinc-800/80 border-zinc-700 text-zinc-100'
              : 'bg-white border-[#D0D5DD] text-gray-900 shadow-2xs'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Filter subjects, topics, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder-gray-400 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Inline Create Subject Form */}
      {isCreatingSubject && (
        <form
          onSubmit={handleCreateSubjectSubmit}
          className="mx-3.5 mb-2.5 p-2.5 rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60 shrink-0"
        >
          <div className="text-xs font-semibold text-[#7F56D9] dark:text-purple-300 mb-1.5 flex items-center justify-between">
            <span>New Subject</span>
            <button
              type="button"
              onClick={() => setIsCreatingSubject(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="e.g. Operating Systems, Math..."
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 outline-none mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsCreatingSubject(false)}
              className="px-2.5 py-1 text-xs text-gray-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newSubjectName.trim()}
              className="px-3 py-1 text-xs font-semibold bg-[#7F56D9] text-white rounded-md hover:bg-[#6941C6] disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Hierarchical Tree: Subjects -> Topics -> Notes */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1.5 custom-scrollbar">
        {displaySubjects.length === 0 ? (
          <div className="text-center py-8 px-4 text-gray-400 text-xs">
            No subjects found. Click + to add your first subject!
          </div>
        ) : (
          displaySubjects.map((subjectName) => {
            const topicMap: Map<string, NoteItem[]> =
              groupedData.get(subjectName) || new Map<string, NoteItem[]>();
            const topics: string[] = Array.from(topicMap.keys());
            
            // Calculate total notes in this subject
            let totalSubjectNotes = 0;
            topicMap.forEach((notesInTopic) => {
              totalSubjectNotes += notesInTopic.length;
            });

            // Filter by search query if present
            const matchesSubject = subjectName.toLowerCase().includes(query);
            const matchingTopics: string[] = topics.filter((t: string) => {
              if (!query) return true;
              if (matchesSubject) return true;
              if (t.toLowerCase().includes(query)) return true;
              const notesInTopic = topicMap.get(t) || [];
              return notesInTopic.some((n) => n.title?.toLowerCase().includes(query));
            });

            if (query && !matchesSubject && matchingTopics.length === 0) {
              return null;
            }

            const isSubjectExpanded = expandedSubjects[subjectName] ?? (subjectName === activeNote.subject);
            const isCurrentActiveSubject = activeNote.subject === subjectName;
            const subTheme = getSubjectTheme(subjectName);
            const isDragging = draggedSubject === subjectName;
            const isOver = dragOverSubject === subjectName && draggedSubject !== subjectName;

            return (
              <div
                key={subjectName}
                draggable
                onDragStart={(e) => handleDragStart(e, subjectName)}
                onDragOver={(e) => handleDragOver(e, subjectName)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, subjectName)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border transition-all ${
                  isDragging
                    ? 'opacity-40 border-dashed border-purple-500 scale-[0.98]'
                    : isOver
                    ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50/20 dark:bg-purple-950/30'
                    : isCurrentActiveSubject
                    ? 'border-purple-200 dark:border-purple-900/60 bg-white dark:bg-zinc-900/60 shadow-2xs'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-800/80 bg-transparent'
                }`}
              >
                {/* Subject Header Row */}
                <div
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, form, input')) return;
                    if (didDragRef.current) return;
                    handleToggleSubject(subjectName);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer group transition-colors select-none ${
                    isCurrentActiveSubject
                      ? 'text-[#7F56D9] dark:text-purple-300 font-semibold'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100/70 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-gray-400 dark:text-zinc-500 group-hover:text-[#7F56D9] transition-transform">
                      {isSubjectExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                    {isSubjectExpanded ? (
                      <FolderOpen className="w-4 h-4 shrink-0 transition-colors" style={{ color: subTheme.accent }} />
                    ) : (
                      <Folder className="w-4 h-4 shrink-0 transition-colors" style={{ color: subTheme.accent }} />
                    )}
                    <span className="text-xs truncate uppercase tracking-wider font-semibold">
                      {subjectName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Badge showing topic count */}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-medium">
                      {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
                    </span>

                    {/* Quick + Add Topic button for this subject */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSubjects((prev) => ({ ...prev, [subjectName]: true }));
                        setActiveCreatingTopicSubject(subjectName);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 text-[#7F56D9] transition-opacity cursor-pointer"
                      title={`Add topic to ${subjectName}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete subject button (Yellow highlight area) */}
                    {onDeleteSubject && (
                      <button
                        type="button"
                        id={`delete-subject-btn-${subjectName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handlePromptDeleteSubject(subjectName, totalSubjectNotes);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                        title={`Delete subject "${subjectName}"`}
                        aria-label={`Delete subject ${subjectName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subject Respected Topics (Opens when Subject is clicked) */}
                {isSubjectExpanded && (
                  <div className="pl-4 pr-1.5 pb-2 pt-0.5 space-y-1">
                    {/* Inline Form to add a new topic to this subject */}
                    {activeCreatingTopicSubject === subjectName && (
                      <form
                        onSubmit={(e) => handleCreateTopicSubmit(subjectName, e)}
                        className="my-1.5 p-2 rounded-lg border bg-purple-50/40 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50"
                      >
                        <div className="text-[11px] font-semibold text-[#7F56D9] mb-1">
                          New Topic in {subjectName}
                        </div>
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g. Week 7, Chapter 2..."
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 outline-none mb-1.5"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCreatingTopicSubject(null);
                              setNewTopicName('');
                            }}
                            className="px-2 py-0.5 text-[11px] text-gray-500 rounded hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!newTopicName.trim()}
                            className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#7F56D9] text-white rounded hover:bg-[#6941C6] disabled:opacity-50"
                          >
                            Add Topic
                          </button>
                        </div>
                      </form>
                    )}

                    {matchingTopics.length === 0 && activeCreatingTopicSubject !== subjectName ? (
                      <div className="py-2 px-2 text-[11px] text-gray-400 dark:text-zinc-500 flex items-center justify-between">
                        <span>No topics yet</span>
                        <button
                          type="button"
                          onClick={() => setActiveCreatingTopicSubject(subjectName)}
                          className="text-[#7F56D9] dark:text-purple-400 font-semibold hover:underline"
                        >
                          + Add Topic
                        </button>
                      </div>
                    ) : (
                      matchingTopics.map((topicName) => {
                        const topicKey = `${subjectName}::${topicName}`;
                        const isTopicExpanded = expandedTopics[topicKey] ?? false;
                        const notesInTopic = topicMap.get(topicName) || [];
                        const isCurrentActiveTopic =
                          activeNote.subject === subjectName && activeNote.topic === topicName;

                        return (
                          <div key={topicName} className="space-y-0.5">
                            {/* Topic Header Row (Clicking opens its list of notes) */}
                            <div
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('button, form, input')) return;
                                handleToggleTopic(subjectName, topicName);
                              }}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group transition-all text-xs ${
                                isCurrentActiveTopic
                                  ? 'bg-purple-50 dark:bg-purple-950/40 text-[#7F56D9] dark:text-purple-300 font-medium'
                                  : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100/60 dark:hover:bg-zinc-800/40 hover:text-gray-900 dark:hover:text-zinc-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-gray-400 dark:text-zinc-500 transition-transform">
                                  {isTopicExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-[#7F56D9]" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </span>
                                <span className="truncate font-medium">{topicName}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                                  {notesInTopic.length}
                                </span>

                                {/* Quick Canvas button */}
                                {onOpenTopicCanvas && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenTopicCanvas(subjectName, topicName);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 text-[#7F56D9] transition-opacity cursor-pointer"
                                    title={`Open ${topicName} Canvas`}
                                  >
                                    <LayoutGrid className="w-3 h-3" />
                                  </button>
                                )}

                                {/* Quick + button to create a note inside this topic */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateNote(subjectName, topicName);
                                    setExpandedTopics((prev) => ({ ...prev, [topicKey]: true }));
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 text-[#7F56D9] transition-opacity cursor-pointer"
                                  title={`Create note in ${topicName}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>

                                {/* Delete topic button (Yellow highlight area) */}
                                {onDeleteTopic && (
                                  <button
                                    type="button"
                                    id={`delete-topic-btn-${subjectName}-${topicName}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handlePromptDeleteTopic(subjectName, topicName, notesInTopic.length);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                                    title={`Delete topic "${topicName}"`}
                                    aria-label={`Delete topic ${topicName}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* List of Notes & Canvas under this Topic (Opens on clicking the topic) */}
                            {isTopicExpanded && (
                              <div className="pl-5 pr-1 py-1 space-y-0.5 border-l-2 border-purple-100 dark:border-purple-950/60 ml-2.5">
                                {/* Dedicated Topic Canvas item */}
                                {onOpenTopicCanvas && (
                                  <div
                                    onClick={() => onOpenTopicCanvas(subjectName, topicName)}
                                    className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                                      activeTopicCanvas?.subject === subjectName && activeTopicCanvas?.topic === topicName
                                        ? 'bg-[#7F56D9] text-white font-semibold shadow-2xs'
                                        : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-purple-400 group-hover:scale-105 transition-transform" />
                                      <span className="truncate font-medium">Canvas</span>
                                    </div>
                                    <span
                                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                        activeTopicCanvas?.subject === subjectName && activeTopicCanvas?.topic === topicName
                                          ? 'bg-white/20 text-white'
                                          : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                                      }`}
                                    >
                                      Board
                                    </span>
                                  </div>
                                )}
                                {notesInTopic.length === 0 ? (
                                  <div className="py-1 px-1.5 text-[11px] text-gray-400 dark:text-zinc-500 italic flex items-center justify-between">
                                    <span>No notes</span>
                                    <button
                                      type="button"
                                      onClick={() => onCreateNote(subjectName, topicName)}
                                      className="text-[10px] text-[#7F56D9] font-medium hover:underline not-italic"
                                    >
                                      + Create note
                                    </button>
                                  </div>
                                ) : (
                                  notesInTopic.map((note) => {
                                    const isThisActive = note.id === activeNote.id;
                                    const isEditingThisNote = editingNoteId === note.id;

                                    return (
                                      <div
                                        key={note.id}
                                        onClick={(e) => {
                                          const target = e.target as HTMLElement;
                                          if (target.closest('button, form, input')) {
                                            return;
                                          }
                                          if (isThisActive && !isEditingThisNote) {
                                            handleStartRename(note);
                                          } else if (!isThisActive) {
                                            onSelectNote(note.id);
                                          }
                                        }}
                                        onDoubleClick={(e) => handleStartRename(note, e)}
                                        className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                                          isThisActive
                                            ? 'bg-[#7F56D9] text-white font-semibold shadow-2xs'
                                            : 'text-gray-700 dark:text-zinc-300 hover:bg-purple-50/70 dark:hover:bg-zinc-800/60 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <FileText
                                            className={`w-3.5 h-3.5 shrink-0 ${
                                              isThisActive
                                                ? 'text-white'
                                                : 'text-gray-400 dark:text-zinc-500 group-hover:text-[#7F56D9]'
                                            }`}
                                          />

                                          {isEditingThisNote ? (
                                            <form
                                              onSubmit={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSaveRename(note.id);
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex items-center gap-1 min-w-0 flex-1 mr-1"
                                            >
                                              <input
                                                type="text"
                                                autoFocus
                                                value={editingTitleDraft}
                                                onChange={(e) => setEditingTitleDraft(e.target.value)}
                                                onBlur={() => handleSaveRename(note.id)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Escape') {
                                                    e.stopPropagation();
                                                    handleCancelRename();
                                                  } else if (e.key === 'Enter') {
                                                    e.stopPropagation();
                                                    handleSaveRename(note.id);
                                                  }
                                                }}
                                                className={`w-full px-1.5 py-0.5 text-xs rounded border outline-none font-medium ${
                                                  isThisActive
                                                    ? 'bg-white text-gray-900 border-white ring-2 ring-purple-300 shadow-2xs'
                                                    : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border-purple-400 ring-2 ring-purple-200'
                                                }`}
                                              />
                                              <button
                                                type="submit"
                                                onMouseDown={(e) => e.preventDefault()}
                                                className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs cursor-pointer"
                                                title="Save title"
                                              >
                                                <Check className="w-3 h-3 stroke-[2.5]" />
                                              </button>
                                            </form>
                                          ) : (
                                            <span
                                              className="truncate flex-1"
                                              title={isThisActive ? 'Click to rename' : note.title || 'Untitled note'}
                                            >
                                              {note.title || 'Untitled note'}
                                            </span>
                                          )}
                                        </div>

                                        {!isEditingThisNote && (
                                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                            {/* Delete Note button (Yellow highlight area) */}
                                            {onDeleteNote && (
                                              <button
                                                type="button"
                                                id={`delete-note-btn-${note.id}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  e.preventDefault();
                                                  handlePromptDeleteNote(note);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                                                  isThisActive
                                                    ? 'text-white/80 hover:text-white hover:bg-rose-500/50'
                                                    : 'text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 opacity-60 group-hover:opacity-100'
                                                }`}
                                                title={`Delete "${note.title || 'Untitled note'}"`}
                                                aria-label={`Delete "${note.title || 'Untitled note'}"`}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}

                                            {/* Rename button on hover or active */}
                                            <button
                                              type="button"
                                              id={`rename-note-btn-${note.id}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleStartRename(note, e);
                                              }}
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onPointerDown={(e) => e.stopPropagation()}
                                              className={`p-1 rounded-md transition-opacity cursor-pointer flex items-center justify-center shrink-0 ${
                                                isThisActive
                                                  ? 'opacity-80 hover:opacity-100 text-white hover:bg-white/20'
                                                  : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#7F56D9] hover:bg-purple-100 dark:hover:bg-zinc-700'
                                              }`}
                                              title="Rename note"
                                              aria-label="Rename note"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Favorite Star */}
                                            {note.favorite && (
                                              <Star
                                                className={`w-3 h-3 fill-amber-400 text-amber-400 shrink-0 ${
                                                  isThisActive ? 'text-amber-300 fill-amber-300' : ''
                                                }`}
                                              />
                                            )}

                                            {/* Active Indicator dot */}
                                            {isThisActive && (
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}

                                {/* + New Note Button at end of note list */}
                                <button
                                  type="button"
                                  onClick={() => onCreateNote(subjectName, topicName)}
                                  className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-zinc-400 hover:text-[#7F56D9] dark:hover:text-purple-300 hover:bg-purple-50/50 dark:hover:bg-zinc-800/40 rounded transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>New note in {topicName}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Bottom "+ Add Topic" option if topics exist */}
                    {matchingTopics.length > 0 && activeCreatingTopicSubject !== subjectName && (
                      <button
                        type="button"
                        onClick={() => setActiveCreatingTopicSubject(subjectName)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 dark:text-zinc-500 hover:text-[#7F56D9] dark:hover:text-purple-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Topic...</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info: Current Active Note context */}
      <div
        className={`p-3 border-t text-xs shrink-0 ${
          darkMode ? 'border-zinc-800 bg-[#1e1e24]' : 'border-[#EAECF0] bg-white'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400 mb-1">
          <span>Active Note</span>
          <span className="font-semibold text-[#7F56D9] uppercase">{activeNote.subject || 'None'}</span>
        </div>
        <div className="font-semibold text-gray-800 dark:text-zinc-200 truncate">
          {activeNote.title || 'Untitled note'}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-zinc-400 truncate flex items-center gap-1 mt-0.5">
          <Bookmark className="w-3 h-3 text-purple-500 shrink-0" />
          <span>{activeNote.topic || 'General'}</span>
        </div>
      </div>

      {/* Confirmation Modal for Deleting Subjects, Topics, or Notes */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        darkMode={darkMode}
      />
    </aside>
  );
};

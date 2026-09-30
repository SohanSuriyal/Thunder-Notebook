export type NavPage = 'dashboard' | 'subjects' | 'notes' | 'goals' | 'timer' | 'recent' | 'favorites' | 'settings';

export type GoalType = 'study_time' | 'subject_topic' | 'task_note' | 'deadline';
export type GoalCadence = 'none' | 'daily' | 'weekly';

export interface SubGoalItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
}

export interface GoalSessionLog {
  id: string;
  timestamp: number;
  durationMinutes: number;
  subject?: string;
  mode?: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  goalId?: string;
  sessionType: 'pomodoro' | 'countdown' | 'stopwatch';
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  durationMinutes: number; // in minutes (e.g. 25)
}

export interface GoalItem {
  id: string;
  title: string;
  description?: string;
  type: GoalType;
  subject?: string;
  targetValue: number;
  currentProgress: number;
  unit: string;
  deadline?: string; // YYYY-MM-DD
  cadence?: GoalCadence;
  completed: boolean;
  completedAt?: number;
  subGoals?: SubGoalItem[];
  sessionLogs?: GoalSessionLog[];
  createdAt: number;
  updatedAt: number;
}

export type DrawingTool = 'pen' | 'highlighter' | 'eraser';
export type EraserType = 'stroke-eraser' | 'eraser';

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface DrawingStroke {
  id: string;
  tool: DrawingTool;
  eraserType?: EraserType;
  color: string;
  size: number;
  points: DrawingPoint[];
}

export interface PdfDocumentPage {
  pageNumber: number;
  originalPageNumber?: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfDocumentData {
  fileName: string;
  fileSize: number;
  totalPages: number;
  pages: PdfDocumentPage[];
  uploadedAt?: number;
  selectedRanges?: string;
  originalTotalPages?: number;
}

export interface NoteTextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  content: string; // rich text HTML
  fontFamily?: string;
  fontSize?: string;
}

export type PaperStyle = 'blank' | 'ruled' | 'grid';

export interface NoteItem {
  id: string;
  title: string;
  subject: string;
  topic: string;
  content: string; // rich text HTML or free text
  textBoxes?: NoteTextBox[];
  paperStyle?: PaperStyle;
  strokes: DrawingStroke[];
  created: number;
  updated: number;
  favorite: boolean;
  type: 'written' | 'pdf' | 'image';
  fileName?: string;
  fileDataUrl?: string;
  pdfData?: PdfDocumentData;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  compact: boolean;
  animations: boolean;
  defaultView: 'grid' | 'list';
  defaultSort: 'recent' | 'name' | 'name-desc' | 'oldest';
  defaultPaperStyle: PaperStyle;
  editorFont: 'sans' | 'serif' | 'mono';
  rememberLastSubject: boolean;
  defaultSubject: string;
  confirmDelete: boolean;
  lastSubject: string;
}

export type CanvasNodeType = 'text' | 'file' | 'media';
export type CanvasAnchorSide = 'top' | 'bottom' | 'left' | 'right';

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  title?: string;
  text?: string;
  fontFamily?: 'sans' | 'serif' | 'mono' | 'handwriting';
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  backgroundColor?: string;
  noteId?: string;
  noteTitle?: string;
  noteSnippet?: string;
  displayMode?: 'auto' | 'drawing' | 'text' | 'both';
  fitMode?: 'fit-all' | 'fit-width';
  mediaUrl?: string;
  mediaName?: string;
  mediaFit?: 'contain' | 'cover';
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: CanvasAnchorSide;
  toNode: string;
  toSide: CanvasAnchorSide;
  label?: string;
  color?: string;
}

export interface TopicCanvasData {
  id: string;
  subject: string;
  topic: string;
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  zoom: number;
  panX: number;
  panY: number;
  updatedAt: number;
}


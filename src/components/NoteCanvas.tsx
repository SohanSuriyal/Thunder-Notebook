import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getStroke } from 'perfect-freehand';
import {
  DrawingStroke,
  DrawingTool,
  EraserType,
  DrawingPoint,
  PdfDocumentData,
  NoteTextBox,
  PaperStyle,
} from '../types';
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  Trash2,
  PenTool,
  GripHorizontal,
  X,
  AlertCircle,
  Plus,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Scroll,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { renderPdfPages, getPdfMetadata } from '../utils/pdfLoader';
import {
  PdfPageRangeModal,
  PdfImportRequest,
  PdfManageRequest,
} from './PdfPageRangeModal';

function getDrawingCursor(tool: DrawingTool, eraserType: EraserType, thickness: number): string {
  let svg: string;
  let hotspot = 0;

  if (tool === 'pen') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2.5" fill="#111111"/></svg>`;
    hotspot = 5;
  } else if (tool === 'highlighter') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="#F79009" fill-opacity="0.55" stroke="#111111" stroke-width="1.2"/></svg>`;
    hotspot = 7;
  } else if (eraserType === 'stroke-eraser') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g transform="rotate(-45 12 12)"><rect x="6" y="7" width="13" height="10" rx="2" fill="white" stroke="#111111" stroke-width="1.8"/><path d="M8 7h7a4 4 0 0 1 4 4v2H8z" fill="#e5e7eb"/><path d="M6 14h13" stroke="#111111" stroke-width="1.4"/></g></svg>`;
    hotspot = 12;
  } else {
    const radius = Math.max(16, thickness * 2);
    const size = radius * 2 + 4;
    const center = radius + 2;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${radius}" fill="rgba(127,86,217,0.08)" stroke="#7F56D9" stroke-width="2"/></svg>`;
    hotspot = center;
  }

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot} ${hotspot}, auto`;
}

interface OneNoteTextBoxViewProps {
  box: NoteTextBox;
  isActive: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isDrawingMode: boolean;
  darkMode: boolean;
  editorFont?: 'sans' | 'serif' | 'mono';
  onSelect: () => void;
  onStartDrag: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onChangeContent: (newContent: string) => void;
  onClickContainer: (e: React.MouseEvent) => void;
}

const OneNoteTextBoxView: React.FC<OneNoteTextBoxViewProps> = ({
  box,
  isActive,
  isDragging,
  isResizing,
  isDrawingMode,
  darkMode,
  editorFont = 'sans',
  onSelect,
  onStartDrag,
  onStartResize,
  onDelete,
  onChangeContent,
  onClickContainer,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const fontClass =
    editorFont === 'serif' ? 'font-serif' : editorFont === 'mono' ? 'font-mono' : 'font-sans';

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    if (isInitialMount.current) {
      el.innerHTML = box.content;
      isInitialMount.current = false;
      return;
    }

    if (document.activeElement !== el && el.innerHTML !== box.content) {
      el.innerHTML = box.content;
    }
  }, [box.content]);

  return (
    <div
      id={`box_container_${box.id}`}
      className={`onenote-box-container pointer-events-auto group absolute transition-shadow rounded-xl ${
        isDragging ? 'opacity-85 shadow-xl cursor-grabbing' : ''
      } ${
        isActive
          ? 'ring-1 ring-purple-500/40 bg-white/50 dark:bg-zinc-900/50 shadow-xs'
          : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-zinc-700'
      }`}
      style={{
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        zIndex: isActive ? 25 : 20,
      }}
      onClick={onClickContainer}
    >
      <div
        onMouseDown={onStartDrag}
        title="Drag to move this note container anywhere"
        className={`h-5 w-full flex items-center justify-between px-2 rounded-t-xl cursor-grab transition-opacity ${
          isActive
            ? 'bg-purple-100/80 dark:bg-zinc-800/90 opacity-100'
            : 'bg-gray-100/70 dark:bg-zinc-800/60 opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="flex items-center gap-1 text-gray-400 dark:text-zinc-500">
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
            Note Box
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete this text box"
          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/50 hover:text-red-600 text-gray-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div
        ref={editorRef}
        id={`textbox_content_${box.id}`}
        data-box-id={box.id}
        contentEditable={!isDrawingMode}
        suppressContentEditableWarning
        onInput={(e) => onChangeContent(e.currentTarget.innerHTML)}
        onFocus={onSelect}
        style={{
          fontFamily: box.fontFamily,
          fontSize: box.fontSize,
        }}
        className={`onenote-text-editor p-2.5 min-h-[50px] outline-none text-base leading-relaxed ${fontClass} ${
          isDrawingMode ? 'pointer-events-none select-none' : 'pointer-events-auto'
        } ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}
      />

      <div
        onMouseDown={onStartResize}
        title="Drag to resize box width"
        className={`absolute right-0 top-5 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-purple-400/40 rounded-r-xl transition-opacity ${
          isResizing ? 'bg-purple-500/50 opacity-100' : ''
        }`}
      />
    </div>
  );
};

function getSvgPathFromStroke(strokeOutline: number[][]): Path2D {
  const path = new Path2D();
  if (strokeOutline.length < 2) return path;

  path.moveTo(strokeOutline[0][0], strokeOutline[0][1]);
  for (let i = 1; i < strokeOutline.length; i++) {
    const [x0, y0] = strokeOutline[i - 1];
    const [x1, y1] = strokeOutline[i];
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    path.quadraticCurveTo(x0, y0, midX, midY);
  }
  path.closePath();
  return path;
}

function filterJitterPoints(pts: DrawingPoint[]): DrawingPoint[] {
  if (pts.length <= 2) return pts;
  const result: DrawingPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1];
    const cur = pts[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) >= 1.5 || i === pts.length - 1) {
      result.push(cur);
    }
  }
  return result;
}

function renderStrokeToContext(ctx: CanvasRenderingContext2D, stroke: DrawingStroke) {
  if (!stroke.points || stroke.points.length === 0) return;

  const rawPts = stroke.points;
  const isHighlighter = stroke.tool === 'highlighter';

  ctx.save();

  if (isHighlighter) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(stroke.size * 3, 14);

    if (rawPts.length === 1) {
      ctx.beginPath();
      ctx.arc(rawPts[0].x, rawPts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(rawPts[0].x, rawPts[0].y);
      for (let i = 1; i < rawPts.length - 1; i++) {
        const xc = (rawPts[i].x + rawPts[i + 1].x) / 2;
        const yc = (rawPts[i].y + rawPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(rawPts[i].x, rawPts[i].y, xc, yc);
      }
      ctx.lineTo(rawPts[rawPts.length - 1].x, rawPts[rawPts.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = 1.0;

  if (rawPts.length === 1) {
    const r = Math.max(1, stroke.size / 2);
    ctx.beginPath();
    ctx.arc(rawPts[0].x, rawPts[0].y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const cleanPts = filterJitterPoints(rawPts);
  const inputPoints = cleanPts.map((p) => [p.x, p.y, p.pressure ?? 0.5]);

  const outline = getStroke(inputPoints, {
    size: stroke.size,
    thinning: 0.45,
    smoothing: 0.92,
    streamline: 0.7,
    simulatePressure: true,
    last: true,
  });

  if (outline && outline.length > 2) {
    const path = getSvgPathFromStroke(outline);
    ctx.fill(path);
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cleanPts[0].x, cleanPts[0].y);
    for (let i = 1; i < cleanPts.length - 1; i++) {
      const xc = (cleanPts[i].x + cleanPts[i + 1].x) / 2;
      const yc = (cleanPts[i].y + cleanPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(cleanPts[i].x, cleanPts[i].y, xc, yc);
    }
    ctx.lineTo(cleanPts[cleanPts.length - 1].x, cleanPts[cleanPts.length - 1].y);
    ctx.stroke();
  }

  ctx.restore();
}

interface LazyPdfPageItemProps {
  page: PdfDocumentData['pages'][0];
  totalPages: number;
  pdfZoom: number;
  pageDeleteConfirm: number | null;
  onConfirmDelete: (pageNum: number) => void;
  onSetConfirmDelete: (pageNum: number | null) => void;
  darkMode?: boolean;
}

const LazyPdfPageItem: React.FC<LazyPdfPageItemProps> = ({
  page,
  totalPages,
  pdfZoom,
  pageDeleteConfirm,
  onConfirmDelete,
  onSetConfirmDelete,
  darkMode = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '800px 0px' }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setIsVisible(true);
    }
  }, []);

  const aspectRatio = page.width && page.height ? page.height / page.width : 1.414;

  return (
    <div
      ref={itemRef}
      id={`pdf-page-${page.pageNumber}`}
      data-page-number={page.pageNumber}
      className={`relative rounded-2xl overflow-hidden shadow-md border transition-all group ${
        darkMode ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-white'
      }`}
      style={{
        width: `${pdfZoom}%`,
        maxWidth: '100%',
        minHeight: isVisible ? undefined : `${aspectRatio * 500}px`,
      }}
    >
      {isVisible ? (
        <img
          src={page.dataUrl}
          alt={`Page ${page.pageNumber}`}
          className="w-full h-auto block select-none pointer-events-none"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className={`w-full flex flex-col items-center justify-center py-28 ${
            darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-50 text-gray-400'
          }`}
          style={{ aspectRatio: `${page.width} / ${page.height}` }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mb-2" />
          <span className="text-xs font-semibold">Page {page.pageNumber}...</span>
        </div>
      )}

      {/* Floating Page Badge & Delete Action */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 no-create-box">
        <span className="px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold shadow-xs">
          Page {page.pageNumber} of {totalPages}
          {page.originalPageNumber && page.originalPageNumber !== page.pageNumber && (
            <span className="text-gray-300 ml-1 font-normal font-mono text-[10px]">
              (Doc #{page.originalPageNumber})
            </span>
          )}
        </span>

        {pageDeleteConfirm === page.pageNumber ? (
          <div className="flex items-center gap-1 bg-red-600 text-white rounded-md p-0.5 shadow-md animate-in fade-in">
            <span className="text-[10px] font-bold px-1">Delete page?</span>
            <button
              type="button"
              onClick={() => onConfirmDelete(page.pageNumber)}
              className="px-1.5 py-0.5 rounded bg-white text-red-600 font-bold text-[10px] hover:bg-red-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onSetConfirmDelete(null)}
              className="px-1 py-0.5 text-[10px] hover:text-white/80"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSetConfirmDelete(page.pageNumber)}
            title={`Delete Page ${page.pageNumber}`}
            className="p-1.5 rounded-md bg-black/60 hover:bg-red-600 text-white transition-colors opacity-80 hover:opacity-100 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

interface NoteCanvasProps {
  contentHtml: string;
  onContentChange: (newHtml: string) => void;
  textBoxes?: NoteTextBox[];
  onTextBoxesChange?: (newBoxes: NoteTextBox[]) => void;
  paperStyle?: PaperStyle;
  onPaperStyleChange?: (newStyle: PaperStyle) => void;
  strokes: DrawingStroke[];
  onStrokesChange: (newStrokes: DrawingStroke[]) => void;
  isDrawingMode: boolean;
  onToggleDrawing?: () => void;
  currentTool: DrawingTool;
  eraserType: EraserType;
  thickness: number;
  color: string;
  pdfData?: PdfDocumentData;
  onPdfDataChange?: (newPdf: PdfDocumentData | undefined) => void;
  darkMode?: boolean;
  editorFont?: 'sans' | 'serif' | 'mono';
}

export const NoteCanvas: React.FC<NoteCanvasProps> = ({
  contentHtml,
  onContentChange,
  textBoxes: propTextBoxes,
  onTextBoxesChange,
  paperStyle = 'blank',
  strokes,
  onStrokesChange,
  isDrawingMode,
  onToggleDrawing,
  currentTool,
  eraserType,
  thickness,
  color,
  pdfData,
  onPdfDataChange,
  darkMode = false,
  editorFont = 'sans',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);

  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [showPdfDeleteMenu, setShowPdfDeleteMenu] = useState(false);
  const [selectedPdfPageToDelete, setSelectedPdfPageToDelete] = useState<number>(1);
  const [pageDeleteConfirm, setPageDeleteConfirm] = useState<number | null>(null);
  const [dismissedPdfPrompt, setDismissedPdfPrompt] = useState(false);

  // High page count optimization & range selection states
  const [pdfViewMode, setPdfViewMode] = useState<'continuous' | 'single'>('continuous');
  const [currentActivePdfPage, setCurrentActivePdfPage] = useState<number>(1);
  const [rangeDeleteFrom, setRangeDeleteFrom] = useState<number>(1);
  const [rangeDeleteTo, setRangeDeleteTo] = useState<number>(1);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState<boolean>(false);
  const [importRequest, setImportRequest] = useState<PdfImportRequest | null>(null);
  const [manageRequest, setManageRequest] = useState<PdfManageRequest | null>(null);

  const getInitialBoxes = (): NoteTextBox[] => {
    if (propTextBoxes && propTextBoxes.length > 0) {
      return propTextBoxes;
    }
    return [
      {
        id: 'box_initial',
        x: 48,
        y: 40,
        width: 760,
        content: contentHtml || '<p><br></p>',
      },
    ];
  };

  const [boxes, setBoxes] = useState<NoteTextBox[]>(getInitialBoxes);
  const boxesRef = useRef<NoteTextBox[]>(boxes);
  boxesRef.current = boxes;

  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [draggedBoxId, setDraggedBoxId] = useState<string | null>(null);
  const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);

  useEffect(() => {
    if (propTextBoxes && propTextBoxes.length > 0) {
      setBoxes(propTextBoxes);
      boxesRef.current = propTextBoxes;
    }
  }, [propTextBoxes]);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncBoxes = useCallback(
    (newBoxes: NoteTextBox[]) => {
      setBoxes(newBoxes);
      boxesRef.current = newBoxes;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        if (onTextBoxesChange) {
          onTextBoxesChange(newBoxes);
        } else if (onContentChange) {
          const merged = newBoxes.map((b) => b.content).join('<hr/>');
          onContentChange(merged);
        }
      }, 0);
    },
    [onTextBoxesChange, onContentChange]
  );

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#pdf-delete-menu-container')) {
        setShowPdfDeleteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const redrawAllStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    strokes.forEach((stroke) => {
      renderStrokeToContext(ctx, stroke);
    });
  }, [strokes]);

  const wrapperMinHeight = useMemo(() => {
    let maxY = 1400;
    boxes.forEach((b) => {
      if (b.y + 400 > maxY) maxY = b.y + 400;
    });
    if (pdfData && pdfData.pages.length > 0) {
      if (pdfViewMode === 'single') {
        const activePage = pdfData.pages[currentActivePdfPage - 1] || pdfData.pages[0];
        const estH = activePage
          ? (activePage.height / (activePage.width || 800)) * 800 * (pdfZoom / 100) + 300
          : 1200;
        if (estH > maxY) maxY = estH;
      } else {
        const estimatedPdfHeight = pdfData.pages.length * 1150 * (pdfZoom / 100) + 200;
        if (estimatedPdfHeight > maxY) maxY = estimatedPdfHeight;
      }
    }
    return maxY;
  }, [boxes, pdfData, pdfZoom, pdfViewMode, currentActivePdfPage]);

  const updateCanvasDimensions = useCallback(() => {
    const wrapper = contentWrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    let maxY = Math.max(wrapper.scrollHeight, wrapper.clientHeight, 1400);
    boxes.forEach((b) => {
      if (b.y + 400 > maxY) maxY = b.y + 400;
    });

    const width = wrapper.clientWidth || 900;
    const height = maxY;

    const dpr = window.devicePixelRatio || 1;
    // Guard against browser maximum canvas backing store overflow in Chromium/WebKit (16,384px)
    const maxSafeHeight = Math.floor(16380 / dpr);
    const safeHeight = Math.min(height, maxSafeHeight);

    canvas.width = width * dpr;
    canvas.height = safeHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${safeHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    redrawAllStrokes();
  }, [redrawAllStrokes, boxes]);

  useEffect(() => {
    updateCanvasDimensions();
    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;

    const ro = new ResizeObserver(() => {
      updateCanvasDimensions();
    });
    ro.observe(wrapper);

    window.addEventListener('resize', updateCanvasDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [updateCanvasDimensions, pdfData, pdfZoom, boxes, pdfViewMode, currentActivePdfPage]);

  useEffect(() => {
    redrawAllStrokes();
  }, [strokes, redrawAllStrokes]);

  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode) return;

    const target = e.target as HTMLElement;

    if (
      target.closest('.onenote-box-container') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.no-create-box')
    ) {
      return;
    }

    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = Math.round(e.clientX - rect.left);
    const clickY = Math.round(e.clientY - rect.top);

    const cleanedBoxes = boxesRef.current.filter((b) => {
      const hasImage = b.content.includes('<img');
      const hasCheckbox = b.content.includes('type="checkbox"');
      const textOnly = b.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
      return hasImage || hasCheckbox || textOnly.length > 0;
    });

    const desiredX = Math.max(16, clickX - 10);
    const desiredY = Math.max(16, clickY - 26);

    const availableWidth = wrapper.clientWidth - desiredX - 24;
    const boxWidth = Math.max(280, Math.min(680, availableWidth));
    const finalX = Math.max(16, Math.min(desiredX, wrapper.clientWidth - boxWidth - 16));

    const newId = `box_${Date.now()}`;
    const newBox: NoteTextBox = {
      id: newId,
      x: finalX,
      y: desiredY,
      width: boxWidth,
      content: '<p><br></p>',
    };

    const nextBoxes = [...cleanedBoxes, newBox];
    syncBoxes(nextBoxes);
    setActiveBoxId(newId);

    setTimeout(() => {
      const editorEl = document.getElementById(`textbox_content_${newId}`);
      if (editorEl) {
        editorEl.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 40);
  };

  const handleStartDragBox = (boxId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const targetBox = boxes.find((b) => b.id === boxId);
    if (!targetBox) return;

    setActiveBoxId(boxId);
    setDraggedBoxId(boxId);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startBoxX = targetBox.x;
    const startBoxY = targetBox.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;

      const newX = Math.max(16, startBoxX + deltaX);
      const newY = Math.max(16, startBoxY + deltaY);

      setBoxes((prev) =>
        prev.map((b) => (b.id === boxId ? { ...b, x: newX, y: newY } : b))
      );
    };

    const onMouseUp = () => {
      setDraggedBoxId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      syncBoxes(boxesRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStartResizeBox = (boxId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const targetBox = boxes.find((b) => b.id === boxId);
    if (!targetBox) return;

    setResizingBoxId(boxId);
    const startMouseX = e.clientX;
    const startWidth = targetBox.width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const newWidth = Math.max(220, Math.min(1100, startWidth + deltaX));

      setBoxes((prev) =>
        prev.map((b) => (b.id === boxId ? { ...b, width: newWidth } : b))
      );
    };

    const onMouseUp = () => {
      setResizingBoxId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      syncBoxes(boxesRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDeleteBox = (boxId: string) => {
    const remaining = boxes.filter((b) => b.id !== boxId);
    syncBoxes(remaining);
    setActiveBoxId(null);
  };

  const handleBoxInput = (boxId: string, newHtml: string) => {
    const updated = boxesRef.current.map((b) => (b.id === boxId ? { ...b, content: newHtml } : b));
    setBoxes(updated);
    boxesRef.current = updated;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      if (onTextBoxesChange) {
        onTextBoxesChange(updated);
      } else if (onContentChange) {
        const merged = updated.map((b) => b.content).join('<hr/>');
        onContentChange(merged);
      }
    }, 120);
  };

  const handleBoxClick = (boxId: string, e: React.MouseEvent) => {
    setActiveBoxId(boxId);
    const target = e.target as HTMLElement;
    if (target.matches('input[type="checkbox"]')) {
      const input = target as HTMLInputElement;
      input.setAttribute('checked', input.checked ? 'true' : 'false');
      const container = document.getElementById(`textbox_content_${boxId}`);
      if (container) {
        handleBoxInput(boxId, container.innerHTML);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
    const time = Date.now();

    setIsPointerDown(true);
    canvas.setPointerCapture(e.pointerId);

    if (currentTool === 'eraser') {
      if (eraserType === 'stroke-eraser') {
        eraseStrokeAt(x, y);
      } else {
        eraseSegmentAt(x, y);
      }
      return;
    }

    const newStroke: DrawingStroke = {
      id: `stroke_${Date.now()}_${Math.random()}`,
      tool: currentTool,
      color,
      size: thickness,
      points: [{ x, y, pressure, time }],
    };

    currentStrokeRef.current = newStroke;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderStrokeToContext(ctx, newStroke);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isPointerDown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'eraser') {
      if (eraserType === 'stroke-eraser') {
        eraseStrokeAt(x, y);
      } else {
        eraseSegmentAt(x, y);
      }
      return;
    }

    if (!currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;

    const rawEvents = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];

    rawEvents.forEach((ev) => {
      const ex = ev.clientX - rect.left;
      const ey = ev.clientY - rect.top;
      const epressure = ev.pressure !== undefined && ev.pressure > 0 ? ev.pressure : 0.5;
      const etime = Date.now();
      const last = stroke.points[stroke.points.length - 1];

      if (!last || Math.hypot(ex - last.x, ey - last.y) >= 1) {
        stroke.points.push({ x: ex, y: ey, pressure: epressure, time: etime });
      }
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (stroke.tool === 'highlighter') {
      const pts = stroke.points;
      if (pts.length >= 2) {
        const p1 = pts[pts.length - 2];
        const p2 = pts[pts.length - 1];
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(thickness * 3, 14);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    strokes.forEach((s) => {
      renderStrokeToContext(ctx, s);
    });
    renderStrokeToContext(ctx, stroke);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isPointerDown) return;
    setIsPointerDown(false);

    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const completedStroke: DrawingStroke = {
        ...currentStrokeRef.current,
      };

      const updatedStrokes = [...strokes, completedStroke];
      onStrokesChange(updatedStrokes);
      currentStrokeRef.current = null;

      requestAnimationFrame(() => {
        redrawAllStrokes();
      });
    }
  };

  const eraseStrokeAt = (x: number, y: number) => {
    const radius = Math.max(16, thickness * 2);
    let hitIndex = -1;

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      for (const pt of stroke.points) {
        if (Math.hypot(pt.x - x, pt.y - y) <= radius) {
          hitIndex = i;
          break;
        }
      }
      if (hitIndex !== -1) break;
    }

    if (hitIndex !== -1) {
      const updated = [...strokes];
      updated.splice(hitIndex, 1);
      onStrokesChange(updated);
    }
  };

  const eraseSegmentAt = (x: number, y: number) => {
    const radius = Math.max(10, thickness * 1.5);
    let changed = false;
    const nextStrokes: DrawingStroke[] = [];

    strokes.forEach((stroke) => {
      let currentSegment: DrawingPoint[] = [];

      stroke.points.forEach((pt) => {
        if (Math.hypot(pt.x - x, pt.y - y) <= radius) {
          if (currentSegment.length > 0) {
            nextStrokes.push({
              ...stroke,
              id: `${stroke.id}_seg_${Math.random()}`,
              points: currentSegment,
            });
            currentSegment = [];
          }
          changed = true;
        } else {
          currentSegment.push(pt);
        }
      });

      if (currentSegment.length > 0) {
        nextStrokes.push({ ...stroke, points: currentSegment });
      }
    });

    if (changed) {
      onStrokesChange(nextStrokes);
    }
  };

  const processPdfFile = async (file: File) => {
    try {
      setIsLoadingPdf(true);
      setPdfProgress({ current: 0, total: 1 });
      const processed = await renderPdfPages(file, (current, total) => {
        setPdfProgress({ current, total });
      });
      if (onPdfDataChange) {
        onPdfDataChange(processed);
      }
      setSelectedPdfPageToDelete(1);
      setCurrentActivePdfPage(1);
    } catch (err) {
      console.error('Failed to parse PDF file:', err);
    } finally {
      setIsLoadingPdf(false);
      setPdfProgress(null);
    }
  };

  const handlePdfUpload = async (file: File) => {
    try {
      setIsLoadingPdf(true);
      const meta = await getPdfMetadata(file);
      setIsLoadingPdf(false);
      setImportRequest({ file, totalPages: meta.totalPages });
      setManageRequest(null);
      setIsRangeModalOpen(true);
    } catch (err) {
      console.error('Failed to inspect PDF metadata:', err);
      processPdfFile(file);
    }
  };

  const handleOpenPageManager = () => {
    if (!pdfData) return;
    setManageRequest({ currentPdf: pdfData });
    setImportRequest(null);
    setIsRangeModalOpen(true);
  };

  const handleDeleteSinglePdfPage = (pageNumberToDelete: number) => {
    if (!pdfData) return;

    const remainingPages = pdfData.pages.filter((p) => p.pageNumber !== pageNumberToDelete);

    if (remainingPages.length === 0) {
      if (onPdfDataChange) onPdfDataChange(undefined);
      setShowPdfDeleteMenu(false);
      setPageDeleteConfirm(null);
      return;
    }

    const reindexed = remainingPages.map((p, idx) => ({
      ...p,
      pageNumber: idx + 1,
    }));

    const updatedPdf: PdfDocumentData = {
      ...pdfData,
      totalPages: reindexed.length,
      pages: reindexed,
    };

    if (onPdfDataChange) {
      onPdfDataChange(updatedPdf);
    }
    setShowPdfDeleteMenu(false);
    setPageDeleteConfirm(null);
    setSelectedPdfPageToDelete((prev) => Math.min(prev, reindexed.length));
    setCurrentActivePdfPage((prev) => Math.min(prev, reindexed.length));
  };

  const handleDeletePageRange = (from: number, to: number) => {
    if (!pdfData) return;
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const remainingPages = pdfData.pages.filter((p) => p.pageNumber < start || p.pageNumber > end);

    if (remainingPages.length === 0) {
      if (onPdfDataChange) onPdfDataChange(undefined);
      setShowPdfDeleteMenu(false);
      return;
    }

    const reindexed = remainingPages.map((p, idx) => ({
      ...p,
      pageNumber: idx + 1,
    }));

    const updatedPdf: PdfDocumentData = {
      ...pdfData,
      totalPages: reindexed.length,
      pages: reindexed,
    };

    if (onPdfDataChange) {
      onPdfDataChange(updatedPdf);
    }
    setShowPdfDeleteMenu(false);
    setCurrentActivePdfPage((prev) => Math.min(prev, reindexed.length));
    setSelectedPdfPageToDelete(1);
  };

  const handleDeleteAllPdfPages = () => {
    if (onPdfDataChange) {
      onPdfDataChange(undefined);
    }
    setShowPdfDeleteMenu(false);
    setPageDeleteConfirm(null);
  };

  const handleJumpToPage = (pageNum: number) => {
    if (!pdfData) return;
    const page = Math.max(1, Math.min(pageNum, pdfData.totalPages));
    setCurrentActivePdfPage(page);
    if (pdfViewMode === 'continuous') {
      const el = document.getElementById(`pdf-page-${page}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        handlePdfUpload(file);
      }
    }
  };

  const paperClass =
    paperStyle === 'ruled'
      ? 'paper-ruled'
      : paperStyle === 'grid'
      ? 'paper-grid'
      : '';

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 w-full overflow-y-auto overflow-x-auto min-h-[600px] transition-colors select-auto ${paperClass} ${
        darkMode ? 'bg-[#18181b] text-zinc-100' : 'bg-white text-gray-900'
      }`}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-500/15 dark:bg-purple-950/60 backdrop-blur-xs border-2 border-dashed border-purple-500 rounded-2xl pointer-events-none m-3">
          <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 mb-2 animate-bounce">
            <Upload className="w-8 h-8" />
          </div>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
            Drop PDF here to embed into note
          </p>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Pages will be embedded and ready to write & draw on
          </p>
        </div>
      )}

      {isLoadingPdf && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xs">
          <div className="w-12 h-12 border-4 border-purple-200 dark:border-zinc-700 border-t-purple-600 rounded-full animate-spin mb-3" />
          <h4 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Processing PDF Document...
          </h4>
          {pdfProgress && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Rendering page {pdfProgress.current} of {pdfProgress.total}
            </p>
          )}
        </div>
      )}

      <div
        ref={contentWrapperRef}
        id="note-page-content-wrapper"
        data-paper-style={paperStyle}
        onClick={handleWrapperClick}
        style={{ minHeight: `${wrapperMinHeight}px` }}
        className={`relative w-full p-6 cursor-text select-text ${paperClass}`}
        title={!isDrawingMode ? 'Click anywhere on the page to start writing' : undefined}
      >
        {pdfData && pdfData.pages.length > 0 && (
          <div className="pdf-container relative z-10 max-w-4xl mx-auto mb-10 select-none">
            <div
              className={`pdf-header-controls no-create-box flex flex-col p-3.5 mb-5 rounded-2xl border transition-colors shadow-2xs gap-3 ${
                darkMode
                  ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100'
                  : 'bg-gray-50/95 border-gray-200 text-gray-800'
              }`}
            >
              {/* Row 1: Document details & Primary Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {pdfData.fileName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center flex-wrap gap-1.5">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {pdfData.totalPages} {pdfData.totalPages === 1 ? 'page' : 'pages'}
                      </span>
                      {pdfData.originalTotalPages && pdfData.originalTotalPages > pdfData.totalPages && (
                        <span className="text-[11px] px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
                          Range: {pdfData.selectedRanges || `selected from ${pdfData.originalTotalPages}`}
                        </span>
                      )}
                      <span>•</span>
                      <span>{(pdfData.fileSize / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                </div>

                {/* Right toolbar controls */}
                <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                  {/* Select / Manage Pages Range Button */}
                  <button
                    type="button"
                    onClick={handleOpenPageManager}
                    title="Select, filter, or delete page ranges in this note"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors shadow-2xs"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Select Pages & Ranges</span>
                  </button>

                  {/* Draw on PDF Button */}
                  <button
                    type="button"
                    onClick={() => onToggleDrawing && onToggleDrawing()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs ${
                      isDrawingMode
                        ? 'bg-[#7F56D9] text-white'
                        : darkMode
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                        : 'bg-white hover:bg-purple-50 text-[#7F56D9] border border-purple-200'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{isDrawingMode ? 'Drawing Active' : 'Draw on PDF'}</span>
                  </button>

                  {/* Zoom controls */}
                  <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPdfZoom((z) => Math.max(60, z - 15))}
                      title="Zoom out PDF"
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-zinc-300"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold px-1.5 min-w-[38px] text-center text-gray-700 dark:text-zinc-300">
                      {pdfZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdfZoom((z) => Math.min(140, z + 15))}
                      title="Zoom in PDF"
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-zinc-300"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Delete menu container */}
                  <div className="relative inline-block" id="pdf-delete-menu-container">
                    <button
                      id="pdf-delete-options-trigger"
                      type="button"
                      onClick={() => setShowPdfDeleteMenu(!showPdfDeleteMenu)}
                      title="Delete PDF pages..."
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-colors shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete PDF...</span>
                    </button>

                    {showPdfDeleteMenu && (
                      <div
                        className={`absolute right-0 top-9 z-50 w-80 p-3.5 rounded-2xl border shadow-xl animate-in fade-in zoom-in-95 ${
                          darkMode
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                            : 'bg-white border-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-900 dark:text-white mb-2 pb-1.5 border-b border-gray-100 dark:border-zinc-700">
                          Delete PDF Options
                        </div>

                        {/* 1. Delete single page */}
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-700/50 mb-2">
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1.5 flex items-center justify-between">
                            <span>Delete Specific Page</span>
                            <span className="text-[10px] text-gray-500">1 of {pdfData.totalPages}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedPdfPageToDelete}
                              onChange={(e) => setSelectedPdfPageToDelete(Number(e.target.value))}
                              className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200"
                            >
                              {pdfData.pages.map((p) => (
                                <option key={p.pageNumber} value={p.pageNumber}>
                                  Page {p.pageNumber}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleDeleteSinglePdfPage(selectedPdfPageToDelete)}
                              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* 2. Delete range of pages */}
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-700/50 mb-2.5">
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1.5">
                            Delete Page Range
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-gray-500">From</span>
                            <input
                              type="number"
                              min={1}
                              max={pdfData.totalPages}
                              value={rangeDeleteFrom}
                              onChange={(e) => setRangeDeleteFrom(parseInt(e.target.value, 10) || 1)}
                              className="w-12 px-1.5 py-1 text-xs text-center rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                            />
                            <span className="text-[11px] text-gray-500">To</span>
                            <input
                              type="number"
                              min={1}
                              max={pdfData.totalPages}
                              value={rangeDeleteTo}
                              onChange={(e) => setRangeDeleteTo(parseInt(e.target.value, 10) || pdfData.totalPages)}
                              className="w-12 px-1.5 py-1 text-xs text-center rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePageRange(rangeDeleteFrom, rangeDeleteTo)}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold ml-auto transition-colors"
                            >
                              Delete Range
                            </button>
                          </div>
                        </div>

                        {/* 3. Delete all pages */}
                        <button
                          type="button"
                          onClick={handleDeleteAllPdfPages}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-left bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete All Pages (Remove PDF)</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPdfDeleteMenu(false)}
                          className="w-full mt-2 text-center text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Page Navigation Bar & View Mode Switcher */}
              <div
                className={`pt-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
                  darkMode ? 'border-zinc-700/70 text-zinc-300' : 'border-gray-200/80 text-gray-700'
                }`}
              >
                {/* Page Navigation & Jump */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleJumpToPage(currentActivePdfPage - 1)}
                      disabled={currentActivePdfPage <= 1}
                      title="Previous page"
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 rounded text-gray-600 dark:text-zinc-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center px-2 gap-1.5 font-medium">
                      <span>Page</span>
                      <select
                        value={currentActivePdfPage}
                        onChange={(e) => handleJumpToPage(Number(e.target.value))}
                        className="font-bold text-purple-600 dark:text-purple-400 bg-transparent outline-hidden cursor-pointer"
                      >
                        {pdfData.pages.map((p) => (
                          <option key={p.pageNumber} value={p.pageNumber}>
                            {p.pageNumber}
                          </option>
                        ))}
                      </select>
                      <span>of {pdfData.totalPages}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJumpToPage(currentActivePdfPage + 1)}
                      disabled={currentActivePdfPage >= pdfData.totalPages}
                      title="Next page"
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 rounded text-gray-600 dark:text-zinc-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {pdfData.totalPages > 10 && (
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 hidden sm:inline">
                      (Smooth 60fps virtualization active)
                    </span>
                  )}
                </div>

                {/* View Mode Toggle: Continuous vs Single Page Focus */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400">View:</span>
                  <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPdfViewMode('continuous')}
                      title="Continuous Scroll Mode"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        pdfViewMode === 'continuous'
                          ? 'bg-[#7F56D9] text-white shadow-2xs'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
                      }`}
                    >
                      <Scroll className="w-3 h-3" />
                      <span>Continuous</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfViewMode('single')}
                      title="Single Page Focus Mode"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        pdfViewMode === 'single'
                          ? 'bg-[#7F56D9] text-white shadow-2xs'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
                      }`}
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Single Page</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Optimized PDF Pages Stack */}
            <div className="pdf-pages-stack flex flex-col items-center gap-6">
              {pdfViewMode === 'single' ? (
                // Single Page Mode: only renders active page
                pdfData.pages[currentActivePdfPage - 1] ? (
                  <LazyPdfPageItem
                    key={pdfData.pages[currentActivePdfPage - 1].pageNumber}
                    page={pdfData.pages[currentActivePdfPage - 1]}
                    totalPages={pdfData.totalPages}
                    pdfZoom={pdfZoom}
                    pageDeleteConfirm={pageDeleteConfirm}
                    onConfirmDelete={handleDeleteSinglePdfPage}
                    onSetConfirmDelete={setPageDeleteConfirm}
                    darkMode={darkMode}
                  />
                ) : null
              ) : (
                // Continuous Mode: renders all pages using LazyPdfPageItem (IntersectionObserver)
                pdfData.pages.map((page) => (
                  <LazyPdfPageItem
                    key={page.pageNumber}
                    page={page}
                    totalPages={pdfData.totalPages}
                    pdfZoom={pdfZoom}
                    pageDeleteConfirm={pageDeleteConfirm}
                    onConfirmDelete={handleDeleteSinglePdfPage}
                    onSetConfirmDelete={setPageDeleteConfirm}
                    darkMode={darkMode}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {(!pdfData || pdfData.pages.length === 0) &&
          !dismissedPdfPrompt &&
          !boxes.some((b) => b.content.replace(/<[^>]*>/g, '').trim().length > 0) && (
            <div className="max-w-2xl mx-auto mb-6 select-none no-create-box">
              <div
                className={`p-3 rounded-xl border border-dashed flex items-center justify-between gap-3 transition-colors ${
                  darkMode
                    ? 'border-zinc-700/80 bg-zinc-800/30 text-zinc-300'
                    : 'border-purple-200 bg-purple-50/20 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-[#7F56D9] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate text-xs">
                    <span className={`font-semibold ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>
                      Embed PDF Document
                    </span>
                    <span className="hidden sm:inline text-gray-400 dark:text-zinc-500 ml-1.5">
                      — Drag & drop or upload any PDF to annotate and draw on
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-600" />
                    <span>Upload PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedPdfPrompt(true);
                    }}
                    title="Dismiss hint"
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200/50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="absolute inset-0 pointer-events-none z-20">
          {boxes.map((box) => (
            <OneNoteTextBoxView
              key={box.id}
              box={box}
              isActive={activeBoxId === box.id}
              isDragging={draggedBoxId === box.id}
              isResizing={resizingBoxId === box.id}
              isDrawingMode={isDrawingMode}
              darkMode={darkMode}
              editorFont={editorFont}
              onSelect={() => setActiveBoxId(box.id)}
              onStartDrag={(e) => handleStartDragBox(box.id, e)}
              onStartResize={(e) => handleStartResizeBox(box.id, e)}
              onDelete={() => handleDeleteBox(box.id)}
              onChangeContent={(html) => handleBoxInput(box.id, html)}
              onClickContainer={(e) => {
                e.stopPropagation();
                handleBoxClick(box.id, e);
              }}
            />
          ))}
        </div>

        <canvas
          ref={canvasRef}
          id="note-drawing-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            touchAction: 'none',
            cursor: isDrawingMode ? getDrawingCursor(currentTool, eraserType, thickness) : 'default',
          }}
          className={`absolute inset-0 w-full h-full ${
            isDrawingMode
              ? 'pointer-events-auto z-30 select-none'
              : 'pointer-events-none z-10'
          }`}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handlePdfUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* PDF Page Range Selection & Document Management Modal */}
      <PdfPageRangeModal
        isOpen={isRangeModalOpen}
        onClose={() => {
          setIsRangeModalOpen(false);
          setImportRequest(null);
          setManageRequest(null);
        }}
        importRequest={importRequest}
        onImportComplete={(newPdf) => {
          if (onPdfDataChange) onPdfDataChange(newPdf);
          setSelectedPdfPageToDelete(1);
          setCurrentActivePdfPage(1);
        }}
        manageRequest={manageRequest}
        onManageComplete={(updatedPdf) => {
          if (onPdfDataChange) onPdfDataChange(updatedPdf);
          setSelectedPdfPageToDelete(1);
          setCurrentActivePdfPage(1);
        }}
        darkMode={darkMode}
      />
    </div>
  );
};

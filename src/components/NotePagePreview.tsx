import React, { useRef, useEffect, useState, useMemo } from 'react';
import { NoteItem, DrawingStroke, DrawingPoint } from '../types';
import { getStroke } from 'perfect-freehand';
import { FileText } from 'lucide-react';

interface NotePagePreviewProps {
  note: NoteItem;
  darkMode?: boolean;
  className?: string;
  fitMode?: 'fit-all' | 'fit-width';
  onOpenNote?: () => void;
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

function renderStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  darkMode: boolean
) {
  if (!stroke.points || stroke.points.length === 0) return;

  const rawPts = stroke.points;
  const isHighlighter = stroke.tool === 'highlighter';

  ctx.save();

  if (isHighlighter) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = Math.max(stroke.size * 2.8, 12);

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

  // Pen stroke
  let strokeColor = stroke.color;
  // If in dark mode and stroke was black/dark, brighten slightly for visibility
  if (darkMode && (strokeColor === '#111111' || strokeColor === '#000000' || strokeColor === '#1f2937')) {
    strokeColor = '#E2E8F0';
  } else if (!darkMode && (strokeColor === '#FFFFFF' || strokeColor === '#F8FAFC')) {
    strokeColor = '#1E293B';
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = strokeColor;
  ctx.strokeStyle = strokeColor;
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

  try {
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
  } catch {
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cleanPts[0].x, cleanPts[0].y);
    for (let i = 1; i < cleanPts.length; i++) {
      ctx.lineTo(cleanPts[i].x, cleanPts[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export const NotePagePreview: React.FC<NotePagePreviewProps> = ({
  note,
  darkMode = false,
  className = '',
  fitMode = 'fit-width',
  onOpenNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 300, height: 200 });

  // Calculate bounding extent of all note content to determine virtual page size
  const { docWidth, docHeight } = useMemo(() => {
    let maxX = 760;
    let maxY = 500;

    // 1. Text boxes
    if (note.textBoxes && note.textBoxes.length > 0) {
      note.textBoxes.forEach((b) => {
        const estH = Math.max(120, (b.content.length || 50) * 0.8);
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + estH > maxY) maxY = b.y + estH;
      });
    }

    // 2. Drawing strokes
    if (note.strokes && note.strokes.length > 0) {
      note.strokes.forEach((s) => {
        (s.points || []).forEach((pt) => {
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        });
      });
    }

    // 3. PDF Pages (limit preview to first 2 pages for high performance)
    if (note.pdfData && note.pdfData.pages.length > 0) {
      const previewPageCount = Math.min(2, note.pdfData.pages.length);
      const pdfEstimatedH = previewPageCount * 1050 + 100;
      if (pdfEstimatedH > maxY) maxY = pdfEstimatedH;
    }

    const calculatedW = Math.max(780, maxX + 36);
    const calculatedH = Math.max(520, maxY + 40);

    return { docWidth: calculatedW, docHeight: calculatedH };
  }, [note]);

  // Track container size using ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute scale
  const scale = useMemo(() => {
    if (containerSize.width <= 0) return 0.35;
    if (fitMode === 'fit-all') {
      const scaleX = containerSize.width / docWidth;
      const scaleY = containerSize.height / docHeight;
      return Math.min(scaleX, scaleY);
    }
    // fit-width: scale so full page width fits nicely in container, allowing vertical scroll
    return containerSize.width / docWidth;
  }, [containerSize, docWidth, docHeight, fitMode]);

  // Redraw strokes on the overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = docWidth * dpr;
    canvas.height = docHeight * dpr;
    canvas.style.width = `${docWidth}px`;
    canvas.style.height = `${docHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, docWidth, docHeight);

    if (note.strokes && note.strokes.length > 0) {
      note.strokes.forEach((stroke) => {
        renderStrokeToContext(ctx, stroke, darkMode);
      });
    }

    ctx.restore();
  }, [note.strokes, docWidth, docHeight, darkMode]);

  const paperClass =
    note.paperStyle === 'ruled'
      ? 'paper-ruled'
      : note.paperStyle === 'grid'
      ? 'paper-grid'
      : '';

  const hasBoxes = note.textBoxes && note.textBoxes.length > 0;
  const hasContent = note.content && note.content.replace(/<[^>]*>?/gm, '').trim().length > 0;
  const hasStrokes = note.strokes && note.strokes.length > 0;
  const hasPdf = note.pdfData && note.pdfData.pages.length > 0;
  const isEmpty = !hasBoxes && !hasContent && !hasStrokes && !hasPdf;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-y-auto overflow-x-hidden select-none cursor-default ${className}`}
      style={{
        scrollbarWidth: 'thin',
      }}
    >
      {/* Outer Scaler Wrapper */}
      <div
        style={{
          width: `${docWidth * scale}px`,
          height: `${docHeight * scale}px`,
          minWidth: `${docWidth * scale}px`,
          minHeight: `${docHeight * scale}px`,
          position: 'relative',
        }}
      >
        {/* Virtual Page Container (scaled) */}
        <div
          style={{
            width: `${docWidth}px`,
            height: `${docHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          className={`relative rounded-xl shadow-xs border transition-colors ${
            darkMode ? 'bg-[#18181b] border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
          } ${paperClass}`}
        >
          {/* 1. PDF Pages Stack (if embedded, optimized preview of up to 2 pages) */}
          {hasPdf && (
            <div className="pdf-preview-stack flex flex-col items-center gap-4 pt-4 px-4 pointer-events-none">
              {note.pdfData!.pages.slice(0, 2).map((page) => (
                <div
                  key={page.pageNumber}
                  className="w-full max-w-[720px] rounded-xl overflow-hidden shadow-xs border border-zinc-200 dark:border-zinc-700 bg-white"
                >
                  <img
                    src={page.dataUrl}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full h-auto block"
                    draggable={false}
                    loading="lazy"
                  />
                </div>
              ))}
              {note.pdfData!.pages.length > 2 && (
                <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold">
                  +{note.pdfData!.pages.length - 2} more {note.pdfData!.pages.length - 2 === 1 ? 'page' : 'pages'}
                </div>
              )}
            </div>
          )}

          {/* 2. Text Boxes (written content in exact positions) */}
          {hasBoxes ? (
            <div className="absolute inset-0 pointer-events-none">
              {note.textBoxes!.map((box) => (
                <div
                  key={box.id}
                  style={{
                    position: 'absolute',
                    left: `${box.x}px`,
                    top: `${box.y}px`,
                    width: `${box.width}px`,
                    fontFamily: box.fontFamily,
                    fontSize: box.fontSize,
                  }}
                  className="onenote-text-editor p-2 leading-relaxed text-zinc-900 dark:text-zinc-100"
                  dangerouslySetInnerHTML={{ __html: box.content }}
                />
              ))}
            </div>
          ) : hasContent ? (
            /* Fallback single content view if no textBoxes */
            <div
              style={{
                position: 'absolute',
                left: '28px',
                top: '28px',
                width: `${docWidth - 56}px`,
              }}
              className="onenote-text-editor p-2 leading-relaxed text-zinc-900 dark:text-zinc-100 pointer-events-none"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          ) : null}

          {/* 3. Empty Note Watermark */}
          {isEmpty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-zinc-400 dark:text-zinc-600">
              <FileText className="w-12 h-12 stroke-1 mb-2 opacity-40" />
              <span className="text-sm font-medium">Empty Note Page</span>
              <span className="text-xs opacity-60">Write or draw on this note</span>
            </div>
          )}

          {/* 4. Overlay Drawing Canvas (strokes drawn over text & pages) */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-20"
          />
        </div>
      </div>
    </div>
  );
};

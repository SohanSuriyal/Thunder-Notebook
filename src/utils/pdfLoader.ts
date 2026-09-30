// Polyfill Promise.withResolvers for PDF.js compatibility across all environments
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import * as pdfjsLib from 'pdfjs-dist';
import { PdfDocumentData, PdfDocumentPage } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export type RenderedPdfPage = PdfDocumentPage;
export type ProcessedPdf = PdfDocumentData;

export interface PdfMetadata {
  fileName: string;
  fileSize: number;
  totalPages: number;
}

export interface RenderPdfOptions {
  pageNumbers?: number[]; // 1-based page numbers to extract/render
  scale?: number; // defaults to 1.4 for high-clarity & low memory
  quality?: number; // defaults to 0.85 for JPEG compression (85-90% smaller than PNG)
  onProgress?: (current: number, total: number, pageNum: number) => void;
}

/**
 * Quickly inspects a PDF file and extracts document metadata without rendering pages
 */
export async function getPdfMetadata(file: File): Promise<PdfMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  return {
    fileName: file.name,
    fileSize: file.size,
    totalPages: pdf.numPages,
  };
}

/**
 * Parses user input like "1-5, 8, 10-12" or "all", "odd", "even"
 * into an array of 1-based page numbers [1, 2, 3, 4, 5, 8, 10, 11, 12]
 */
export function parsePageRangeString(
  rangeStr: string,
  totalPages: number
): { pages: number[]; error?: string } {
  if (!rangeStr || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all') {
    return { pages: Array.from({ length: totalPages }, (_, i) => i + 1) };
  }

  const trimmed = rangeStr.trim().toLowerCase();
  if (trimmed === 'odd') {
    return { pages: Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1) };
  }
  if (trimmed === 'even') {
    return { pages: Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0) };
  }

  const parts = rangeStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const selectedSet = new Set<number>();
  let hasInvalid = false;
  let outOfBounds = false;

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        hasInvalid = true;
        continue;
      }
      for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
        selectedSet.add(p);
      }
      if (end > totalPages || start > totalPages) {
        outOfBounds = true;
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 1) {
        hasInvalid = true;
        continue;
      }
      if (num <= totalPages) {
        selectedSet.add(num);
      } else {
        outOfBounds = true;
      }
    }
  }

  const sortedPages = Array.from(selectedSet).sort((a, b) => a - b);
  let errorMsg: string | undefined;

  if (hasInvalid && sortedPages.length === 0) {
    errorMsg = `Invalid range. Use format e.g. "1-5, 8, 10-15"`;
  } else if (outOfBounds && sortedPages.length === 0) {
    errorMsg = `Page numbers exceed document total (${totalPages} pages)`;
  }

  return {
    pages: sortedPages,
    error: errorMsg,
  };
}

/**
 * Formats an array of page numbers e.g. [1, 2, 3, 5, 8, 9, 10] into "1-3, 5, 8-10"
 */
export function formatPageRangeString(pageNumbers: number[]): string {
  if (!pageNumbers || pageNumbers.length === 0) return '';
  const sorted = Array.from(new Set(pageNumbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
      rangeStart = curr;
      prev = curr;
    }
  }
  ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
  return ranges.join(', ');
}

/**
 * Loads a PDF file and renders selected pages to high-resolution, memory-optimized image data URLs.
 * Uses JPEG compression at ~0.85 quality and scalable canvas dimensions to prevent tab freezing
 * and browser memory bloat on large documents.
 */
export async function renderPdfPages(
  file: File,
  optionsOrProgress?: RenderPdfOptions | ((current: number, total: number) => void)
): Promise<PdfDocumentData> {
  const options: RenderPdfOptions =
    typeof optionsOrProgress === 'function'
      ? { onProgress: (c, t) => optionsOrProgress(c, t) }
      : optionsOrProgress || {};

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const originalTotalPages = pdf.numPages;

  // Determine which pages to render
  let targetPageNumbers = options.pageNumbers;
  if (!targetPageNumbers || targetPageNumbers.length === 0) {
    targetPageNumbers = Array.from({ length: originalTotalPages }, (_, i) => i + 1);
  } else {
    // Validate bounds
    targetPageNumbers = Array.from(new Set(targetPageNumbers))
      .filter((p) => p >= 1 && p <= originalTotalPages)
      .sort((a, b) => a - b);
  }

  // Adjust scale: for high page count (>15 pages), default to 1.35x for ultra fast loading and 60fps scrolling
  const renderScale = options.scale || (targetPageNumbers.length > 20 ? 1.3 : 1.45);
  const quality = options.quality ?? 0.85;

  const pages: PdfDocumentPage[] = [];
  const totalToRender = targetPageNumbers.length;

  for (let idx = 0; idx < totalToRender; idx++) {
    const originalPageNum = targetPageNumbers[idx];
    const page = await pdf.getPage(originalPageNum);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    if (ctx) {
      // White background for documents
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      } as any).promise;

      // JPEG compression provides 10-15x memory reduction over raw PNG while keeping text super crisp
      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      pages.push({
        pageNumber: idx + 1, // Sequential index in current note
        originalPageNumber: originalPageNum, // Original PDF page index
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      });
    }

    if (options.onProgress) {
      options.onProgress(idx + 1, totalToRender, originalPageNum);
    }

    // Yield control to the browser's event loop every page to prevent freezing & allow UI updates
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const selectedRanges = formatPageRangeString(targetPageNumbers);

  return {
    fileName: file.name,
    fileSize: file.size,
    totalPages: pages.length,
    originalTotalPages,
    selectedRanges,
    pages,
    uploadedAt: Date.now(),
  };
}

/**
 * Creates a sample high-resolution lecture PDF note (2 pages) about Database Management Systems
 */
export function createSamplePdfData(): PdfDocumentData {
  const pages: PdfDocumentPage[] = [];

  // Page 1: Relational Algebra & Query Optimization
  const c1 = document.createElement('canvas');
  c1.width = 1200;
  c1.height = 1650;
  const ctx1 = c1.getContext('2d');
  if (ctx1) {
    ctx1.fillStyle = '#ffffff';
    ctx1.fillRect(0, 0, 1200, 1650);

    ctx1.fillStyle = '#7F56D9';
    ctx1.fillRect(80, 70, 6, 60);

    ctx1.fillStyle = '#6941C6';
    ctx1.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('CS 348: DATABASE MANAGEMENT SYSTEMS', 105, 95);

    ctx1.fillStyle = '#111827';
    ctx1.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('Lecture 6: Relational Algebra & Queries', 105, 130);

    ctx1.fillStyle = '#6B7280';
    ctx1.font = '18px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('Unit: Core Relational Operators  •  Prof. Vance  •  Fall Semester', 80, 180);

    ctx1.strokeStyle = '#E5E7EB';
    ctx1.lineWidth = 2;
    ctx1.beginPath();
    ctx1.moveTo(80, 205);
    ctx1.lineTo(1120, 205);
    ctx1.stroke();

    ctx1.fillStyle = '#111827';
    ctx1.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('1. Fundamental Relational Operators', 80, 255);

    const operators = [
      { sym: 'σ (Sigma)', name: 'Selection', desc: 'Filters rows that satisfy predicate: σ_{salary > 50000}(Instructor)' },
      { sym: 'π (Pi)', name: 'Projection', desc: 'Selects specified columns and eliminates duplicates: π_{name, title}(Course)' },
      { sym: '⨯ (Cross)', name: 'Cartesian Product', desc: 'Combines every tuple of R with every tuple of S: R ⨯ S' },
      { sym: '∪ (Union)', name: 'Set Union', desc: 'Tuples in relation R or in relation S (must be union-compatible): R ∪ S' },
      { sym: '– (Minus)', name: 'Set Difference', desc: 'Tuples in R but NOT in S: R – S' },
    ];

    let y = 300;
    operators.forEach((op) => {
      ctx1.fillStyle = '#F9FAFB';
      ctx1.strokeStyle = '#E5E7EB';
      ctx1.lineWidth = 1.5;
      ctx1.beginPath();
      ctx1.roundRect(80, y, 1040, 68, 10);
      ctx1.fill();
      ctx1.stroke();

      ctx1.fillStyle = '#EDE9FE';
      ctx1.beginPath();
      ctx1.roundRect(95, y + 10, 140, 48, 8);
      ctx1.fill();

      ctx1.fillStyle = '#6941C6';
      ctx1.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx1.fillText(op.sym, 110, y + 40);

      ctx1.fillStyle = '#111827';
      ctx1.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx1.fillText(op.name, 255, y + 32);

      ctx1.fillStyle = '#4B5563';
      ctx1.font = '16px "Plus Jakarta Sans", sans-serif';
      ctx1.fillText(op.desc, 255, y + 54);

      y += 82;
    });

    ctx1.fillStyle = '#111827';
    ctx1.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('2. Query Execution Tree & Optimization', 80, 750);

    ctx1.fillStyle = '#4B5563';
    ctx1.font = '17px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('Annotate early selection push-down on this canonical query tree:', 80, 785);

    ctx1.fillStyle = '#FAF5FF';
    ctx1.strokeStyle = '#D8B4FE';
    ctx1.lineWidth = 2;
    ctx1.beginPath();
    ctx1.roundRect(80, 810, 1040, 440, 16);
    ctx1.fill();
    ctx1.stroke();

    const drawNode = (text: string, nx: number, ny: number, w = 220, h = 48) => {
      ctx1.fillStyle = '#FFFFFF';
      ctx1.strokeStyle = '#7F56D9';
      ctx1.lineWidth = 2;
      ctx1.beginPath();
      ctx1.roundRect(nx - w / 2, ny - h / 2, w, h, 8);
      ctx1.fill();
      ctx1.stroke();

      ctx1.fillStyle = '#111827';
      ctx1.font = 'bold 16px monospace';
      ctx1.textAlign = 'center';
      ctx1.fillText(text, nx, ny + 5);
      ctx1.textAlign = 'left';
    };

    drawNode('π (name, course_id)', 600, 860, 260);
    drawNode('⨝ (student.id = takes.id)', 600, 960, 300);

    ctx1.strokeStyle = '#9CA3AF';
    ctx1.lineWidth = 2;
    ctx1.beginPath();
    ctx1.moveTo(600, 884);
    ctx1.lineTo(600, 936);
    ctx1.stroke();

    drawNode('σ (gpa >= 3.8)(Student)', 400, 1070, 260);
    drawNode('σ (grade = "A")(Takes)', 800, 1070, 260);

    ctx1.beginPath();
    ctx1.moveTo(540, 984);
    ctx1.lineTo(430, 1046);
    ctx1.moveTo(660, 984);
    ctx1.lineTo(770, 1046);
    ctx1.stroke();

    drawNode('Relation: Student', 400, 1170, 200);
    drawNode('Relation: Takes', 800, 1170, 200);

    ctx1.beginPath();
    ctx1.moveTo(400, 1094);
    ctx1.lineTo(400, 1146);
    ctx1.moveTo(800, 1094);
    ctx1.lineTo(800, 1146);
    ctx1.stroke();

    ctx1.fillStyle = '#6B7280';
    ctx1.font = 'italic 16px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('💡 Tip: Use the Pen or Highlighter tool above to circle projection nodes or trace join order.', 80, 1285);

    ctx1.fillStyle = '#111827';
    ctx1.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('3. Discussion Notes & Formulas (Draw or Annotate Below)', 80, 1340);

    ctx1.fillStyle = '#F3F4F6';
    ctx1.strokeStyle = '#E5E7EB';
    ctx1.lineWidth = 1;
    ctx1.beginPath();
    ctx1.roundRect(80, 1365, 1040, 200, 12);
    ctx1.fill();
    ctx1.stroke();

    ctx1.strokeStyle = '#E5E7EB';
    for (let ly = 1410; ly < 1550; ly += 40) {
      ctx1.beginPath();
      ctx1.moveTo(110, ly);
      ctx1.lineTo(1090, ly);
      ctx1.stroke();
    }

    ctx1.fillStyle = '#9CA3AF';
    ctx1.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx1.fillText('CS 348 Database Systems  •  Lecture 6 Handout  •  Page 1 of 2', 80, 1610);
    ctx1.textAlign = 'right';
    ctx1.fillText('Confidential Course Material', 1120, 1610);
    ctx1.textAlign = 'left';

    pages.push({
      pageNumber: 1,
      dataUrl: c1.toDataURL('image/jpeg', 0.88),
      width: 1200,
      height: 1650,
    });
  }

  // Page 2: Transactions & ACID Handout
  const c2 = document.createElement('canvas');
  c2.width = 1200;
  c2.height = 1650;
  const ctx2 = c2.getContext('2d');
  if (ctx2) {
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, 1200, 1650);

    ctx2.fillStyle = '#12B76A';
    ctx2.fillRect(80, 70, 6, 60);

    ctx2.fillStyle = '#027A48';
    ctx2.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('CS 348: DATABASE MANAGEMENT SYSTEMS', 105, 95);

    ctx2.fillStyle = '#111827';
    ctx2.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('Lecture 7: Transactions & ACID Properties', 105, 130);

    ctx2.strokeStyle = '#E5E7EB';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.moveTo(80, 180);
    ctx2.lineTo(1120, 180);
    ctx2.stroke();

    ctx2.fillStyle = '#111827';
    ctx2.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('1. The Four ACID Guarantees', 80, 230);

    const acidList = [
      { letter: 'A', name: 'Atomicity', text: 'All or nothing: Either all operations in transaction succeed, or state is rolled back.' },
      { letter: 'C', name: 'Consistency', text: 'Preserves database integrity constraints (e.g. balances cannot be negative).' },
      { letter: 'I', name: 'Isolation', text: 'Execution of multiple transactions produces same result as serial order.' },
      { letter: 'D', name: 'Durability', text: 'Once committed, changes survive power failure or crash (Write-Ahead Logging).' },
    ];

    let ay = 265;
    acidList.forEach((item) => {
      ctx2.fillStyle = '#F8FAFC';
      ctx2.strokeStyle = '#E2E8F0';
      ctx2.lineWidth = 1.5;
      ctx2.beginPath();
      ctx2.roundRect(80, ay, 1040, 80, 10);
      ctx2.fill();
      ctx2.stroke();

      ctx2.fillStyle = '#027A48';
      ctx2.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
      ctx2.fillText(item.letter, 105, ay + 52);

      ctx2.fillStyle = '#0F172A';
      ctx2.font = 'bold 19px "Plus Jakarta Sans", sans-serif';
      ctx2.fillText(item.name, 160, ay + 36);

      ctx2.fillStyle = '#475569';
      ctx2.font = '16px "Plus Jakarta Sans", sans-serif';
      ctx2.fillText(item.text, 160, ay + 62);

      ay += 95;
    });

    ctx2.fillStyle = '#111827';
    ctx2.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('2. Interactive Exercise: Conflict Serializability Schedule', 80, 690);

    ctx2.fillStyle = '#4B5563';
    ctx2.font = '17px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('Use the Pen tool to draw directed conflict edges between T1, T2, and T3:', 80, 725);

    ctx2.fillStyle = '#FFFFFF';
    ctx2.strokeStyle = '#CBD5E1';
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    ctx2.roundRect(80, 750, 1040, 360, 12);
    ctx2.fill();
    ctx2.stroke();

    ctx2.fillStyle = '#F1F5F9';
    ctx2.beginPath();
    ctx2.roundRect(80, 750, 1040, 48, [12, 12, 0, 0]);
    ctx2.fill();

    ctx2.fillStyle = '#334155';
    ctx2.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('Step', 110, 780);
    ctx2.fillText('Transaction T1', 300, 780);
    ctx2.fillText('Transaction T2', 580, 780);
    ctx2.fillText('Transaction T3', 860, 780);

    const steps = [
      { step: '1', t1: 'Read(A)', t2: '', t3: '' },
      { step: '2', t1: '', t2: 'Read(B)', t3: '' },
      { step: '3', t1: 'Write(A)', t2: '', t3: '' },
      { step: '4', t1: '', t2: 'Write(A)  [CONFLICT]', t3: '' },
      { step: '5', t1: '', t2: '', t3: 'Read(A)' },
      { step: '6', t1: '', t2: 'Commit', t3: 'Commit' },
    ];

    let sy = 830;
    steps.forEach((s) => {
      ctx2.fillStyle = '#64748B';
      ctx2.font = 'bold 15px monospace';
      ctx2.fillText(s.step, 120, sy);

      ctx2.fillStyle = '#1E293B';
      ctx2.font = '16px monospace';
      ctx2.fillText(s.t1, 300, sy);
      ctx2.fillText(s.t2, 580, sy);
      ctx2.fillText(s.t3, 860, sy);

      ctx2.strokeStyle = '#F1F5F9';
      ctx2.beginPath();
      ctx2.moveTo(80, sy + 15);
      ctx2.lineTo(1120, sy + 15);
      ctx2.stroke();

      sy += 45;
    });

    ctx2.fillStyle = '#FEF3C7';
    ctx2.strokeStyle = '#F59E0B';
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    ctx2.roundRect(80, 1140, 1040, 390, 14);
    ctx2.fill();
    ctx2.stroke();

    ctx2.fillStyle = '#92400E';
    ctx2.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('✍️ Graph Workspace: Draw Precedence Graph for T1, T2, and T3', 105, 1175);

    ctx2.fillStyle = '#B45309';
    ctx2.font = '15px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('Test if a cycle exists (T1 → T2 → T3). If acyclic, schedule is conflict serializable.', 105, 1205);

    const drawPlaceholderNode = (name: string, cx: number, cy: number) => {
      ctx2.strokeStyle = '#D97706';
      ctx2.lineWidth = 2;
      ctx2.setLineDash([6, 6]);
      ctx2.beginPath();
      ctx2.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.setLineDash([]);

      ctx2.fillStyle = '#78350F';
      ctx2.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(name, cx, cy + 8);
      ctx2.textAlign = 'left';
    };

    drawPlaceholderNode('T1', 320, 1360);
    drawPlaceholderNode('T2', 600, 1360);
    drawPlaceholderNode('T3', 880, 1360);

    ctx2.fillStyle = '#9CA3AF';
    ctx2.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx2.fillText('CS 348 Database Systems  •  Lecture 7 Handout  •  Page 2 of 2', 80, 1610);
    ctx2.textAlign = 'right';
    ctx2.fillText('Confidential Course Material', 1120, 1610);
    ctx2.textAlign = 'left';

    pages.push({
      pageNumber: 2,
      dataUrl: c2.toDataURL('image/jpeg', 0.88),
      width: 1200,
      height: 1650,
    });
  }

  return {
    fileName: 'CS348_DBMS_Lecture_Handout.pdf',
    fileSize: 245000,
    totalPages: 2,
    pages,
    uploadedAt: Date.now(),
  };
}


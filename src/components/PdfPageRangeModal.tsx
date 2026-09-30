import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  AlertCircle,
  Trash2,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  RotateCcw,
} from 'lucide-react';
import {
  parsePageRangeString,
  formatPageRangeString,
  renderPdfPages,
} from '../utils/pdfLoader';
import { PdfDocumentData } from '../types';

export interface PdfImportRequest {
  file: File;
  totalPages: number;
}

export interface PdfManageRequest {
  currentPdf: PdfDocumentData;
}

interface PdfPageRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Scenario 1: Importing new PDF file
  importRequest?: PdfImportRequest | null;
  onImportComplete?: (pdfData: PdfDocumentData) => void;
  // Scenario 2: Managing existing PDF pages
  manageRequest?: PdfManageRequest | null;
  onManageComplete?: (updatedPdf: PdfDocumentData | undefined) => void;
  darkMode?: boolean;
}

export const PdfPageRangeModal: React.FC<PdfPageRangeModalProps> = ({
  isOpen,
  onClose,
  importRequest,
  onImportComplete,
  manageRequest,
  onManageComplete,
  darkMode = false,
}) => {
  const isImportMode = Boolean(importRequest);
  const totalPages = isImportMode
    ? importRequest?.totalPages || 1
    : manageRequest?.currentPdf.pages.length || 1;

  const fileName = isImportMode
    ? importRequest?.file.name || 'document.pdf'
    : manageRequest?.currentPdf.fileName || 'document.pdf';

  const fileSize = isImportMode
    ? importRequest?.file.size || 0
    : manageRequest?.currentPdf.fileSize || 0;

  // Selected pages state (1-based page indices in current context)
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeInputText, setRangeInputText] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Range quick sliders
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(Math.min(10, totalPages));

  // Performance option
  const [performanceMode, setPerformanceMode] = useState<'balanced' | 'high'>(
    totalPages > 15 ? 'balanced' : 'high'
  );

  // Progress state for rendering
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; pageNum: number } | null>(null);

  // Initial population
  useEffect(() => {
    if (!isOpen) return;

    if (isImportMode && importRequest) {
      // For large PDFs (>20 pages), default to first 15 or 20 pages with clear option to select all or custom
      const initialPages =
        totalPages > 30
          ? Array.from({ length: Math.min(20, totalPages) }, (_, i) => i + 1)
          : Array.from({ length: totalPages }, (_, i) => i + 1);

      setSelectedPages(initialPages);
      setRangeInputText(formatPageRangeString(initialPages));
      setRangeStart(1);
      setRangeEnd(Math.min(totalPages > 30 ? 20 : totalPages, totalPages));
      setPerformanceMode(totalPages > 15 ? 'balanced' : 'high');
      setInputError(null);
    } else if (manageRequest?.currentPdf) {
      const allCurrent = manageRequest.currentPdf.pages.map((p) => p.pageNumber);
      setSelectedPages(allCurrent);
      setRangeInputText(formatPageRangeString(allCurrent));
      setRangeStart(1);
      setRangeEnd(allCurrent.length);
      setInputError(null);
    }
    setIsProcessing(false);
    setProgress(null);
  }, [isOpen, isImportMode, importRequest, manageRequest, totalPages]);

  // Handle text input change
  const handleRangeTextChange = (text: string) => {
    setRangeInputText(text);
    const parsed = parsePageRangeString(text, totalPages);
    if (parsed.error) {
      setInputError(parsed.error);
    } else {
      setInputError(null);
      setSelectedPages(parsed.pages);
      if (parsed.pages.length > 0) {
        setRangeStart(parsed.pages[0]);
        setRangeEnd(parsed.pages[parsed.pages.length - 1]);
      }
    }
  };

  // Quick preset actions
  const applyPreset = (type: 'all' | 'first5' | 'first10' | 'first20' | 'odd' | 'even' | 'clear') => {
    let pages: number[] = [];
    if (type === 'all') {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (type === 'first5') {
      pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1);
    } else if (type === 'first10') {
      pages = Array.from({ length: Math.min(10, totalPages) }, (_, i) => i + 1);
    } else if (type === 'first20') {
      pages = Array.from({ length: Math.min(20, totalPages) }, (_, i) => i + 1);
    } else if (type === 'odd') {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
    } else if (type === 'even') {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    } else if (type === 'clear') {
      pages = [];
    }

    setSelectedPages(pages);
    setRangeInputText(formatPageRangeString(pages));
    setInputError(null);
    if (pages.length > 0) {
      setRangeStart(pages[0]);
      setRangeEnd(pages[pages.length - 1]);
    }
  };

  const handleApplyFromToRange = () => {
    const start = Math.max(1, Math.min(rangeStart, totalPages));
    const end = Math.max(start, Math.min(rangeEnd, totalPages));
    const newPages: number[] = [];
    for (let p = start; p <= end; p++) {
      newPages.push(p);
    }
    setSelectedPages(newPages);
    setRangeInputText(formatPageRangeString(newPages));
    setInputError(null);
  };

  const togglePageSelection = (pageNum: number) => {
    let next: number[];
    if (selectedPages.includes(pageNum)) {
      next = selectedPages.filter((p) => p !== pageNum);
    } else {
      next = [...selectedPages, pageNum].sort((a, b) => a - b);
    }
    setSelectedPages(next);
    setRangeInputText(formatPageRangeString(next));
    setInputError(null);
  };

  // Submit action: Import new PDF
  const handleConfirmImport = async () => {
    if (!importRequest?.file) return;
    if (selectedPages.length === 0) {
      setInputError('Please select at least one page to import.');
      return;
    }

    try {
      setIsProcessing(true);
      const scale = performanceMode === 'high' ? 1.55 : 1.35;
      const quality = performanceMode === 'high' ? 0.88 : 0.82;

      const rendered = await renderPdfPages(importRequest.file, {
        pageNumbers: selectedPages,
        scale,
        quality,
        onProgress: (current, total, pageNum) => {
          setProgress({ current, total, pageNum });
        },
      });

      if (onImportComplete) {
        onImportComplete(rendered);
      }
      onClose();
    } catch (err) {
      console.error('Failed to import selected PDF pages:', err);
      setInputError('Failed to render PDF pages. Please verify the file.');
      setIsProcessing(false);
    }
  };

  // Submit action: Manage existing PDF in note
  const handleConfirmManage = () => {
    if (!manageRequest?.currentPdf) return;

    if (selectedPages.length === 0) {
      // Deleted all pages
      if (onManageComplete) {
        onManageComplete(undefined);
      }
      onClose();
      return;
    }

    const currentPages = manageRequest.currentPdf.pages;
    const keptPages = currentPages
      .filter((p) => selectedPages.includes(p.pageNumber))
      .map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
      }));

    const updated: PdfDocumentData = {
      ...manageRequest.currentPdf,
      totalPages: keptPages.length,
      pages: keptPages,
      selectedRanges: formatPageRangeString(selectedPages),
    };

    if (onManageComplete) {
      onManageComplete(updated);
    }
    onClose();
  };

  // Delete page range action in manage mode
  const handleDeleteRange = (from: number, to: number) => {
    const next = selectedPages.filter((p) => p < from || p > to);
    setSelectedPages(next);
    setRangeInputText(formatPageRangeString(next));
  };

  const formattedFileSize = useMemo(() => {
    if (!fileSize) return '0 KB';
    if (fileSize > 1024 * 1024) {
      return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(fileSize / 1024).toFixed(0)} KB`;
  }, [fileSize]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className={`relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden transition-all ${
          darkMode
            ? 'bg-[#1e1e24] border-zinc-700 text-zinc-100'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
            darkMode ? 'border-zinc-700/80 bg-zinc-800/40' : 'border-gray-100 bg-gray-50/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-[#7F56D9] dark:text-purple-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
              {isImportMode ? <FileText className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className={`text-base font-bold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {isImportMode ? 'Select PDF Pages to Import' : 'Manage Document Pages & Ranges'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 truncate flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-zinc-300">{fileName}</span>
                <span>•</span>
                <span>{totalPages} total pages</span>
                <span>•</span>
                <span>{formattedFileSize}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing State Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs p-6 text-center">
            <div className="w-14 h-14 border-4 border-purple-200 dark:border-purple-950 border-t-[#7F56D9] rounded-full animate-spin mb-4" />
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Optimizing & Rendering Pages...
            </h4>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4 max-w-sm">
              Applying memory optimization for smooth 60fps scrolling and fast drawing.
            </p>

            {progress && (
              <div className="w-full max-w-md bg-gray-100 dark:bg-zinc-800 rounded-xl p-3 border border-gray-200 dark:border-zinc-700">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  <span>
                    Rendering Page {progress.current} of {progress.total}
                  </span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#7F56D9] h-full transition-all duration-150 rounded-full"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5 text-left">
                  Extracting document page #{progress.pageNum}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Optimization Highlight Banner for Large PDFs */}
          {totalPages >= 15 && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 text-xs">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Optimized for Large Documents:</span> This PDF has{' '}
                <strong className="underline decoration-purple-400">{totalPages} pages</strong>. You can
                select specific page ranges (e.g. chapters or lecture sections) to keep your notebook
                ultra-fast, responsive, and lightweight.
              </div>
            </div>
          )}

          {/* Range String Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pdf-range-input"
                className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400"
              >
                Page Range Selection
              </label>
              <span className="text-xs font-semibold text-[#7F56D9] dark:text-purple-400">
                {selectedPages.length} of {totalPages} {totalPages === 1 ? 'page' : 'pages'} selected
              </span>
            </div>

            <div className="relative">
              <input
                id="pdf-range-input"
                type="text"
                value={rangeInputText}
                onChange={(e) => handleRangeTextChange(e.target.value)}
                placeholder={`e.g. 1-10, 15, 20-${Math.min(totalPages, 25)} or "all"`}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors font-medium outline-hidden ${
                  inputError
                    ? 'border-red-400 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
                    : darkMode
                    ? 'border-zinc-700 bg-zinc-800 focus:border-purple-500 text-white'
                    : 'border-gray-300 bg-white focus:border-purple-600 text-gray-900'
                }`}
              />
              {selectedPages.length > 0 && !inputError && (
                <div className="absolute right-3 top-2.5 text-emerald-500 pointer-events-none">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            {inputError ? (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{inputError}</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                Tip: Enter page numbers separated by commas or dashes (e.g.{' '}
                <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 font-mono text-[10px]">
                  1-5, 8, 12-16
                </code>{' '}
                or <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 font-mono text-[10px]">all</code>)
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block">
              Quick Select Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
              >
                All Pages ({totalPages})
              </button>
              {totalPages >= 5 && (
                <button
                  type="button"
                  onClick={() => applyPreset('first5')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  First 5
                </button>
              )}
              {totalPages >= 10 && (
                <button
                  type="button"
                  onClick={() => applyPreset('first10')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  First 10
                </button>
              )}
              {totalPages >= 20 && (
                <button
                  type="button"
                  onClick={() => applyPreset('first20')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  First 20
                </button>
              )}
              <button
                type="button"
                onClick={() => applyPreset('odd')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Odd Pages
              </button>
              <button
                type="button"
                onClick={() => applyPreset('even')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Even Pages
              </button>
              <button
                type="button"
                onClick={() => applyPreset('clear')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-red-600 hover:border-red-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* From - To Range Selector */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              darkMode ? 'bg-zinc-800/40 border-zinc-700' : 'bg-gray-50/80 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-zinc-300">
              <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Select Range Between:</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">From</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
                  className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-bold"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">To</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || totalPages)}
                  className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-bold"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyFromToRange}
                className="px-3 py-1 rounded-lg bg-[#7F56D9] hover:bg-[#6941C6] text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                Apply Range
              </button>
            </div>
          </div>

          {/* Visual Interactive Page Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Visual Page Grid ({selectedPages.length} active)
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="text-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border max-h-56 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 ${
                darkMode ? 'bg-zinc-900/60 border-zinc-700' : 'bg-white border-gray-200'
              }`}
            >
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                const isSelected = selectedPages.includes(pageNum);
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => togglePageSelection(pageNum)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-bold relative ${
                      isSelected
                        ? 'bg-purple-100/80 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 shadow-2xs'
                        : darkMode
                        ? 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-[10px] text-gray-400 font-normal">Page</div>
                    <div className="text-sm font-extrabold">{pageNum}</div>
                    <div className="mt-1">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Performance Mode Switch (for import mode) */}
          {isImportMode && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                darkMode ? 'bg-zinc-800/40 border-zinc-700' : 'bg-gray-50/70 border-gray-200'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                  Performance & Memory Optimization
                </div>
                <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                  {performanceMode === 'balanced'
                    ? 'Recommended: Uses smart JPEG compression for 15x lighter memory and fluid drawing'
                    : 'High Detail: Renders slightly higher pixel resolution (larger memory footprint)'}
                </div>
              </div>

              <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setPerformanceMode('balanced')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    performanceMode === 'balanced'
                      ? 'bg-[#7F56D9] text-white shadow-2xs'
                      : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
                  }`}
                >
                  Balanced (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setPerformanceMode('high')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    performanceMode === 'high'
                      ? 'bg-[#7F56D9] text-white shadow-2xs'
                      : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
                  }`}
                >
                  High Detail
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-t flex-shrink-0 ${
            darkMode ? 'border-zinc-700 bg-zinc-800/40' : 'border-gray-100 bg-gray-50/80'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            {selectedPages.length === 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                No pages selected
              </span>
            ) : (
              <span>
                Ready to {isImportMode ? 'embed' : 'keep'}{' '}
                <strong className="text-purple-600 dark:text-purple-400">
                  {selectedPages.length} {selectedPages.length === 1 ? 'page' : 'pages'}
                </strong>{' '}
                into note
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>

            {isImportMode ? (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isProcessing || selectedPages.length === 0}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#7F56D9] hover:bg-[#6941C6] text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span>Import Selected Pages ({selectedPages.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmManage}
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#7F56D9] hover:bg-[#6941C6] text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span>Save Page Selection ({selectedPages.length})</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  darkMode?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  darkMode = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const modalBody = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all scale-100 ${
          darkMode
            ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmVariant === 'danger'
                  ? darkMode
                    ? 'bg-red-950/60 text-red-400 border border-red-900/50'
                    : 'bg-red-50 text-red-600 border border-red-100'
                  : darkMode
                  ? 'bg-purple-950/60 text-purple-400 border border-purple-900/50'
                  : 'bg-purple-50 text-purple-600 border border-purple-100'
              }`}
            >
              {confirmVariant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-snug">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p
          className={`text-sm leading-relaxed mb-6 ${
            darkMode ? 'text-zinc-400' : 'text-gray-600'
          }`}
        >
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            id="confirm-modal-cancel-btn"
            onClick={onCancel}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
              darkMode
                ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-750 active:bg-zinc-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            id="confirm-modal-confirm-btn"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white active:bg-red-800'
                : 'bg-purple-600 hover:bg-purple-700 text-white active:bg-purple-800'
            }`}
          >
            {confirmVariant === 'danger' && <Trash2 className="w-4 h-4" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalBody, document.body);
  }

  return modalBody;
};

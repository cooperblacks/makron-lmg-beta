import React, { useState } from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';

interface ContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSave: (prompt: string) => void;
  lastNonEmptyPrompt: string;
}

export const ContextModal: React.FC<ContextModalProps> = ({
  isOpen,
  onClose,
  systemPrompt,
  onSave,
  lastNonEmptyPrompt,
}) => {
  const [prompt, setPrompt] = useState(systemPrompt);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(prompt.trim());
    onClose();
  };

  const handleClear = () => {
    setPrompt('');
  };

  const handleReuseLast = () => {
    if (lastNonEmptyPrompt) {
      setPrompt(lastNonEmptyPrompt);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden text-xs">
        {/* Header */}
        <div className="h-11 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Conversation Context</span>
            <span className="text-[10px] text-neutral-400 font-mono">System Prompt</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-neutral-500 text-[11px] leading-relaxed">
            Specify instructions, operational constraints, or persona parameters applied strictly to this conversation's planning and execution.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            placeholder="e.g. Always generate pure TypeScript with full type annotations. Do not use external CSS frameworks."
            className="w-full p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 font-mono text-xs text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:border-neutral-400 dark:focus:border-neutral-600 resize-none leading-relaxed"
          />

          {/* Quick presets */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {lastNonEmptyPrompt && (
                <button
                  type="button"
                  onClick={handleReuseLast}
                  className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline decoration-neutral-300 dark:decoration-neutral-700"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Reuse Last Prompt</span>
                </button>
              )}
              {prompt && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <span className="text-[10px] font-mono text-neutral-400">
              {prompt.length} chars
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
          >
            Apply Context
          </button>
        </div>
      </div>
    </div>
  );
};

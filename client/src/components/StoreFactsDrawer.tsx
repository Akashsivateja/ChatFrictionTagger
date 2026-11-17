import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { StoreFacts } from '../types.ts';

interface StoreFactsDrawerProps {
  isOpen: boolean;
  facts: StoreFacts;
  onSave: (nextFacts: StoreFacts) => void;
  onClose: () => void;
}

export function StoreFactsDrawer({ isOpen, facts, onSave, onClose }: StoreFactsDrawerProps) {
  const [draft, setDraft] = useState<StoreFacts>(facts);

  useEffect(() => {
    setDraft(facts);
  }, [facts, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      deliveryCharge: draft.deliveryCharge.trim(),
      returnWindow: draft.returnWindow.trim(),
      paymentMethods: draft.paymentMethods.trim(),
    });
    onClose();
  };

  const handleClear = () => {
    const empty: StoreFacts = {
      deliveryCharge: '',
      returnWindow: '',
      paymentMethods: '',
    };
    setDraft(empty);
    onSave(empty);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 dark:bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-facts-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto p-6">
        <div>
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2
                id="store-facts-title"
                className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Store Policy Facts
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Optional policy context passed to the analyzer. Suggested replies may only cite facts listed here.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Store Policy Facts"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="store-facts-form" onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="fact-delivery"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Delivery charge
              </label>
              <input
                id="fact-delivery"
                type="text"
                maxLength={300}
                value={draft.deliveryCharge}
                onChange={(e) => setDraft((prev) => ({ ...prev, deliveryCharge: e.target.value }))}
                placeholder="e.g., Flat $5 shipping; free over $60"
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="fact-return"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Return window
              </label>
              <input
                id="fact-return"
                type="text"
                maxLength={300}
                value={draft.returnWindow}
                onChange={(e) => setDraft((prev) => ({ ...prev, returnWindow: e.target.value }))}
                placeholder="e.g., 30-day unworn returns with receipt"
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="fact-payment"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Payment methods
              </label>
              <input
                id="fact-payment"
                type="text"
                maxLength={300}
                value={draft.paymentMethods}
                onChange={(e) => setDraft((prev) => ({ ...prev, paymentMethods: e.target.value }))}
                placeholder="e.g., Visa, Mastercard, Apple Pay, PayPal"
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Leave any field blank if you do not want the model to mention that policy. Settings are saved locally in your browser.
            </div>
          </form>
        </div>

        <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Clear All
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="store-facts-form"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Save Facts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

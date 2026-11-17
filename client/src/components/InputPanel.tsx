import { useMemo, useRef, useState } from 'react';
import { Upload, Play, Trash2, AlertTriangle } from 'lucide-react';
import { MAX_CHAT_LENGTH } from '../types.ts';
import { parseBlankLineChats, parseUploadedChats } from '../utils/chatParser.ts';

interface InputPanelProps {
  rawInput: string;
  onChangeInput: (value: string) => void;
  onAnalyze: (chats: string[]) => void;
  onClearAll: () => void;
  isRunning: boolean;
  hasRows: boolean;
}

export function InputPanel({
  rawInput,
  onChangeInput,
  onAnalyze,
  onClearAll,
  isRunning,
  hasRows,
}: InputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const parsedChats = useMemo(() => parseBlankLineChats(rawInput), [rawInput]);
  const oversizedCount = useMemo(
    () => parsedChats.filter((chat) => chat.length > MAX_CHAT_LENGTH).length,
    [parsedChats]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.csv')) {
      setUploadError('Only .txt and .csv files are supported.');
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const extracted = parseUploadedChats(file.name, text);
      if (extracted.length === 0) {
        setUploadError('No conversations were found in the uploaded file.');
        event.target.value = '';
        return;
      }

      setUploadedFileName(file.name);
      onChangeInput(extracted.join('\n\n'));
    } catch {
      setUploadError('Could not read the selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleAnalyzeClick = () => {
    if (parsedChats.length === 0 || isRunning) return;
    onAnalyze(parsedChats);
  };

  const handleClear = () => {
    setUploadError(null);
    setUploadedFileName(null);
    onClearAll();
  };

  return (
    <section
      id="input-panel"
      aria-labelledby="input-panel-heading"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2
            id="input-panel-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Conversation Input
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Paste WhatsApp, Instagram, or web chat transcripts with a blank line between each conversation, or upload a .txt / .csv file.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload .txt or .csv chat file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Upload .txt / .csv</span>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="chats-textarea" className="sr-only">
          Customer conversations separated by a blank line
        </label>
        <textarea
          id="chats-textarea"
          rows={7}
          value={rawInput}
          onChange={(e) => {
            setUploadError(null);
            onChangeInput(e.target.value);
          }}
          placeholder="Paste one or more customer conversations separated by a blank line..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950 px-3.5 py-3 font-mono-tabular text-sm text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
        />
      </div>

      {uploadError && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{uploadError}</span>
        </div>
      )}

      {oversizedCount > 0 && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {oversizedCount} conversation{oversizedCount === 1 ? '' : 's'} exceed the {MAX_CHAT_LENGTH.toLocaleString()} character limit and will be rejected by the server.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          <span>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {parsedChats.length}
            </strong>{' '}
            conversation{parsedChats.length === 1 ? '' : 's'} detected
          </span>
          <span aria-hidden="true">·</span>
          <span>Max {MAX_CHAT_LENGTH.toLocaleString()} chars per chat</span>
          <span aria-hidden="true">·</span>
          <span>Concurrency limit: 3</span>
          {uploadedFileName && (
            <>
              <span aria-hidden="true">·</span>
              <span>Loaded from {uploadedFileName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {(rawInput.length > 0 || hasRows) && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAnalyzeClick}
            disabled={parsedChats.length === 0 || isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isRunning ? 'Analyzing chats...' : 'Analyze chats'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

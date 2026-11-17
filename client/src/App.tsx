import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Moon, Settings2, Sun } from 'lucide-react';
import { Header } from './components/Header.tsx';
import { InputPanel } from './components/InputPanel.tsx';
import { ResultsTable } from './components/ResultsTable.tsx';
import { StoreFactsDrawer } from './components/StoreFactsDrawer.tsx';
import { SummarySection } from './components/SummarySection.tsx';
import {
  CONCURRENCY_LIMIT,
  type AnalyzeApiErrorResponse,
  type AnalyzeApiSuccessResponse,
  type ChatRow,
  type FeedbackLedger,
  type FrictionType,
  type StoreFacts,
  type UrgencyType,
} from './types.ts';
import { buildApprovedCsv, downloadCsvFile } from './utils/chatParser.ts';
import { runWithConcurrency } from './utils/concurrency.ts';
import {
  applyThemeClass,
  clearFeedbackLedger,
  computeCorrectionStats,
  hashChatKey,
  loadFeedbackLedger,
  loadStoreFacts,
  loadTheme,
  saveFeedbackLedger,
  saveStoreFacts,
  saveTheme,
  type ThemeMode,
} from './utils/storage.ts';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [storeFacts, setStoreFacts] = useState<StoreFacts>(() => loadStoreFacts());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [rawInput, setRawInput] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [frictionFilter, setFrictionFilter] = useState<FrictionType | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyType | 'all'>('all');

  const [feedbackLedger, setFeedbackLedger] = useState<FeedbackLedger>(() => loadFeedbackLedger());

  useEffect(() => {
    applyThemeClass(theme);
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSaveFacts = (nextFacts: StoreFacts) => {
    setStoreFacts(nextFacts);
    saveStoreFacts(nextFacts);
  };

  const configuredFactsCount = useMemo(() => {
    let count = 0;
    if (storeFacts.deliveryCharge.trim()) count += 1;
    if (storeFacts.returnWindow.trim()) count += 1;
    if (storeFacts.paymentMethods.trim()) count += 1;
    return count;
  }, [storeFacts]);

  const analyzeSingleRow = useCallback(
    async (rowId: string, chatText: string, factsSnapshot: StoreFacts) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? { ...row, status: 'loading', errorMessage: undefined }
            : row
        )
      );

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat: chatText,
            storeFacts: factsSnapshot,
          }),
        });

        let payload: AnalyzeApiSuccessResponse | AnalyzeApiErrorResponse | null = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload || payload.status !== 'ok') {
          const errPayload = payload as AnalyzeApiErrorResponse | null;
          const message =
            errPayload?.error ||
            `Server returned HTTP ${response.status}.`;
          const isAnalysisFailure = errPayload?.status === 'analysis_failed';

          if (errPayload?.code === 'MISSING_API_KEY') {
            setGlobalError(message);
          }

          setRows((prev) =>
            prev.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    status: isAnalysisFailure ? 'analysis_failed' : 'error',
                    errorMessage: message,
                    model: errPayload?.model,
                    provider: errPayload?.provider,
                  }
                : row
            )
          );
          return;
        }

        const okPayload = payload as AnalyzeApiSuccessResponse;
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  status: 'success',
                  result: okPayload.result,
                  evidenceVerified: okPayload.evidenceVerified,
                  model: okPayload.model,
                  provider: okPayload.provider,
                  errorMessage: undefined,
                  reviewStatus: 'needs_approval',
                  editedReply: okPayload.result.suggested_reply,
                  editedByHuman: false,
                }
              : row
          )
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? `Network error: ${err.message}`
            : 'Network error while contacting /api/analyze.';
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  status: 'error',
                  errorMessage: message,
                }
              : row
          )
        );
      }
    },
    []
  );

  const handleAnalyzeBatch = async (chats: string[]) => {
    setGlobalError(null);
    setFrictionFilter('all');
    setUrgencyFilter('all');

    const batchStamp = Date.now().toString(36);
    const initialRows: ChatRow[] = chats.map((chat, idx) => ({
      id: `${batchStamp}_${hashChatKey(chat, idx)}`,
      index: idx,
      chat,
      status: 'queued',
      reviewStatus: 'needs_approval',
      editedReply: '',
      editedByHuman: false,
    }));

    setRows(initialRows);
    setIsRunning(true);

    const factsSnapshot: StoreFacts = { ...storeFacts };

    try {
      await runWithConcurrency(initialRows, CONCURRENCY_LIMIT, async (row) => {
        await analyzeSingleRow(row.id, row.chat, factsSnapshot);
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRetryRow = async (rowId: string) => {
    const target = rows.find((r) => r.id === rowId);
    if (!target) return;
    setGlobalError(null);
    await analyzeSingleRow(target.id, target.chat, storeFacts);
  };

  const updateLedgerEntry = (rowId: string, decision: ChatRow['reviewStatus'], edited: boolean) => {
    setFeedbackLedger((prev) => {
      const next: FeedbackLedger = {
        ...prev,
        [rowId]: {
          decision,
          edited,
          updatedAt: Date.now(),
        },
      };
      saveFeedbackLedger(next);
      return next;
    });
  };

  const handleEditReply = (rowId: string, nextReply: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const original = row.result?.suggested_reply ?? '';
        const edited = nextReply.trim() !== original.trim();
        if (row.reviewStatus !== 'needs_approval') {
          updateLedgerEntry(rowId, row.reviewStatus, edited);
        }
        return {
          ...row,
          editedReply: nextReply,
          editedByHuman: edited,
        };
      })
    );
  };

  const handleApproveRow = (rowId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        updateLedgerEntry(rowId, 'approved', row.editedByHuman);
        return { ...row, reviewStatus: 'approved' };
      })
    );
  };

  const handleRejectRow = (rowId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        updateLedgerEntry(rowId, 'rejected', row.editedByHuman);
        return { ...row, reviewStatus: 'rejected' };
      })
    );
  };

  const handleResetFeedback = () => {
    clearFeedbackLedger();
    setFeedbackLedger({});
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        reviewStatus: 'needs_approval',
      }))
    );
  };

  const handleClearAll = () => {
    setRawInput('');
    setRows([]);
    setGlobalError(null);
    setFrictionFilter('all');
    setUrgencyFilter('all');
  };

  const filteredRows = useMemo(() => {
    if (frictionFilter === 'all' && urgencyFilter === 'all') {
      return rows;
    }
    return rows.filter((row) => {
      if (row.status !== 'success' || !row.result) return false;
      if (frictionFilter !== 'all' && row.result.friction !== frictionFilter) return false;
      if (urgencyFilter !== 'all' && row.result.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [rows, frictionFilter, urgencyFilter]);

  const approvedCount = useMemo(
    () => rows.filter((r) => r.status === 'success' && r.reviewStatus === 'approved').length,
    [rows]
  );

  const correctionStats = useMemo(
    () => computeCorrectionStats(feedbackLedger),
    [feedbackLedger]
  );

  const handleExportCsv = () => {
    if (approvedCount === 0) return;
    const csv = buildApprovedCsv(rows);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`chat-friction-approved-${dateStamp}.csv`, csv);
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Header approvedCount={approvedCount} onExportCsv={handleExportCsv} />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Workspace Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Identify what is blocking each sale
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Live LLM tagging for WhatsApp, Instagram, and web chat transcripts with human-in-the-loop approval.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Store Policy Facts{configuredFactsCount > 0 ? ` (${configuredFactsCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {globalError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{globalError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-xs font-medium underline self-start sm:self-center shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <InputPanel
          rawInput={rawInput}
          onChangeInput={setRawInput}
          onAnalyze={handleAnalyzeBatch}
          onClearAll={handleClearAll}
          isRunning={isRunning}
          hasRows={rows.length > 0}
        />

        <SummarySection
          rows={rows}
          frictionFilter={frictionFilter}
          urgencyFilter={urgencyFilter}
          onFrictionFilterChange={setFrictionFilter}
          onUrgencyFilterChange={setUrgencyFilter}
          correctionStats={correctionStats}
          onResetFeedback={handleResetFeedback}
          theme={theme}
        />

        <ResultsTable
          rows={filteredRows}
          totalRowsCount={rows.length}
          frictionFilter={frictionFilter}
          urgencyFilter={urgencyFilter}
          onResetFilters={() => {
            setFrictionFilter('all');
            setUrgencyFilter('all');
          }}
          onRetryRow={handleRetryRow}
          onEditReply={handleEditReply}
          onApproveRow={handleApproveRow}
          onRejectRow={handleRejectRow}
        />
      </main>

      <StoreFactsDrawer
        isOpen={isSettingsOpen}
        facts={storeFacts}
        onSave={handleSaveFacts}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

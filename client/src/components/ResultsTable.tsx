import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ChatRow, FrictionType, UrgencyType } from '../types.ts';
import { countWords } from '../utils/chatParser.ts';

interface ResultsTableProps {
  rows: ChatRow[];
  totalRowsCount: number;
  frictionFilter: FrictionType | 'all';
  urgencyFilter: UrgencyType | 'all';
  onResetFilters: () => void;
  onRetryRow: (rowId: string) => void;
  onEditReply: (rowId: string, nextReply: string) => void;
  onApproveRow: (rowId: string) => void;
  onRejectRow: (rowId: string) => void;
}

function formatUrgencyStyle(urgency: UrgencyType): string {
  switch (urgency) {
    case 'high':
      return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900';
    case 'medium':
      return 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900';
    case 'low':
      return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  }
}

function ConversationCell({ chat, index }: { chat: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = chat.length > 180 || chat.split('\n').length > 4;

  return (
    <div className="min-w-[210px] max-w-[300px]">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums mb-1">
        <span className="font-mono-tabular font-medium text-slate-700 dark:text-slate-300">
          #{index + 1}
        </span>
        <span aria-hidden="true">·</span>
        <span>{chat.length.toLocaleString()} chars</span>
      </div>
      <p
        className={`text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed ${
          !expanded && needsTruncation ? 'line-clamp-4' : ''
        }`}
      >
        {chat}
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Expand full chat</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function ResultsTable({
  rows,
  totalRowsCount,
  frictionFilter,
  urgencyFilter,
  onResetFilters,
  onRetryRow,
  onEditReply,
  onApproveRow,
  onRejectRow,
}: ResultsTableProps) {
  return (
    <section
      id="results-table"
      aria-labelledby="results-heading"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2
            id="results-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Analysis Results
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Note: Results are the model&apos;s interpretation of wording, not proof of why a customer left. Nothing is sent automatically.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          Showing {rows.length} of {totalRowsCount} row{totalRowsCount === 1 ? '' : 's'}
          {(frictionFilter !== 'all' || urgencyFilter !== 'all') && ' (filtered)'}
        </div>
      </div>

      {totalRowsCount === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            No conversations analyzed yet
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Paste customer chats separated by a blank line or upload a .txt / .csv file above, then click Analyze chats to run live LLM tagging.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            No rows match the active filters
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-3 px-3.5 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th scope="col" className="py-3 px-4 sm:px-5">
                  Conversation
                </th>
                <th scope="col" className="py-3 px-3 whitespace-nowrap">
                  Intent
                </th>
                <th scope="col" className="py-3 px-3 whitespace-nowrap">
                  Friction
                </th>
                <th scope="col" className="py-3 px-3">
                  Evidence
                </th>
                <th scope="col" className="py-3 px-3 whitespace-nowrap">
                  Urgency
                </th>
                <th scope="col" className="py-3 px-4 sm:px-5 min-w-[290px]">
                  Suggested Reply
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 align-top">
              {rows.map((row) => {
                if (row.status === 'queued' || row.status === 'loading') {
                  return (
                    <tr key={row.id} className="bg-white dark:bg-slate-900">
                      <td className="py-4 px-4 sm:px-5">
                        <ConversationCell chat={row.chat} index={row.index} />
                      </td>
                      <td colSpan={5} className="py-4 px-4">
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                          <RefreshCw
                            className={`w-4 h-4 shrink-0 ${
                              row.status === 'loading' ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span>
                            {row.status === 'loading'
                              ? 'Analyzing conversation via server LLM...'
                              : 'Queued (waiting for concurrency slot)...'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-3 max-w-2xl" aria-hidden="true">
                          <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
                          <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
                          <div className="h-4 rounded bg-slate-100 dark:bg-slate-800 col-span-2" />
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.status === 'error' || row.status === 'analysis_failed') {
                  return (
                    <tr
                      key={row.id}
                      className="bg-rose-50/40 dark:bg-rose-950/10"
                    >
                      <td className="py-4 px-4 sm:px-5">
                        <ConversationCell chat={row.chat} index={row.index} />
                      </td>
                      <td colSpan={5} className="py-4 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>
                                {row.status === 'analysis_failed'
                                  ? 'Analysis failed'
                                  : 'Request error'}
                              </span>
                            </div>
                            <p className="text-sm text-rose-700 dark:text-rose-300 break-words">
                              {row.errorMessage || 'Could not analyze this conversation.'}
                            </p>
                            {row.model && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Model: {row.model} · Generated by AI
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onRetryRow(row.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                          >
                            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>Retry</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Success row
                const result = row.result!;
                const wordCount = countWords(row.editedReply);
                const isOverWordLimit = wordCount > 40;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4 sm:px-5">
                      <ConversationCell chat={row.chat} index={row.index} />
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>Model: {row.model || 'unknown'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Generated by AI</span>
                      </div>
                    </td>

                    <td className="py-4 px-3 whitespace-nowrap">
                      <span className="inline-block rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {result.intent}
                      </span>
                    </td>

                    <td className="py-4 px-3 whitespace-nowrap">
                      <span className="inline-block rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {result.friction}
                      </span>
                    </td>

                    <td className="py-4 px-3 min-w-[190px] max-w-[270px]">
                      <blockquote className="text-sm text-slate-800 dark:text-slate-200 break-words leading-relaxed">
                        &ldquo;{result.evidence}&rdquo;
                      </blockquote>
                      {row.evidenceVerified === false && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Evidence not found in original chat</span>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${formatUrgencyStyle(
                          result.urgency
                        )}`}
                      >
                        {result.urgency}
                      </span>
                    </td>

                    <td className="py-4 px-4 sm:px-5 min-w-[290px]">
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          aria-label={`Suggested reply for conversation ${row.index + 1}`}
                          value={row.editedReply}
                          onChange={(e) => onEditReply(row.id, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 tabular-nums">
                            <span
                              className={
                                isOverWordLimit
                                  ? 'font-medium text-amber-700 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }
                            >
                              {wordCount} / 40 words
                            </span>
                            {row.editedByHuman && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-blue-700 dark:text-blue-400 font-medium">
                                  Edited
                                </span>
                              </>
                            )}
                          </div>

                          <span
                            className={`font-medium ${
                              row.reviewStatus === 'approved'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : row.reviewStatus === 'rejected'
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {row.reviewStatus === 'approved'
                              ? 'Approved'
                              : row.reviewStatus === 'rejected'
                                ? 'Rejected'
                                : 'Needs approval'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onApproveRow(row.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                                row.reviewStatus === 'approved'
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onRejectRow(row.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                                row.reviewStatus === 'rejected'
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-rose-600 hover:text-rose-700 dark:hover:text-rose-400'
                              }`}
                            >
                              <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Reject</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRetryRow(row.id)}
                            title="Re-run LLM analysis for this conversation"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                          >
                            <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Re-analyze</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

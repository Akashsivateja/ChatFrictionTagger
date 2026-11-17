import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RotateCcw } from 'lucide-react';
import {
  FRICTION_VALUES,
  URGENCY_VALUES,
  type ChatRow,
  type FrictionType,
  type UrgencyType,
} from '../types.ts';
import type { ThemeMode } from '../utils/storage.ts';

interface SummarySectionProps {
  rows: ChatRow[];
  frictionFilter: FrictionType | 'all';
  urgencyFilter: UrgencyType | 'all';
  onFrictionFilterChange: (value: FrictionType | 'all') => void;
  onUrgencyFilterChange: (value: UrgencyType | 'all') => void;
  correctionStats: {
    reviewed: number;
    correctedOrRejected: number;
    ratePercent: number | null;
  };
  onResetFeedback: () => void;
  theme: ThemeMode;
}

const FRICTION_LABELS: Record<FrictionType, string> = {
  price: 'Price',
  delivery: 'Delivery',
  payment: 'Payment',
  availability: 'Availability',
  trust: 'Trust',
  drop_off: 'Drop-off',
  none: 'None',
};

export function SummarySection({
  rows,
  frictionFilter,
  urgencyFilter,
  onFrictionFilterChange,
  onUrgencyFilterChange,
  correctionStats,
  onResetFeedback,
  theme,
}: SummarySectionProps) {
  const counts = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'success').length;
    const approved = rows.filter((r) => r.status === 'success' && r.reviewStatus === 'approved').length;
    const needsApproval = rows.filter(
      (r) => r.status === 'success' && r.reviewStatus === 'needs_approval'
    ).length;
    const failed = rows.filter(
      (r) => r.status === 'error' || r.status === 'analysis_failed'
    ).length;
    return { total, completed, approved, needsApproval, failed };
  }, [rows]);

  const chartData = useMemo(() => {
    const tally = new Map<FrictionType, number>();
    for (const f of FRICTION_VALUES) {
      tally.set(f, 0);
    }
    for (const row of rows) {
      if (row.status === 'success' && row.result) {
        tally.set(row.result.friction, (tally.get(row.result.friction) ?? 0) + 1);
      }
    }
    return FRICTION_VALUES.map((friction) => ({
      friction,
      label: FRICTION_LABELS[friction],
      count: tally.get(friction) ?? 0,
    }));
  }, [rows]);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisTextColor = isDark ? '#94a3b8' : '#475569';
  const barDefaultColor = isDark ? '#3b82f6' : '#2563eb';
  const barMutedColor = isDark ? '#334155' : '#cbd5e1';

  const hasActiveFilter = frictionFilter !== 'all' || urgencyFilter !== 'all';

  return (
    <section
      id="summary-section"
      aria-labelledby="summary-heading"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2
            id="summary-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Batch Summary & Friction Breakdown
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Live counts update as conversations return from the server.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-friction"
              className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
            >
              Friction
            </label>
            <select
              id="filter-friction"
              value={frictionFilter}
              onChange={(e) => onFrictionFilterChange(e.target.value as FrictionType | 'all')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All types</option>
              {FRICTION_VALUES.map((val) => (
                <option key={val} value={val}>
                  {FRICTION_LABELS[val]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-urgency"
              className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
            >
              Urgency
            </label>
            <select
              id="filter-urgency"
              value={urgencyFilter}
              onChange={(e) => onUrgencyFilterChange(e.target.value as UrgencyType | 'all')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All levels</option>
              {URGENCY_VALUES.map((val) => (
                <option key={val} value={val}>
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                onFrictionFilterChange('all');
                onUrgencyFilterChange('all');
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="py-4 sm:pr-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Conversations
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {counts.total}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {counts.completed} analyzed · {counts.failed} failed
          </div>
        </div>

        <div className="py-4 sm:px-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Needs Approval
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-amber-700 dark:text-amber-400">
            {counts.needsApproval}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Human review required
          </div>
        </div>

        <div className="py-4 sm:px-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Approved Replies
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {counts.approved}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Ready for CSV export
          </div>
        </div>

        <div className="py-4 sm:pl-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Human Correction Rate
            </span>
            {correctionStats.reviewed > 0 && (
              <button
                type="button"
                onClick={onResetFeedback}
                title="Reset saved human review history"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {correctionStats.ratePercent === null
              ? '—'
              : `${correctionStats.ratePercent.toFixed(1)}%`}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {correctionStats.correctedOrRejected} edited or rejected / {correctionStats.reviewed} reviewed
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Friction Category Distribution
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click a bar to filter by friction
          </span>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisTextColor, fontSize: 12 }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: axisTextColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.04)' }}
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  borderRadius: '8px',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value} conversation(s)`, 'Count']}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                className="cursor-pointer"
                onClick={(entry) => {
                  const payload = (entry as unknown as { payload?: { friction?: FrictionType } })
                    ?.payload;
                  const clickedFriction = payload?.friction;
                  if (!clickedFriction) return;
                  onFrictionFilterChange(
                    frictionFilter === clickedFriction ? 'all' : clickedFriction
                  );
                }}
              >
                {chartData.map((entry) => {
                  const isSelected = frictionFilter === 'all' || frictionFilter === entry.friction;
                  return (
                    <Cell
                      key={entry.friction}
                      fill={isSelected ? barDefaultColor : barMutedColor}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

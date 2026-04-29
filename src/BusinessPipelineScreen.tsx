/**
 * Business role — dedicated “Business pipeline” view (separate from Business dashboard home).
 * Projects bar chart: pipeline rows grouped by start-date quarter; top two benefit types as series.
 * Table is driven from `new_pipeline` in Dataverse.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import {
  buildNewPipelineCreateBody,
  buildNewPipelineUpdateBody,
  sanitizePotentialValueInput,
  type BusinessPipelineTableRow,
} from './pipelineMappers';
import { New_pipelinesService } from './generated/services/New_pipelinesService';
import { ScreenLoader } from './ScreenLoader';
import { enj } from './ui/enjForm';
import type { ToastType } from './NotificationToast';

export type { BusinessPipelineTableRow } from './pipelineMappers';

/** Grouped bar colors (benefit 1, benefit 2) — match pipeline UI reference. */
const PIPELINE_BENEFIT_COLORS: readonly [string, string] = ['#9ca3af', '#22d3ee'];

const YEAR_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

const STAGE_OF_OPPORTUNITY_OPTIONS = ['', 'Defense', 'Negotiation', 'Discovery', 'Proposal', 'Closed won', 'Closed lost'] as const;

const ALL_CLIENTS_FILTER = 'All clients' as const;

function normalizePipelineBenefit(r: BusinessPipelineTableRow): string {
  const b = (r.benefit && r.benefit !== '—' ? r.benefit : '').trim();
  return b || 'Other';
}

/** Start date quarter 0..3 in `y`, or null if not in that year. */
function rowStartQuarterInYear(r: BusinessPipelineTableRow, y: number): number | null {
  if (!r.startDateYyyyMmDd) return null;
  const d = new Date(`${r.startDateYyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== y) return null;
  return Math.min(3, Math.max(0, Math.floor(d.getMonth() / 3)));
}

function localDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ReqField({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-medium text-gray-700">
      {label} <span className="text-red-500">*</span>
    </span>
  );
}

export type BusinessPipelineScreenProps = {
  tableRows: BusinessPipelineTableRow[];
  /** Rows from the **Clients** table (`new_clients`) for the Client Name field. */
  clientOptions: ReadonlyArray<{ id: string; name: string }>;
  loading?: boolean;
  /** @deprecated No longer used (refresh control removed from UI). */
  onRefresh?: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  /** Called after a row is created or updated in `new_pipeline` (refetch list). */
  onPipelineCreated?: () => void;
  /** No add or edit: chart + read-only table (e.g. Program “Project Pipeline”). */
  hidePipelineCreation?: boolean;
  /** Main heading (default: `Business Pipeline`). */
  screenTitle?: string;
};

type PipelineFormState = {
  /** “Pipeline name” in the app (stored in `new_opportunityname` with the join used by the mapper). */
  pipelineName: string;
  opportunityName: string;
  potentialValue: string;
  tentativeClosure: string;
  clientId: string;
  stage: string;
  benefits: string;
  startDate: string;
  attachment: File | null;
};

const emptyPipelineForm = (dates: { start: string; end: string }): PipelineFormState => ({
  pipelineName: '',
  opportunityName: '',
  potentialValue: '',
  tentativeClosure: dates.end,
  clientId: '',
  stage: '',
  benefits: '',
  startDate: dates.start,
  attachment: null,
});

export default function BusinessPipelineScreen({
  tableRows,
  clientOptions,
  loading,
  onNotify,
  onPipelineCreated,
  hidePipelineCreation = false,
  screenTitle = 'Business Pipeline',
}: BusinessPipelineScreenProps) {
  const [year, setYear] = useState(2026);
  const [category, setCategory] = useState<string>(ALL_CLIENTS_FILTER);
  const [pipelineViewAll, setPipelineViewAll] = useState(false);
  const [pipelineModal, setPipelineModal] = useState<null | 'add' | 'edit'>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const editFormBaseline = useRef<PipelineFormState | null>(null);
  const today = useMemo(() => new Date(), []);
  const defaultDateStr = useMemo(() => localDateInputValue(today), [today]);
  const [pipelineForm, setPipelineForm] = useState<PipelineFormState>(() =>
    emptyPipelineForm({ start: defaultDateStr, end: defaultDateStr }),
  );

  const closePipelineModal = useCallback(() => {
    if (attachInputRef.current) attachInputRef.current.value = '';
    setPipelineModal(null);
    setEditingId(null);
    editFormBaseline.current = null;
  }, []);

  const resetAddForm = useCallback(() => {
    if (attachInputRef.current) attachInputRef.current.value = '';
    setPipelineForm(emptyPipelineForm({ start: defaultDateStr, end: defaultDateStr }));
  }, [defaultDateStr]);

  const openAddModal = useCallback(() => {
    resetAddForm();
    setEditingId(null);
    editFormBaseline.current = null;
    setPipelineModal('add');
  }, [resetAddForm]);

  const submitPipelineModal = useCallback(async () => {
    if (submitting) return;
    if (!pipelineModal) return;
    const {
      pipelineName,
      opportunityName,
      potentialValue,
      tentativeClosure,
      clientId,
      stage,
      benefits,
      startDate,
      attachment,
    } = pipelineForm;
    if (
      !pipelineName.trim() ||
      !opportunityName.trim() ||
      !potentialValue.trim() ||
      !tentativeClosure ||
      !clientId ||
      !stage ||
      !benefits.trim() ||
      !startDate
    ) {
      onNotify?.('error', 'Please fill in all required fields (including a client from the list).');
      return;
    }
    const clientRow = clientOptions.find((c) => c.id === clientId);
    if (!clientRow?.name) {
      onNotify?.('error', 'Select a valid client from the Clients table.');
      return;
    }
    const formPayload = {
      pipelineName,
      opportunityName,
      potentialValue,
      tentativeClosure,
      clientName: clientRow.name,
      stage,
      benefits,
      startDate,
    };
    let body: Record<string, unknown>;
    try {
      body =
        pipelineModal === 'add'
          ? buildNewPipelineCreateBody(formPayload)
          : buildNewPipelineUpdateBody(formPayload);
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Invalid input.');
      return;
    }
    if (pipelineModal === 'edit') {
      if (!editingId) {
        onNotify?.('error', 'Missing pipeline id.');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (pipelineModal === 'add') {
        const res = await New_pipelinesService.create(
          body as unknown as Parameters<typeof New_pipelinesService.create>[0],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to create pipeline');
      } else {
        const res = await New_pipelinesService.update(
          editingId!,
          body as unknown as Parameters<typeof New_pipelinesService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update pipeline');
      }
      onNotify?.(
        'success',
        attachment
          ? pipelineModal === 'add'
            ? 'Pipeline saved to Dataverse. (File not stored: add a file column on new_pipeline to enable attachments.)'
            : 'Pipeline updated. (File not stored: add a file column on new_pipeline to enable attachments.)'
          : pipelineModal === 'add'
            ? 'Pipeline saved to Dataverse.'
            : 'Pipeline updated in Dataverse.',
      );
      closePipelineModal();
      resetAddForm();
      onPipelineCreated?.();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save pipeline.');
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    pipelineModal,
    pipelineForm,
    clientOptions,
    onNotify,
    onPipelineCreated,
    editingId,
    closePipelineModal,
    resetAddForm,
  ]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>([ALL_CLIENTS_FILTER]);
    for (const r of tableRows) {
      if (r.categoryName && r.categoryName !== '—') s.add(r.categoryName);
    }
    return Array.from(s).sort((a, b) => {
      if (a === ALL_CLIENTS_FILTER) return -1;
      if (b === ALL_CLIENTS_FILTER) return 1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }, [tableRows]);

  useEffect(() => {
    if (!categoryOptions.includes(category)) setCategory(ALL_CLIENTS_FILTER);
  }, [categoryOptions, category]);

  useEffect(() => {
    if (!pipelineModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePipelineModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pipelineModal, closePipelineModal]);

  const filteredRows = useMemo(() => {
    return tableRows.filter((r) => {
      if (r.year > 0 && r.year !== year) return false;
      if (category === ALL_CLIENTS_FILTER) return true;
      return r.categoryName === category;
    });
  }, [tableRows, year, category]);

  const pipelineDetailRows = useMemo(
    () => (pipelineViewAll ? filteredRows : filteredRows.slice(0, 5)),
    [filteredRows, pipelineViewAll],
  );

  const pipelineBarChart = useMemo(() => {
    const benefCounts = new Map<string, number>();
    for (const r of filteredRows) {
      const k = normalizePipelineBenefit(r);
      benefCounts.set(k, (benefCounts.get(k) ?? 0) + 1);
    }
    const top2 = [...benefCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);
    const s0 = top2[0] ?? '—';
    const s1 = top2[1] ?? '—';
    const labelA = s0;
    const labelB = s1;
    const counts: [number, number][] = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    for (const r of filteredRows) {
      const q = rowStartQuarterInYear(r, year);
      if (q == null) continue;
      const b = normalizePipelineBenefit(r);
      if (b === s0) counts[q]![0] += 1;
      else if (s1 && b === s1) counts[q]![1] += 1;
    }
    const allVals = counts.flat();
    const maxData = allVals.length ? Math.max(0, ...allVals) : 0;
    const yMax = Math.max(10, maxData % 2 === 0 ? maxData : maxData + 1);
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (i * yMax) / tickCount) as number[];
    return {
      labelA,
      labelB,
      colors: PIPELINE_BENEFIT_COLORS,
      quarterLabels: [0, 1, 2, 3].map((qi) => `Q${qi + 1}-${year}`) as [string, string, string, string],
      counts,
      yMax,
      yTicks,
    };
  }, [filteredRows, year]);

  const showPipelineActions = !hidePipelineCreation;
  const tableColSpan = 7;

  return (
    <div className={enj.stack}>
      <div>
        <h1 className={enj.pageTitle}>{screenTitle}</h1>
      </div>

      <section className={`chart-card ${enj.card} ${enj.cardPad}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className={enj.sectionTitle}>Projects</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-gray-600">
              <span className="shrink-0">Year</span>
              <select
                className={`${enj.control} h-9 !w-[5.5rem] shrink-0 text-sm text-gray-800`}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-gray-600">
              <span className="shrink-0">Client</span>
              <select
                className={`${enj.control} h-9 min-w-0 max-w-[10rem] flex-1 text-sm text-gray-800`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                title={category}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,11rem] lg:items-start">
          <div className="min-w-0 pr-0 lg:pr-2">
            {(() => {
              const { yMax, yTicks, quarterLabels, counts, colors, labelA, labelB } = pipelineBarChart;
              const plotLeft = 38;
              const plotRight = 590;
              const plotTop = 20;
              const plotBottom = 170;
              const plotH = plotBottom - plotTop;
              const groupW = (plotRight - plotLeft) / 4;
              const yScale = (v: number) => plotBottom - (v / yMax) * plotH;
              return (
                <svg
                  viewBox="0 0 720 220"
                  className={enj.chartSvg}
                  role="img"
                  aria-label={`Pipeline projects in ${year} by quarter, ${labelA} and ${labelB}`}
                >
                  {yTicks.map((t) => {
                    const y = yScale(t);
                    return (
                      <g key={t}>
                        <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#edf2f7" />
                        <text
                          x="28"
                          y={y + 3}
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                          className="tabular-nums"
                        >
                          {Number.isInteger(t) ? t : t.toFixed(1).replace(/\.0$/, '')}
                        </text>
                      </g>
                    );
                  })}
                  {quarterLabels.map((ql, g) => {
                    const [v0, v1] = counts[g] ?? [0, 0];
                    const cx0 = plotLeft + g * groupW;
                    const pad = 0.12 * groupW;
                    const inner = groupW - 2 * pad;
                    const gap = 4;
                    const barW = (inner - gap) / 2;
                    const x0 = cx0 + pad;
                    const x1 = x0 + barW + gap;
                    return (
                      <g key={ql}>
                        <rect
                          className="chart-bar"
                          x={x0}
                          y={yScale(v0)}
                          width={barW}
                          height={plotBottom - yScale(v0)}
                          rx="3"
                          fill={colors[0]}
                        />
                        <text
                          x={x0 + barW / 2}
                          y={yScale(v0) - 3}
                          fontSize="8"
                          textAnchor="middle"
                          fill="#64748b"
                          className="tabular-nums"
                        >
                          {v0}
                        </text>
                        <rect
                          className="chart-bar"
                          x={x1}
                          y={yScale(v1)}
                          width={barW}
                          height={plotBottom - yScale(v1)}
                          rx="3"
                          fill={colors[1]}
                        />
                        <text
                          x={x1 + barW / 2}
                          y={yScale(v1) - 3}
                          fontSize="8"
                          textAnchor="middle"
                          fill="#64748b"
                          className="tabular-nums"
                        >
                          {v1}
                        </text>
                        <text
                          x={cx0 + groupW / 2}
                          y="196"
                          fontSize="7"
                          textAnchor="middle"
                          fill="#94a3b8"
                          transform={`rotate(-65 ${cx0 + groupW / 2} 196)`}
                        >
                          {ql}
                        </text>
                      </g>
                    );
                  })}
                  <text
                    x="700"
                    y="105"
                    fontSize="7"
                    fill="#94a3b8"
                    textAnchor="middle"
                    transform="rotate(90, 700, 105)"
                    className="uppercase tracking-wider"
                  >
                    Timeline
                  </text>
                </svg>
              );
            })()}
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <p className={`${enj.caption} font-medium uppercase tracking-wide`}>Benefits (top 2)</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pipelineBarChart.colors[0] }}
                />
                <span className="min-w-0 truncate" title={pipelineBarChart.labelA}>
                  {pipelineBarChart.labelA}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pipelineBarChart.colors[1] }}
                />
                <span className="min-w-0 truncate" title={pipelineBarChart.labelB}>
                  {pipelineBarChart.labelB}
                </span>
              </div>
            </div>
          </div>
        </div>
        {loading && <ScreenLoader overlay className="rounded-xl" />}
      </section>

      <section className={enj.card}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100/90 px-4 py-3 sm:px-5">
          <h2 className={enj.sectionTitle}>Pipeline Details</h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showPipelineActions && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-8 min-h-[32px] items-center gap-1 rounded-md border border-[#d4a759] bg-white px-3.5 text-xs font-semibold text-[#9a7329] shadow-sm hover:bg-amber-50/60"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add Pipeline
              </button>
            )}
            {filteredRows.length > 5 && (
              <button
                type="button"
                onClick={() => setPipelineViewAll((v) => !v)}
                className="inline-flex h-8 min-h-[32px] items-center rounded-md border border-[#d4a759] bg-white px-3.5 text-xs font-semibold text-[#9a7329] shadow-sm hover:bg-amber-50/60"
              >
                {pipelineViewAll ? 'Show less' : 'View All'}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`${enj.tableBrand} min-w-[860px] !border-separate ![border-spacing:0_8px] text-[12px]`}>
            <thead>
              <tr>
                <th className="h-[41px] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Pipeline name</th>
                <th className="h-[41px] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Benefits</th>
                <th className="h-[41px] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Potential Value</th>
                <th className="h-[41px] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Start Date</th>
                <th className="h-[41px] min-w-[8rem] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Client Name</th>
                <th className="h-[41px] min-w-[7rem] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Stage of Opportunity</th>
                <th className="h-[41px] whitespace-nowrap normal-case bg-[rgba(225,227,236,1)] text-[13px] font-bold tracking-normal text-[rgba(118,131,150,1)]">Tentative Closure</th>
              </tr>
            </thead>
            <tbody>
              {pipelineDetailRows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={tableColSpan} className={`px-4 py-10 text-center ${enj.caption}`}>
                    {showPipelineActions
                      ? 'No pipeline rows for this year and client. Add a pipeline or adjust filters.'
                      : 'No pipeline rows for this year and client. Adjust filters.'}
                  </td>
                </tr>
              ) : (
                pipelineDetailRows.map((row) => (
                  <tr key={row.id} className="last:border-0">
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)] first:rounded-l-[10.44px]">
                      <span
                        className={
                          showPipelineActions ? `${enj.tableLink} underline underline-offset-2` : 'font-medium text-[#374151]'
                        }
                      >
                        {row.pipelineName}
                      </span>
                    </td>
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)]">{row.benefit}</td>
                    <td className="h-[61px] bg-white text-[12px] font-medium tabular-nums text-[rgba(35,35,96,1)]">{row.potentialValue}</td>
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)]">{row.startDateLabel}</td>
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)]">{row.categoryName}</td>
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)]">{row.stage}</td>
                    <td className="h-[61px] bg-white text-[12px] font-medium text-[rgba(35,35,96,1)] last:rounded-r-[10.44px]">{row.endDateLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pipelineModal && showPipelineActions && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pipeline-form-title"
          onClick={() => closePipelineModal()}
        >
          <div
            className="max-h-[min(100vh-2rem,720px)] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 id="pipeline-form-title" className="text-lg font-bold text-gray-900">
                {pipelineModal === 'add' ? 'Add Pipeline' : 'Edit Pipeline'}
              </h2>
              <button
                type="button"
                onClick={() => closePipelineModal()}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Pipeline name" />
                  <input
                    className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm placeholder:text-gray-400"
                    placeholder="Pipeline name (Dataverse Pipeline)"
                    value={pipelineForm.pipelineName}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, pipelineName: e.target.value }))}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Opportunity Name" />
                  <input
                    className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm placeholder:text-gray-400"
                    placeholder="Enter opportunity name"
                    value={pipelineForm.opportunityName}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, opportunityName: e.target.value }))}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Potential Value" />
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm tabular-nums placeholder:text-gray-400"
                    placeholder="Numbers only"
                    value={pipelineForm.potentialValue}
                    onChange={(e) =>
                      setPipelineForm((f) => ({ ...f, potentialValue: sanitizePotentialValueInput(e.target.value) }))
                    }
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Tentative Closure" />
                  <div className="relative">
                    <input
                      type="date"
                      className="h-9 w-full rounded-md border border-gray-200 px-3 pr-9 text-sm [color-scheme:light]"
                      value={pipelineForm.tentativeClosure}
                      onChange={(e) => setPipelineForm((f) => ({ ...f, tentativeClosure: e.target.value }))}
                    />
                  </div>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Client Name" />
                  <select
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={pipelineForm.clientId}
                    disabled={clientOptions.length === 0}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, clientId: e.target.value }))}
                  >
                    <option value="">
                      {clientOptions.length === 0 ? '— No clients (add in Clients table) —' : '— Select a client —'}
                    </option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Stage of Opportunity" />
                  <select
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800"
                    value={pipelineForm.stage}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, stage: e.target.value }))}
                  >
                    <option value="">Select stage</option>
                    {STAGE_OF_OPPORTUNITY_OPTIONS.filter(Boolean).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                    {pipelineForm.stage &&
                      !(STAGE_OF_OPPORTUNITY_OPTIONS as readonly string[]).includes(pipelineForm.stage) && (
                        <option value={pipelineForm.stage}>{pipelineForm.stage}</option>
                      )}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Benefits" />
                  <input
                    className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm placeholder:text-gray-400"
                    placeholder="Enter benefits"
                    value={pipelineForm.benefits}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, benefits: e.target.value }))}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Start Date" />
                  <div className="relative">
                    <input
                      type="date"
                      className="h-9 w-full rounded-md border border-gray-200 px-3 pr-9 text-sm [color-scheme:light]"
                      value={pipelineForm.startDate}
                      onChange={(e) => setPipelineForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                </label>
                <div className="flex min-w-0 flex-col gap-1">
                  <ReqField label="Attachments" />
                  <div className="flex min-h-[4.5rem] flex-1 flex-col justify-between rounded-md border border-dashed border-gray-300 bg-gray-50/80 px-3 py-2.5">
                    <p className="text-[11px] text-gray-500">
                      {pipelineForm.attachment ? pipelineForm.attachment.name : 'There is nothing attached.'}
                    </p>
                    <input
                      ref={attachInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setPipelineForm((prev) => ({ ...prev, attachment: f }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:text-secondary"
                    >
                      <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                      Attach file
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  if (pipelineModal === 'edit' && editFormBaseline.current) {
                    if (attachInputRef.current) attachInputRef.current.value = '';
                    setPipelineForm({ ...editFormBaseline.current, attachment: null });
                  } else {
                    resetAddForm();
                  }
                }}
                disabled={submitting}
                className={`${enj.btnOutline} min-w-[5rem]`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void submitPipelineModal()}
                disabled={submitting}
                className={`${enj.btnPrimary} min-w-[5rem]`}
              >
                {submitting ? 'Saving…' : pipelineModal === 'add' ? 'Submit' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

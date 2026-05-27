/**
 * Business role — dedicated “Business pipeline” view (separate from Business dashboard home).
 * Projects bar chart: pipeline rows grouped by start-date quarter; one series per benefit type.
 * Table is driven from `new_pipeline` in Dataverse.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Eye, Paperclip, Pencil, Plus, X, Trash2, Download } from 'lucide-react';
import { fetchAttachments, uploadAttachments, type AttachmentFile } from './services/attachmentService';
import { PagerBar } from './PagerBar';
import {
  buildNewPipelineCreateBody,
  buildNewPipelineUpdateBody,
  sanitizePotentialValueInput,
  type BusinessPipelineTableRow,
} from './pipelineMappers';
import { New_pipelinesService } from './generated/services/New_pipelinesService';
import { ScreenLoader } from './ScreenLoader';
import { sendEmailNotification, generateEmailTemplate } from './services/PMTMailNotificationService';
import { enj } from './ui/enjForm';
import type { ToastType } from './NotificationToast';
import { DatePickerField } from './EnjDatePicker';
import { FormFieldLabel, FormPageActions, FormPageShell } from './FormPageShell';
import { DonutChartCard } from './DonutChartCard';

export type { BusinessPipelineTableRow } from './pipelineMappers';

/** Grouped bar colors — cycles when there are many benefit types. */
const PIPELINE_BENEFIT_PALETTE = [
  '#9ca3af',
  '#22d3ee',
  '#7c6fcd',
  '#f59e0b',
  '#10b981',
  '#e05d8a',
  '#3b82f6',
  '#ef4444',
  '#8b5e34',
  '#60a5fa',
] as const;

const YEAR_OPTIONS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

/** Matches Program screen table header (DM Sans, 12.81px, #E1E3EC bar). */
const PIPELINE_TABLE_TH_STYLE: CSSProperties = {
  fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif',
  fontSize: '12.81px',
  fontWeight: 600,
  lineHeight: '1',
  letterSpacing: '0px',
  color: '#768396',
  backgroundColor: '#E1E3EC',
  borderRadius: '0',
};

const PIPELINE_TABLE_TD = 'px-4 py-3 bg-white border-0 align-middle text-[rgba(35,35,96,1)]';
const PIPELINE_TABLE_ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] shadow-sm transition-colors hover:bg-[#F9FAFB]';

function PipelineTableTh({ label, center = false }: { label: string; center?: boolean }) {
  return (
    <th
      scope="col"
      style={PIPELINE_TABLE_TH_STYLE}
      className={`whitespace-nowrap normal-case tracking-normal border-0 px-4 py-3 ${center ? 'text-center' : 'text-left'}`}
    >
      {label}
    </th>
  );
}

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
  attachments: File[];
  existingAttachments: AttachmentFile[];
  existingAttachmentId: string;
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
  attachments: [],
  existingAttachments: [],
  existingAttachmentId: '',
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
  const [pipelineErrors, setPipelineErrors] = useState<Record<string, string>>({});
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
    setPipelineErrors({});
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
    } = pipelineForm;
    const nextErrors: Record<string, string> = {};
    if (!pipelineName.trim()) nextErrors.pipelineName = 'Pipeline Name is required';
    if (!opportunityName.trim()) nextErrors.opportunityName = 'Opportunity Name is required';
    if (!potentialValue.trim()) nextErrors.potentialValue = 'Potential Value is required';
    if (!tentativeClosure) nextErrors.tentativeClosure = 'Tentative Closure is required';
    if (!clientId) nextErrors.clientId = 'Client is required';
    if (!stage) nextErrors.stage = 'Stage is required';
    if (!benefits.trim()) nextErrors.benefits = 'Benefits is required';
    if (!startDate) nextErrors.startDate = 'Start Date is required';
    if (Object.keys(nextErrors).length > 0) {
      setPipelineErrors(nextErrors);
      return;
    }
    setPipelineErrors({});
    const clientRow = clientOptions.find((c) => c.id === clientId);
    if (!clientRow?.name) {
      setPipelineErrors({ clientId: 'Please select a valid client.' });
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
      // Handle attachments
      let attachmentId = pipelineForm.existingAttachmentId;
      if (pipelineForm.attachments.length > 0 && !attachmentId) {
        attachmentId = `ATT-${Date.now()}`;
      }

      if (attachmentId) {
        body.crcf8_attachmentid = attachmentId;
      }

      if (pipelineModal === 'add') {
        const res = await New_pipelinesService.create(
          body as unknown as Parameters<typeof New_pipelinesService.create>[0],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to create pipeline');

        // Upload attachments
        if (attachmentId && pipelineForm.attachments.length > 0) {
          void uploadAttachments(attachmentId, pipelineForm.attachments);
        }

        // Send email notification for new pipeline
        const clientRow = clientOptions.find((c) => c.id === pipelineForm.clientId);
        if (clientRow?.name) {
          const recipientEmail = 'pipeline-notifications@enjaz.com';
          const emailTemplate = generateEmailTemplate(
            'New Pipeline Created',
            'Dear Team,',
            'A new pipeline has been created in the Enjaz Project Management System. Please review the details below.',
            [
              { label: 'Pipeline Name', value: pipelineForm.pipelineName },
              { label: 'Opportunity Name', value: pipelineForm.opportunityName },
              { label: 'Client', value: String(clientRow.name ?? '') },
              { label: 'Stage', value: pipelineForm.stage },
              { label: 'Potential Value', value: pipelineForm.potentialValue },
              {
                label: 'Start Date',
                value: pipelineForm.startDate ? String(pipelineForm.startDate).split('T')[0] : 'N/A',
              },
            ],
          );

          sendEmailNotification({
            toEmail: recipientEmail,
            subject: `New Pipeline Created: ${pipelineForm.pipelineName}`,
            htmlBody: emailTemplate,
          }).catch((err) => {
            console.error('Failed to send pipeline creation email:', err);
          });
        }

      } else {
        const res = await New_pipelinesService.update(
          editingId!,
          body as unknown as Parameters<typeof New_pipelinesService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update pipeline');

        // Upload new attachments
        if (attachmentId && pipelineForm.attachments.length > 0) {
          void uploadAttachments(attachmentId, pipelineForm.attachments);
        }
      }
      onNotify?.(
        'success',
        pipelineModal === 'add' ? 'Pipeline added successfully.' : 'Pipeline updated successfully.',
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

  const updateFormAndClearError = useCallback((fieldName: string, updater: (f: PipelineFormState) => PipelineFormState) => {
    setPipelineForm(updater);
    if (pipelineErrors[fieldName]) {
      setPipelineErrors((prev) => ({ ...prev, [fieldName]: '' }));
    }
  }, [pipelineErrors]);

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

  const [viewAllPage, setViewAllPage] = useState(1);
  const VIEW_ALL_PAGE_SIZE = 6;
  const viewAllTotalPages = Math.max(1, Math.ceil(filteredRows.length / VIEW_ALL_PAGE_SIZE));
  const pagedViewAllRows = filteredRows.slice((viewAllPage - 1) * VIEW_ALL_PAGE_SIZE, viewAllPage * VIEW_ALL_PAGE_SIZE);

  useEffect(() => { setViewAllPage(1); }, [filteredRows]);

  const pipelineDetailRows = useMemo(
    () => filteredRows.slice(0, 10),
    [filteredRows],
  );

  const pipelineBarChart = useMemo(() => {
    const benefCounts = new Map<string, number>();
    for (const r of filteredRows) {
      const k = normalizePipelineBenefit(r);
      benefCounts.set(k, (benefCounts.get(k) ?? 0) + 1);
    }
    const benefitLabels = [...benefCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const labels = benefitLabels.length > 0 ? benefitLabels : ['—'];
    const series = labels.map((label, i) => ({
      label,
      color: PIPELINE_BENEFIT_PALETTE[i % PIPELINE_BENEFIT_PALETTE.length],
    }));
    const benefitIndex = new Map(labels.map((label, i) => [label, i]));
    const counts: number[][] = Array.from({ length: 4 }, () => Array(series.length).fill(0));
    for (const r of filteredRows) {
      const q = rowStartQuarterInYear(r, year);
      if (q == null) continue;
      const b = normalizePipelineBenefit(r);
      const idx = benefitIndex.get(b);
      if (idx !== undefined) counts[q]![idx] += 1;
    }
    const allVals = counts.flat();
    const maxData = allVals.length ? Math.max(0, ...allVals) : 0;
    const yMax = Math.max(10, maxData % 2 === 0 ? maxData : maxData + 1);
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (i * yMax) / tickCount) as number[];
    return {
      series,
      quarterLabels: [0, 1, 2, 3].map((qi) => `Q${qi + 1}-${year}`) as [string, string, string, string],
      counts,
      yMax,
      yTicks,
    };
  }, [filteredRows, year]);

  const [viewingRow, setViewingRow] = useState<BusinessPipelineTableRow | null>(null);
  const [viewingAttachments, setViewingAttachments] = useState<AttachmentFile[]>([]);

  useEffect(() => {
    const attachmentId = viewingRow?.crcf8_attachmentid;
    if (!attachmentId) {
      setViewingAttachments([]);
      return;
    }
    const fetchFiles = async () => {
      try {
        const files = await fetchAttachments(attachmentId);
        setViewingAttachments(files);
      } catch (err) {
        console.error('Failed to fetch attachments:', err);
        setViewingAttachments([]);
      }
    };
    fetchFiles();
  }, [viewingRow?.crcf8_attachmentid]);

  const openEditModal = useCallback((row: BusinessPipelineTableRow) => {
    const matchedClient = clientOptions.find(
      (c) => c.name.trim().toLowerCase() === (row.categoryName ?? '').trim().toLowerCase()
    );
    const attachmentId = String(row.crcf8_attachmentid ?? '').trim();
    const form: PipelineFormState = {
      pipelineName: row.pipelineName,
      opportunityName: row.name,
      potentialValue: row.potentialValueInput || row.potentialValue,
      tentativeClosure: row.tentativeClosureYyyyMmDd || defaultDateStr,
      clientId: matchedClient?.id ?? '',
      stage: row.stage !== '—' ? row.stage : '',
      benefits: row.benefit !== '—' ? row.benefit : '',
      startDate: row.startDateYyyyMmDd || defaultDateStr,
      attachments: [],
      existingAttachments: [],
      existingAttachmentId: attachmentId,
    };
    setPipelineForm(form);
    editFormBaseline.current = form;
    setEditingId(row.id);

    // Fetch existing attachments if any
    if (attachmentId) {
      fetchAttachments(attachmentId)
        .then((files) => {
          setPipelineForm((prev) => {
            const updated = { ...prev, existingAttachments: files };
            editFormBaseline.current = updated;
            return updated;
          });
        })
        .catch((error) => {
          console.error('Failed to fetch pipeline attachments:', error);
        });
    }

    setPipelineModal('edit');
  }, [defaultDateStr, clientOptions]);

  const DONUT_COLORS: Record<string, string> = {
    Defense: '#7c6fcd',
    Negotiation: '#e05d8a',
    Discovery: '#f59e0b',
    Proposal: '#3b82f6',
    'Closed won': '#10b981',
    'Closed lost': '#ef4444',
    Other: '#9ca3af',
  };

  const donutData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filteredRows) {
      const s = r.stage && r.stage !== '—' ? r.stage : 'Other';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const entries = [...counts.entries()];
    const isSingleSlice = entries.length === 1 && total > 0;
    let startAngle = -Math.PI / 2;
    return {
      total,
      slices: entries.map(([label, count]) => {
      // Clamp full-circle slices slightly under 2π.
      // Otherwise the SVG arc command can become degenerate when only one stage is present.
      const rawAngle = total > 0 ? (count / total) * 2 * Math.PI : 0;
      const angle = isSingleSlice ? 2 * Math.PI - 0.0001 : rawAngle;
      const slice = { label, count, angle, startAngle, color: DONUT_COLORS[label] ?? '#9ca3af' };
      startAngle += angle;
      return slice;
    }),
    };
  }, [filteredRows]);

  const showPipelineActions = !hidePipelineCreation;
  const tableColSpan = 8;
  const pipelineFieldClass = `enj-add-project-field mt-1 ${enj.control} border-[#ADACB4]`;

  const clearPipelineForm = useCallback(() => {
    if (attachInputRef.current) attachInputRef.current.value = '';
    if (pipelineModal === 'edit' && editFormBaseline.current) {
      setPipelineForm({ ...editFormBaseline.current });
    } else {
      resetAddForm();
    }
  }, [pipelineModal, resetAddForm]);

  if (pipelineModal && showPipelineActions) {
    return (
      <FormPageShell
        parentLabel={screenTitle}
        onBack={closePipelineModal}
        title={pipelineModal === 'add' ? 'Add Pipeline' : 'Edit Pipeline'}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
          <div>
            <FormFieldLabel label="Pipeline name" required />
            <input
              className={pipelineFieldClass}
              value={pipelineForm.pipelineName}
              onChange={(e) => updateFormAndClearError('pipelineName', (f) => ({ ...f, pipelineName: e.target.value }))}
            />
            {pipelineErrors.pipelineName && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.pipelineName}</p>}
          </div>
          <div>
            <FormFieldLabel label="Opportunity Name" required />
            <input
              className={pipelineFieldClass}
              value={pipelineForm.opportunityName}
              onChange={(e) => updateFormAndClearError('opportunityName', (f) => ({ ...f, opportunityName: e.target.value }))}
            />
            {pipelineErrors.opportunityName && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.opportunityName}</p>}
          </div>
          <div>
            <FormFieldLabel label="Potential Value" required />
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={`${pipelineFieldClass} tabular-nums`}
              value={pipelineForm.potentialValue}
              onChange={(e) =>
                updateFormAndClearError('potentialValue', (f) => ({ ...f, potentialValue: sanitizePotentialValueInput(e.target.value) }))
              }
            />
            {pipelineErrors.potentialValue && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.potentialValue}</p>}
          </div>
          <div>
            <FormFieldLabel label="Tentative Closure" required />
            <DatePickerField
              className={pipelineFieldClass}
              value={pipelineForm.tentativeClosure}
              onChange={(v) => updateFormAndClearError('tentativeClosure', (f) => ({ ...f, tentativeClosure: v }))}
            />
            {pipelineErrors.tentativeClosure && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.tentativeClosure}</p>}
          </div>
          <div>
            <FormFieldLabel label="Client Name" required />
            <select
              className={pipelineFieldClass}
              value={pipelineForm.clientId}
              disabled={clientOptions.length === 0}
              onChange={(e) => updateFormAndClearError('clientId', (f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">
                {clientOptions.length === 0 ? '— No clients available —' : '— Select a client —'}
              </option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {pipelineErrors.clientId && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.clientId}</p>}
          </div>
          <div>
            <FormFieldLabel label="Stage of Opportunity" required />
            <select
              className={pipelineFieldClass}
              value={pipelineForm.stage}
              onChange={(e) => updateFormAndClearError('stage', (f) => ({ ...f, stage: e.target.value }))}
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
            {pipelineErrors.stage && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.stage}</p>}
          </div>
          <div>
            <FormFieldLabel label="Benefits" required />
            <input
              className={pipelineFieldClass}
              value={pipelineForm.benefits}
              onChange={(e) => updateFormAndClearError('benefits', (f) => ({ ...f, benefits: e.target.value }))}
            />
            {pipelineErrors.benefits && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.benefits}</p>}
          </div>
          <div>
            <FormFieldLabel label="Start Date" required />
            <DatePickerField
              className={pipelineFieldClass}
              value={pipelineForm.startDate}
              onChange={(v) => updateFormAndClearError('startDate', (f) => ({ ...f, startDate: v }))}
            />
            {pipelineErrors.startDate && <p className="mt-1 text-[11px] text-rose-600">{pipelineErrors.startDate}</p>}
          </div>
          <div className="md:col-span-3">
            <FormFieldLabel label="Add attachments" />
            <input
              ref={attachInputRef}
              type="file"
              className="sr-only"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const newFiles = Array.from(files);
                  setPipelineForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...newFiles] }));
                  e.target.value = '';
                }
              }}
            />
            <div className="enj-add-project-attachments mt-1 rounded-lg border border-[#ADACB4] bg-white p-4">
              {pipelineForm.existingAttachments.length === 0 && pipelineForm.attachments.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">There is nothing attached.</p>
                  <button
                    type="button"
                    onClick={() => attachInputRef.current?.click()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    style={{ color: '#A08149' }}
                  >
                    <Paperclip size={16} />
                    Attach file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pipelineForm.existingAttachments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Existing attachments</p>
                      <ul className="space-y-1">
                        {pipelineForm.existingAttachments.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{file.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#A08149] hover:opacity-80"
                                title="Download"
                              >
                                <Download size={16} />
                              </a>
                              <button
                                type="button"
                                className="text-rose-600 hover:opacity-80"
                                disabled={submitting}
                                onClick={() => setPipelineForm((prev) => ({ ...prev, existingAttachments: prev.existingAttachments.filter((x) => x.id !== file.id) }))}
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pipelineForm.attachments.length > 0 && (
                    <div className={pipelineForm.existingAttachments.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Files to upload</p>
                      <ul className="space-y-1">
                        {pipelineForm.attachments.map((file) => (
                          <li key={file.name} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              className="text-rose-600 shrink-0 hover:opacity-80"
                              disabled={submitting}
                              onClick={() => setPipelineForm((prev) => ({ ...prev, attachments: prev.attachments.filter((x) => x.name !== file.name) }))}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className={pipelineForm.existingAttachments.length > 0 || pipelineForm.attachments.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 text-xs font-semibold hover:opacity-80 disabled:opacity-50"
                      style={{ color: '#A08149' }}
                    >
                      <Paperclip size={14} />
                      Attach more
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <FormPageActions
          onCancel={closePipelineModal}
          onClear={clearPipelineForm}
          showClear
          onSave={() => void submitPipelineModal()}
          busy={submitting}
          saveLabel={pipelineModal === 'add' ? 'Submit' : 'Save changes'}
        />
      </FormPageShell>
    );
  }

  if (pipelineViewAll) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setPipelineViewAll(false)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-bold text-[rgba(35,35,96,1)] truncate">{screenTitle} – All Records</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <span>Year</span>
              <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#b28a44]/40 !w-[5.5rem]" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <span>Client</span>
              <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#b28a44]/40 min-w-0 max-w-[10rem]" value={category} onChange={(e) => setCategory(e.target.value)} title={category}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          <div className="min-w-0 overflow-x-auto bg-transparent">
            <table className={`${enj.tableBrand} min-w-[1000px] w-full text-xs bg-transparent border-separate`}>
              <thead>
                <tr className="bg-[#E1E3EC]">
                  <PipelineTableTh label="Pipeline Name" />
                  <PipelineTableTh label="Opportunity" />
                  <PipelineTableTh label="Benefits" />
                  <PipelineTableTh label="Potential Value" />
                  <PipelineTableTh label="Client Name" />
                  <PipelineTableTh label="Stage of Opportunity" />
                  <PipelineTableTh label="Start Date" />
                  <PipelineTableTh label="Tentative Closure" />
                  <PipelineTableTh label="Action" center />
                </tr>
              </thead>
              <tbody>
                {pagedViewAllRows.length === 0 ? (
                  <tr className="bg-transparent">
                    <td colSpan={9} className="bg-transparent px-4 py-6 text-center text-sm text-[#6B7280]">
                      No pipeline rows for this year and client. Adjust filters.
                    </td>
                  </tr>
                ) : (
                  pagedViewAllRows.map((row) => (
                    <tr key={row.id} className="border-0 bg-white rounded-[11.9px] transition-shadow hover:shadow-md">
                      <td className={`${PIPELINE_TABLE_TD} rounded-l-[11.9px] font-medium`}>{row.pipelineName}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.name}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.benefit}</td>
                      <td className={`${PIPELINE_TABLE_TD} tabular-nums`}>{row.potentialValue}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.categoryName}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.stage}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.startDateLabel}</td>
                      <td className={PIPELINE_TABLE_TD}>{row.endDateLabel}</td>
                      <td className={`${PIPELINE_TABLE_TD} rounded-r-[11.9px] text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" title="View" onClick={() => setViewingRow(row)} className={PIPELINE_TABLE_ICON_BTN} aria-label="View pipeline">
                            <Eye size={14} strokeWidth={2} aria-hidden />
                          </button>
                          {showPipelineActions && (
                            <button type="button" title="Edit" onClick={() => openEditModal(row)} className={PIPELINE_TABLE_ICON_BTN} aria-label="Edit pipeline">
                              <Pencil size={14} strokeWidth={2} aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="shrink-0 py-2">
          <PagerBar
            page={viewAllPage}
            pageSize={VIEW_ALL_PAGE_SIZE}
            total={filteredRows.length}
            onPrev={() => setViewAllPage((p) => Math.max(1, p - 1))}
            onNext={() => setViewAllPage((p) => Math.min(viewAllTotalPages, p + 1))}
          />
        </div>

        {/* View Modal (also accessible from View All screen) */}
        {viewingRow && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => {
            setViewingRow(null);
            setViewingAttachments([]);
          }}>
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-bold text-gray-900">Pipeline Details</h2>
                <button type="button" onClick={() => {
                  setViewingRow(null);
                  setViewingAttachments([]);
                }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {([
                  ['Pipeline Name', viewingRow.pipelineName],
                  ['Opportunity', viewingRow.name],
                  ['Benefits', viewingRow.benefit],
                  ['Potential Value', viewingRow.potentialValue],
                  ['Client Name', viewingRow.categoryName],
                  ['Stage of Opportunity', viewingRow.stage],
                  ['Start Date', viewingRow.startDateLabel],
                  ['Tentative Closure', viewingRow.endDateLabel],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                    <p className="font-medium text-gray-800">{value || '—'}</p>
                  </div>
                ))}
              </div>
              {viewingAttachments.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-[11px] text-gray-400 mb-3 font-medium">Attachments</p>
                  <div className="space-y-2">
                    {viewingAttachments.map((file) => (
                      <div key={file.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-gray-700 font-medium">{file.name}</p>
                          <p className="text-[11px] text-gray-500">{file.modified ? new Date(file.modified).toLocaleDateString() : '—'}</p>
                        </div>
                        {file.url && (
                          <a
                            href={file.url}
                            download={file.name}
                            className="ml-3 flex-shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                            title="Download"
                          >
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className={enj.stack}>
      <div className={enj.screenToolbar}>
        <h1 className="enj-screen-header">{screenTitle}</h1>
        {showPipelineActions && (
          <button
            type="button"
            onClick={openAddModal}
            className={`${enj.btn} ${enj.btnPrimary} gap-1.5 px-3`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add Pipeline
          </button>
        )}
      </div>

      <section className={`chart-card ${enj.card} ${enj.cardPad}`}>
        {loading ? <ScreenLoader className="min-h-[220px]" /> : null}
        <div className={`grid grid-cols-1 gap-3 lg:grid-cols-[70%_30%] lg:items-start${loading ? ' hidden' : ''}`}>
          {/* Header row (both charts same height) */}
          <div className="flex h-10 min-w-0 items-center justify-between gap-3 pr-4">
            <h2 className="enj-screen-subheader">Projects</h2>
            <div className="flex items-center gap-3 shrink-0">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <span>Year</span>
                <select
                  className={`${enj.control} h-8 !w-[5.5rem] text-sm text-gray-800`}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <span>Client</span>
                <select
                  className={`${enj.control} h-8 min-w-0 max-w-[10rem] text-sm text-gray-800`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  title={category}
                >
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="flex h-10 min-w-0 items-center border-l border-gray-100 pl-4">
            <h2 className="enj-screen-subheader">Pipeline Stage Of Opportunity</h2>
          </div>

          {/* Bar chart with legends on the right */}
          <div className="flex items-center justify-center gap-4 min-w-0 pr-4">
              <div className="flex-1 min-w-0">
                {(() => {
                  const { yMax, yTicks, quarterLabels, counts, series } = pipelineBarChart;
                  const plotLeft = 32, plotRight = 504, plotTop = 16, plotBottom = 132;
                  const plotH = plotBottom - plotTop;
                  const groupW = (plotRight - plotLeft) / 4;
                  const yScale = (v: number) => plotBottom - (v / yMax) * plotH;
                  const axisLabelFs = 9;
                  const valueLabelFs = 8;
                  const quarterLabelFs = 7;
                  const nSeries = Math.max(1, series.length);
                  return (
                    <svg viewBox="0 0 544 182" className={enj.chartSvg} role="img">
                      {yTicks.map((t) => {
                        const y = yScale(t);
                        return (
                          <g key={t}>
                            <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#edf2f7" />
                            <text
                              x="26"
                              y={y + 3}
                              fontSize={axisLabelFs}
                              fontWeight="600"
                              fill="#374151"
                              textAnchor="end"
                              className="tabular-nums"
                            >
                              {Number.isInteger(t) ? t : t.toFixed(1).replace(/\.0$/, '')}
                            </text>
                          </g>
                        );
                      })}
                      {quarterLabels.map((ql, g) => {
                        const quarterVals = counts[g] ?? [];
                        const cx0 = plotLeft + g * groupW;
                        const pad = 0.08 * groupW;
                        const inner = groupW - 2 * pad;
                        const gap = Math.min(3, nSeries > 1 ? 2 : 0);
                        const barW = Math.max(2, (inner - gap * (nSeries - 1)) / nSeries);
                        const quarterShort = ql.replace(`-${year}`, '');
                        return (
                          <g key={ql}>
                            {series.map((s, si) => {
                              const v = quarterVals[si] ?? 0;
                              const x = cx0 + pad + si * (barW + gap);
                              const barH = plotBottom - yScale(v);
                              return (
                                <g key={`${ql}-${s.label}`}>
                                  <rect
                                    className="chart-bar"
                                    x={x}
                                    y={yScale(v)}
                                    width={barW}
                                    height={barH}
                                    rx="2"
                                    fill={s.color}
                                  />
                                  {v > 0 && barH >= 10 && (
                                    <text
                                      x={x + barW / 2}
                                      y={yScale(v) - 3}
                                      fontSize={valueLabelFs}
                                      fontWeight="600"
                                      textAnchor="middle"
                                      fill="#1f2937"
                                      className="tabular-nums"
                                    >
                                      {v}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                            <text x={cx0 + groupW / 2} y="168" fontSize={quarterLabelFs} fontWeight="600" textAnchor="middle" fill="#374151">{quarterShort}</text>
                          </g>
                        );
                      })}
                      <text x="530" y="88" fontSize={quarterLabelFs} fontWeight="600" fill="#374151" textAnchor="middle" transform="rotate(90,530,88)" className="uppercase tracking-wider">Timeline</text>
                    </svg>
                  );
                })()}
              </div>
              <div className="shrink-0 max-h-[168px] space-y-2 overflow-y-auto pr-1 text-[13px] font-semibold text-gray-700">
                {pipelineBarChart.series.map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="max-w-[7rem] truncate" title={s.label}>{s.label}</span>
                  </div>
                ))}
              </div>
          </div>

          {/* Donut chart */}
          <div className="flex flex-col min-w-0 pl-4 border-l border-gray-100">
            <div className="flex flex-1 items-center justify-center">
              {donutData.total === 0 ? (
                <p className="text-xs text-gray-400 mt-4">No data</p>
              ) : (
                <DonutChartCard
                  slices={donutData.slices
                    .filter((s) => s.count > 0)
                    .map((s) => ({ label: s.label, value: s.count, color: s.color }))}
                  chartSize="md"
                  className="!rounded-lg !shadow-none !ring-0 w-full"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-transparent">
        <div className={`${enj.sectionToolbar} mb-4`}>
          <h2 className={enj.sectionTitle}>Pipeline Details</h2>
          {filteredRows.length > 0 && (
            <button type="button" onClick={() => setPipelineViewAll(true)} className={enj.sectionTextAction}>
              View All
            </button>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto bg-transparent">
          <table className={`${enj.tableBrand} w-full min-w-[900px] text-xs bg-transparent border-separate`}>
            <thead>
              <tr className="bg-[#E1E3EC]">
                <PipelineTableTh label="Pipeline name" />
                <PipelineTableTh label="Benefits" />
                <PipelineTableTh label="Potential Value" />
                <PipelineTableTh label="Start Date" />
                <PipelineTableTh label="Client Name" />
                <PipelineTableTh label="Stage of Opportunity" />
                <PipelineTableTh label="Tentative Closure" />
                <PipelineTableTh label="Action" center />
              </tr>
            </thead>
            <tbody>
              {pipelineDetailRows.length === 0 && !loading ? (
                <tr className="bg-transparent">
                  <td colSpan={tableColSpan} className="bg-transparent px-4 py-6 text-center text-sm text-[#6B7280]">
                    {showPipelineActions ? 'No pipeline rows for this year and client. Add a pipeline or adjust filters.' : 'No pipeline rows for this year and client. Adjust filters.'}
                  </td>
                </tr>
              ) : (
                pipelineDetailRows.map((row) => (
                  <tr key={row.id} className="border-0 bg-white rounded-[11.9px] transition-shadow hover:shadow-md">
                    <td className={`${PIPELINE_TABLE_TD} rounded-l-[11.9px] font-medium`}>{row.pipelineName}</td>
                    <td className={PIPELINE_TABLE_TD}>{row.benefit}</td>
                    <td className={`${PIPELINE_TABLE_TD} tabular-nums`}>{row.potentialValue}</td>
                    <td className={PIPELINE_TABLE_TD}>{row.startDateLabel}</td>
                    <td className={PIPELINE_TABLE_TD}>{row.categoryName}</td>
                    <td className={PIPELINE_TABLE_TD}>{row.stage}</td>
                    <td className={PIPELINE_TABLE_TD}>{row.endDateLabel}</td>
                    <td className={`${PIPELINE_TABLE_TD} rounded-r-[11.9px] text-center`}>
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" title="View" onClick={() => setViewingRow(row)} className={PIPELINE_TABLE_ICON_BTN} aria-label="View pipeline">
                          <Eye size={14} strokeWidth={2} aria-hidden />
                        </button>
                        {showPipelineActions && (
                          <button type="button" title="Edit" onClick={() => openEditModal(row)} className={PIPELINE_TABLE_ICON_BTN} aria-label="Edit pipeline">
                            <Pencil size={14} strokeWidth={2} aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* View Modal */}
      {viewingRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => {
          setViewingRow(null);
          setViewingAttachments([]);
        }}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-gray-900">Pipeline Details</h2>
              <button type="button" onClick={() => {
                setViewingRow(null);
                setViewingAttachments([]);
              }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {([
                ['Pipeline Name', viewingRow.pipelineName],
                ['Opportunity', viewingRow.name],
                ['Benefits', viewingRow.benefit],
                ['Potential Value', viewingRow.potentialValue],
                ['Client Name', viewingRow.categoryName],
                ['Stage of Opportunity', viewingRow.stage],
                ['Start Date', viewingRow.startDateLabel],
                ['Tentative Closure', viewingRow.endDateLabel],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800">{value || '—'}</p>
                </div>
              ))}
            </div>
            {viewingAttachments.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <p className="text-[11px] text-gray-400 mb-3 font-medium">Attachments</p>
                <div className="space-y-2">
                  {viewingAttachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-gray-700 font-medium">{file.name}</p>
                        <p className="text-[11px] text-gray-500">{file.modified ? new Date(file.modified).toLocaleDateString() : '—'}</p>
                      </div>
                      {file.url && (
                        <a
                          href={file.url}
                          download={file.name}
                          className="ml-3 flex-shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                          title="Download"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Paperclip, X } from 'lucide-react';
import type { New_subissues } from './generated/models/New_subissuesModel';
import { New_subissuesnew_subissuestatus } from './generated/models/New_subissuesModel';
import { New_subissuesService } from './generated/services/New_subissuesService';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';

type Props = {
  parentIssue: Record<string, unknown> | null;
  onBack: () => void;
  onRefresh?: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onSaved?: () => void;
};

function formatDateDisplay(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString();
}

function toIsoDate(d: Date): string {
  return d.toISOString();
}

function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SUB_ISSUE_STATUS_OPTIONS: { value: New_subissuesnew_subissuestatus; label: string }[] = [
  { value: 100000000, label: 'To Do' },
  { value: 100000001, label: 'In Progress' },
  { value: 100000002, label: 'Delayed' },
  { value: 100000003, label: 'Done' },
];

/** Gold labels/accents; field chrome matches `BusinessPipelineScreen` (plain border, native date/select). */
const GOLD = '#B09762';
const labelCls = 'text-[11px] font-medium mb-1.5 block';
const labelStyle = { color: GOLD } as const;
const fieldTextCls = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800';
const fieldDateCls = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-800 [color-scheme:light]';
const fieldSelectCls =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100';
const fieldTextareaCls =
  'w-full min-h-[6.5rem] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 resize-y';

function formatDdMmYyyy(yyyyMmDd: string) {
  const p = yyyyMmDd.split('-');
  if (p.length !== 3) return '';
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function normalizeGuid(s: string): string {
  return s.replace(/[{}]/g, '').toLowerCase().trim();
}

/** Parent issue "end" / resolution cap (Power Apps: duration ≤ task end). Uses first date found on the row. */
function getParentDurationCapDate(parent: Record<string, unknown> | null): Date | null {
  if (!parent) return null;
  const keys = [
    'new_issueresolutiondate',
    'new_issuedateresolved',
    'new_targetdate',
    'new_duedate',
    'new_enddate',
    'new_issuedate',
  ];
  for (const k of keys) {
    const v = parent[k];
    if (v == null || v === '') continue;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) continue;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

function atDayBoundary(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function applySubRecordToForm(sub: New_subissues, setters: {
  setSubIssueName: (s: string) => void;
  setDurationDate: (s: string) => void;
  setDescription: (s: string) => void;
  setSubIssueStatus: (v: New_subissuesnew_subissuestatus) => void;
}) {
  setters.setSubIssueName(String(sub.new_subissuename ?? ''));
  const dur = sub.new_issuedurationdate;
  if (dur) {
    const d = new Date(String(dur));
    if (!Number.isNaN(d.getTime())) setters.setDurationDate(dateInputValue(d));
  }
  setters.setDescription(String(sub.new_description ?? ''));
  const st = sub.new_subissuestatus;
  if (st !== undefined && st !== null && Number.isFinite(Number(st))) {
    setters.setSubIssueStatus(Number(st) as New_subissuesnew_subissuestatus);
  }
}

function statusLabel(v: New_subissuesnew_subissuestatus | undefined): string {
  if (v == null) return '—';
  return SUB_ISSUE_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? String(v);
}

function SubIssueListCard({
  sub,
  onSelect,
  disabled,
}: {
  sub: New_subissues;
  onSelect: (sub: New_subissues) => void;
  disabled?: boolean;
}) {
  const name = String(sub.new_subissuename ?? '—');
  const desc = String(sub.new_description ?? '—');
  const status = statusLabel(sub.new_subissuestatus);
  const dur = sub.new_issuedurationdate
    ? formatDateDisplay(sub.new_issuedurationdate)
    : '—';
  return (
    <div
      className="flex gap-2 rounded-lg border p-2.5 shadow-sm"
      style={{ borderColor: `${GOLD}99`, backgroundColor: 'rgba(176, 151, 98, 0.08)' }}
    >
      <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] sm:text-[11px]">
        <div>
          <p className="text-[9px] font-medium uppercase text-gray-500">Sub issue name</p>
          <p className="font-medium text-gray-900 line-clamp-1">{name}</p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase text-gray-500">Sub issue status</p>
          <p className="text-gray-800">{status}</p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase text-gray-500">Duration</p>
          <p className="tabular-nums text-gray-800">{dur}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase text-gray-500">Description</p>
          <p className="line-clamp-2 break-words text-gray-800">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-gray-200/80 bg-white text-gray-500 shadow-sm transition-colors hover:border-[#B09762]/50 hover:text-[#B09762] disabled:opacity-50"
        title="View / edit in form"
        disabled={disabled}
        onClick={() => onSelect(sub)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TeamSubIssueFormPanel({ parentIssue, onBack, onRefresh, onNotify, onSaved }: Props) {
  const [subIssueName, setSubIssueName] = useState('');
  const [durationDate, setDurationDate] = useState(() => dateInputValue(new Date()));
  const [description, setDescription] = useState('');
  const [subIssueStatus, setSubIssueStatus] = useState<New_subissuesnew_subissuestatus>(100000000);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subIssues, setSubIssues] = useState<New_subissues[]>([]);
  const [subIssuesLoading, setSubIssuesLoading] = useState(false);
  const [editingSubIssueId, setEditingSubIssueId] = useState<string | null>(null);

  const initFromParent = useCallback(() => {
    if (!parentIssue) {
      setSubIssueName('');
      setDurationDate(dateInputValue(new Date()));
      setDescription('');
      setSubIssueStatus(100000000);
      return;
    }
    const title = String(parentIssue.new_issuetitle ?? 'Issue').trim() || 'Issue';
    setSubIssueName(`Sub: ${title}`.slice(0, 850));
    const raised = parentIssue.new_issuedate ?? parentIssue.createdon;
    const d = raised ? new Date(String(raised)) : new Date();
    if (!Number.isNaN(d.getTime())) setDurationDate(dateInputValue(d));
    else setDurationDate(dateInputValue(new Date()));
    setDescription('');
    setSubIssueStatus(100000000);
  }, [parentIssue]);

  const parentId = parentIssue ? String(parentIssue.new_issueid ?? '').trim() : '';

  useEffect(() => {
    setEditingSubIssueId(null);
    initFromParent();
  }, [initFromParent]);

  const loadSubIssues = useCallback(async () => {
    if (!parentId) {
      setSubIssues([]);
      return;
    }
    setSubIssuesLoading(true);
    try {
      const pid = normalizeGuid(parentId);
      const res = await New_subissuesService.getAll({
        filter: `new_issueid eq '${pid}'`,
      });
      let rows: New_subissues[] = res.success && res.data ? res.data : [];
      if (rows.length === 0) {
        const all = await New_subissuesService.getAll();
        if (all.success && all.data?.length) {
          rows = all.data.filter((r) => normalizeGuid(String(r.new_issueid ?? '')) === pid);
        }
      }
      const rank = (r: New_subissues) => new Date(String(r.modifiedon ?? r.createdon ?? 0)).getTime();
      rows.sort((a, b) => rank(b) - rank(a));
      setSubIssues(rows);
    } catch {
      setSubIssues([]);
    } finally {
      setSubIssuesLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    void loadSubIssues();
  }, [loadSubIssues]);

  const beginNewSubIssue = useCallback(() => {
    setErrors({});
    setEditingSubIssueId(null);
    initFromParent();
  }, [initFromParent]);

  const selectSubForEdit = useCallback(
    (sub: New_subissues) => {
      const id = String(sub.new_subissueid ?? '').trim();
      if (!id) return;
      setEditingSubIssueId(id);
      applySubRecordToForm(sub, { setSubIssueName, setDurationDate, setDescription, setSubIssueStatus });
      setErrors({});
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, saving]);

  const submit = async () => {
    if (!parentIssue || !parentId) {
      onNotify?.('error', 'No parent issue selected.');
      return;
    }
    const next: Record<string, string> = {};
    if (!subIssueName.trim()) next.subIssueName = 'Required';
    if (!durationDate) next.durationDate = 'Required';
    if (!description.trim()) next.description = 'Required';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      onNotify?.('error', 'Please provide all required fields.');
      return;
    }
    const cap = getParentDurationCapDate(parentIssue);
    if (cap) {
      const picked = atDayBoundary(new Date(`${durationDate}T12:00:00`));
      const capT = atDayBoundary(cap);
      if (picked > capT) {
        const endLabel = cap.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
        onNotify?.(
          'error',
          `Issue duration date must be on or before the parent issue end / target date (${endLabel}).`,
        );
        setErrors((e) => ({ ...e, durationDate: 'Date exceeds parent limit' }));
        return;
      }
    }
    setErrors({});
    setSaving(true);
    try {
      const raisedIso = toIsoDate(new Date(`${durationDate}T12:00:00`));

      const subPayload: Record<string, unknown> = {
        new_subissuename: subIssueName.trim().slice(0, 850),
        new_issueid: parentId,
        new_description: description.trim(),
        new_issuedurationdate: raisedIso,
        new_subissuestatus: subIssueStatus,
        statecode: 0,
      };

      if (editingSubIssueId) {
        const subRes = await New_subissuesService.update(
          editingSubIssueId,
          {
            new_subissuename: subIssueName.trim().slice(0, 850),
            new_description: description.trim(),
            new_issuedurationdate: raisedIso,
            new_subissuestatus: subIssueStatus,
          } as Parameters<typeof New_subissuesService.update>[1],
        );
        if (!subRes.success) throw new Error(subRes.error?.message ?? 'Failed to update sub issue');
        onNotify?.('success', 'Sub issue has been successfully saved.');
      } else {
        const subRes = await New_subissuesService.create(
          subPayload as Parameters<typeof New_subissuesService.create>[0],
        );
        if (!subRes.success) throw new Error(subRes.error?.message ?? 'Failed to create sub issue');
        onNotify?.('success', 'Sub issue has been successfully submitted.');
      }

      onRefresh?.();
      onSaved?.();
      await loadSubIssues();
      beginNewSubIssue();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-sub-issue-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => !saving && onBack()}
        aria-label="Close"
      />
      <div className="relative flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-2xl">
        {saving && <ScreenLoader overlay className="rounded-xl" />}

        <div className="flex min-h-0 flex-1 flex-col md:min-h-[20rem] md:flex-row">
          {/* Left ~40%: preview / parent context */}
          <aside className="order-2 flex min-h-[11rem] max-h-[40vh] flex-col border-t border-gray-200/80 bg-gray-50/30 md:order-1 md:max-h-none md:w-[40%] md:min-w-[14rem] md:border-t-0 md:border-r md:border-gray-200/80">
            <div className="flex min-h-0 flex-1 items-stretch p-3 sm:p-4">
              {!parentId ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-gray-200/90 bg-white px-4 text-sm text-gray-400">
                  No Data Found
                </div>
              ) : subIssuesLoading ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200/90 bg-white text-sm text-gray-500">
                  Loading sub issues…
                </div>
              ) : subIssues.length === 0 ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-gray-200/90 bg-white px-4 text-center text-sm text-gray-400">
                  No sub issues yet. Use the form to add one.
                </div>
              ) : (
                <div className="w-full min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {subIssues.map((s) => {
                    const sid = String(s.new_subissueid ?? '');
                    return (
                      <div
                        key={sid}
                        className={
                          editingSubIssueId && sid === editingSubIssueId
                            ? 'ring-1 ring-[#B09762]/60 ring-offset-1 rounded-lg'
                            : undefined
                        }
                      >
                        <SubIssueListCard
                          sub={s}
                          onSelect={selectSubForEdit}
                          disabled={saving}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Right: title row + form */}
          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col md:order-2">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100/90 px-4 pb-3 pt-4 sm:px-5">
              <h2
                id="team-sub-issue-title"
                className="text-base font-bold leading-tight text-gray-900 sm:text-lg"
              >
                {editingSubIssueId ? 'Edit Sub Issue' : 'Add New Sub Issue'}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!saving) beginNewSubIssue();
                  }}
                  className="inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-semibold transition-colors enabled:hover:bg-amber-50/80 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: GOLD, color: GOLD }}
                  disabled={saving}
                  title="Clear form to add another sub issue"
                >
                  + Add Sub Issue
                </button>
                <button
                  type="button"
                  onClick={() => !saving && onBack()}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Sub Issue Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={fieldTextCls}
                    value={subIssueName}
                    onChange={(e) => {
                      setSubIssueName(e.target.value);
                      setErrors((e0) => ({ ...e0, subIssueName: '' }));
                    }}
                    disabled={saving}
                    maxLength={850}
                    placeholder=""
                  />
                  {errors.subIssueName && <p className="mt-1 text-[11px] text-rose-600">{errors.subIssueName}</p>}
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Issue Duration Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      className={fieldDateCls}
                      value={durationDate}
                      onChange={(e) => {
                        setDurationDate(e.target.value);
                        setErrors((e0) => ({ ...e0, durationDate: '' }));
                      }}
                      disabled={saving}
                    />
                  </div>
                  {durationDate ? (
                    <p className="mt-1.5 text-[10px] tabular-nums text-gray-500" aria-hidden>
                      {formatDdMmYyyy(durationDate)}
                    </p>
                  ) : null}
                  {errors.durationDate && <p className="mt-1 text-[11px] text-rose-600">{errors.durationDate}</p>}
                </div>

                <div className="min-w-0 sm:col-span-1">
                  <label className={labelCls} style={labelStyle}>
                    Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    className={fieldTextareaCls}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setErrors((e0) => ({ ...e0, description: '' }));
                    }}
                    disabled={saving}
                  />
                  {errors.description && <p className="mt-1 text-[11px] text-rose-600">{errors.description}</p>}
                </div>
                <div className="min-w-0 sm:col-span-1">
                  <label className={labelCls} style={labelStyle}>
                    Sub Issue Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className={fieldSelectCls}
                    value={String(subIssueStatus)}
                    onChange={(e) => {
                      const n = Number(e.target.value) as New_subissuesnew_subissuestatus;
                      if (Number.isFinite(n)) setSubIssueStatus(n);
                    }}
                    disabled={saving}
                  >
                    {SUB_ISSUE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 w-full min-w-0">
                <p className={labelCls} style={labelStyle}>
                  Attachments
                </p>
                <div className="min-h-[5.5rem] rounded-md border border-dashed border-gray-300/90 bg-slate-50/40 px-3 py-6">
                  <p className="text-center text-[12px] text-gray-500">There is nothing attached.</p>
                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium hover:opacity-80"
                      style={{ color: GOLD }}
                      disabled
                    >
                      <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                      Attach file
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-gray-100/90 bg-white px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={() => !saving && onBack()}
            className="h-9 min-w-[5.5rem] rounded-md border border-gray-200 bg-white px-5 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50/80"
            style={{ color: GOLD }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="h-9 min-w-[5.5rem] rounded-md px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: GOLD }}
            disabled={saving}
          >
            {saving ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}

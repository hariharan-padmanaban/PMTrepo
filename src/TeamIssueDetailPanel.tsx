import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, RefreshCw } from 'lucide-react';
import { DatePickerField } from './EnjDatePicker';
import { enj } from './ui/enjForm';
import { New_issuesnew_issuestatus } from './generated/models/New_issuesModel';
import { New_issuesService } from './generated/services/New_issuesService';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';
import { IssueLogsModal } from './IssueLogsModal';
import { fetchAttachments, uploadAttachments, downloadFile, type AttachmentFile } from './services/attachmentService';

type Props = {
  issue: Record<string, unknown> | null;
  onBack: () => void;
  onRefreshWorkspace: () => void;
  onOpenSubIssue: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onIssueUpdated?: (row: Record<string, unknown>) => void;
};

const labelGold = 'text-[11px] font-medium text-secondary mb-1 block';
const inputBase = enj.control;
const areaCls = `${enj.textarea} min-h-[6.5rem] resize-y`;

const ISSUE_STATUS_ORDER: { value: New_issuesnew_issuestatus; label: string }[] = [
  { value: 100000000, label: 'Open' },
  { value: 100000003, label: 'Closed' },
];

function displayIssueId(row: Record<string, unknown>): string {
  const raw = String(row.new_issueid ?? '').replace(/[{}]/g, '');
  if (raw.length >= 6) return raw.slice(0, 8).toUpperCase();
  return raw || '—';
}

function formatShortDate(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString();
}

function toDateInputValue(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toIsoNoon(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
}

function ReadonlyCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-gray-400 mb-1">{label}</p>
      <div className="min-h-8 rounded border border-gray-200 bg-gray-50/80 px-2 py-1.5 text-[14px] text-gray-700" title={value}>
        {value}
      </div>
    </div>
  );
}

export function TeamIssueDetailPanel({ issue, onBack, onRefreshWorkspace, onOpenSubIssue, onNotify, onIssueUpdated }: Props) {
  const [showIssueLogs, setShowIssueLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentFile[]>([]);
  const [form, setForm] = useState({
    status: 100000000 as New_issuesnew_issuestatus,
    impacted: '',
    response: '',
    description: '',
    issueDate: toDateInputValue(null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const id = issue ? String(issue.new_issueid ?? '').replace(/[{}]/g, '').trim() : '';

  const resetFromIssue = useCallback(() => {
    if (!issue) return;
    const st = issue.new_issuestatus;
    const n = typeof st === 'number' ? st : Number(st);
    setForm({
      status: (Number.isFinite(n) ? n : 100000000) as New_issuesnew_issuestatus,
      impacted: String(issue.new_issueimpactedarea ?? ''),
      response: String(issue.new_issueresponse ?? ''),
      description: String(issue.new_description ?? ''),
      issueDate: toDateInputValue(issue.new_issuedate ?? issue.createdon),
    });
    setErrors({});
    setAttachmentFiles([]);

    const attachmentId = String(issue.new_attachmentid ?? '').trim();
    if (attachmentId) {
      fetchAttachments(attachmentId)
        .then(setExistingAttachments)
        .catch(() => setExistingAttachments([]));
    } else {
      setExistingAttachments([]);
    }
  }, [issue]);

  const addFilesFromList = (fileList: FileList) => {
    const newFiles = Array.from(fileList).filter(
      (f) => !attachmentFiles.some((existing) => existing.name === f.name),
    );
    if (newFiles.length > 0) setAttachmentFiles((prev) => [...prev, ...newFiles]);
  };

  useEffect(() => {
    resetFromIssue();
  }, [resetFromIssue]);

  const readOnly = issue
    ? {
        id: displayIssueId(issue),
        severity: String(issue.new_issueseverityname ?? '—'),
        linkTo: String(issue.new_raisedissue ?? issue.new_projectname ?? '—'),
        title: String(issue.new_issuetitle ?? '—'),
        raised: formatShortDate(issue.new_issuedate ?? issue.createdon),
        raisedBy: String(issue.createdbyname ?? '—'),
        owner: String(issue.new_issueowner ?? '—'),
        resolved:
          [100000002, 100000003].includes(Number(issue.new_issuestatus))
            ? formatShortDate(issue.modifiedon)
            : '—',
        assign: String(issue.new_assigntoteammember ?? '—'),
      }
    : null;

  const save = async () => {
    if (!id || !issue) {
      onNotify?.('error', 'No issue selected.');
      return;
    }

    // Comprehensive validation
    const next: Record<string, string> = {};
    const trimmedImpacted = form.impacted.trim();
    const trimmedResponse = form.response.trim();
    const trimmedDesc = form.description.trim();

    if (!trimmedImpacted) {
      next.impacted = 'Impacted Area is required';
    } else if (trimmedImpacted.length > 500) {
      next.impacted = 'Impacted Area cannot exceed 500 characters';
    }

    if (!trimmedResponse) {
      next.response = 'Response is required';
    } else if (trimmedResponse.length > 500) {
      next.response = 'Response cannot exceed 500 characters';
    }

    if (!trimmedDesc) {
      next.description = 'Description is required';
    } else if (trimmedDesc.length > 2000) {
      next.description = 'Description cannot exceed 2000 characters';
    }

    if (!form.issueDate) {
      next.issueDate = 'Issue Date is required';
    } else {
      const selectedDate = new Date(`${form.issueDate}T12:00:00`);
      if (Number.isNaN(selectedDate.getTime())) {
        next.issueDate = 'Invalid date format';
      }
    }

    if (Object.keys(next).length) {
      setErrors(next);
      const errorList = Object.values(next).join(', ');
      onNotify?.('error', `Validation failed: ${errorList}`);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const attachmentId = String(issue.new_attachmentid ?? '').trim() ||
        (globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`);

      const payload: Parameters<typeof New_issuesService.update>[1] = {
        new_issuestatus: form.status,
        new_issueimpactedarea: trimmedImpacted,
        new_issueresponse: trimmedResponse,
        new_description: trimmedDesc,
        new_issuedate: toIsoNoon(form.issueDate),
      };

      if (attachmentFiles.length > 0 || !String(issue.new_attachmentid ?? '').trim()) {
        (payload as Record<string, unknown>).new_attachmentid = attachmentId;
      }

      const res = await New_issuesService.update(id, payload);
      if (!res.success) {
        const errorMsg = res.error?.message ?? 'Update failed';
        throw new Error(`Issue update failed: ${errorMsg}`);
      }
      const data = res.data;

      if (attachmentFiles.length > 0) {
        const { uploaded, errors: uploadErrs } = await uploadAttachments(attachmentId, attachmentFiles);
        if (uploaded.length > 0) {
          setExistingAttachments(await fetchAttachments(attachmentId));
        }
        if (uploaded.length > 0 && uploadErrs.length === 0) {
          onNotify?.('success', 'Issue saved and files uploaded.');
        } else if (uploaded.length > 0 && uploadErrs.length > 0) {
          onNotify?.('info', `Issue saved. ${uploaded.length} file(s) uploaded; some failed.`);
        } else if (uploadErrs.length > 0) {
          onNotify?.('info', `Issue saved. No files uploaded — ${uploadErrs[0] ?? ''}`);
        } else {
          onNotify?.('success', 'Issue saved successfully.');
        }
      } else {
        onNotify?.('success', 'Issue saved successfully.');
      }

      if (data) {
        onIssueUpdated?.({ ...issue, ...data, new_attachmentid: attachmentId } as Record<string, unknown>);
      } else {
        onRefreshWorkspace();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An unexpected error occurred';
      onNotify?.('error', errorMsg);
      console.error('Issue save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!issue || !readOnly) {
    return null;
  }

  return (
    <section className="relative w-full max-w-6xl">
      {saving && <ScreenLoader overlay className="rounded-xl" />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[16px] font-bold text-primary">
          <button type="button" className="font-bold text-primary underline" onClick={onBack}>
            Issues
          </button>
          <span className="text-gray-300"> / </span>
          <span className="text-primary">Issue Details</span>
        </p>
        <button
          type="button"
          onClick={() => onRefreshWorkspace()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-3">
              <ReadonlyCell label="Issue ID" value={readOnly.id} />
              <ReadonlyCell label="Issue Severity" value={readOnly.severity} />
              <ReadonlyCell label="Link to" value={readOnly.linkTo} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Issue Title" value={readOnly.title} />
              <ReadonlyCell label="Raised Date" value={readOnly.raised} />
              <ReadonlyCell label="Issue raised by" value={readOnly.raisedBy} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Issue Owner" value={readOnly.owner} />
              <ReadonlyCell label="Date Resolved" value={readOnly.resolved} />
              <ReadonlyCell label="Assign to" value={readOnly.assign} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (id) setShowIssueLogs(true);
                else onNotify?.('error', 'Cannot open issue logs: missing issue id.');
              }}
              className="h-9 min-w-[6rem] rounded-md border border-gray-300 bg-white px-4 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Issue Logs
            </button>
            <button
              type="button"
              onClick={onOpenSubIssue}
              className={`${enj.btnOutline} min-w-[6rem] text-xs`}
            >
              Sub Issue
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelGold}>
                Issue Status <span className="text-rose-500">*</span>
              </label>
              <select
                className={inputBase}
                value={String(form.status)}
                onChange={(e) => {
                  setForm((f) => ({ ...f, status: Number(e.target.value) as New_issuesnew_issuestatus }));
                  setErrors((e0) => ({ ...e0, status: '' }));
                }}
                disabled={saving}
              >
                {ISSUE_STATUS_ORDER.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelGold}>
                Issue Impacted Area <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputBase}
                placeholder="Eg: Front-End"
                value={form.impacted}
                onChange={(e) => {
                  setForm((f) => ({ ...f, impacted: e.target.value }));
                  setErrors((e0) => ({ ...e0, impacted: '' }));
                }}
                disabled={saving}
              />
              {errors.impacted && <p className="mt-1 text-[11px] text-rose-600">{errors.impacted}</p>}
            </div>
            <div>
              <label className={labelGold}>
                Issue Response <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputBase}
                value={form.response}
                onChange={(e) => {
                  setForm((f) => ({ ...f, response: e.target.value }));
                  setErrors((e0) => ({ ...e0, response: '' }));
                }}
                disabled={saving}
              />
              {errors.response && <p className="mt-1 text-[11px] text-rose-600">{errors.response}</p>}
            </div>
            <div>
              <label className={labelGold}>
                Issue Raised Date <span className="text-rose-500">*</span>
              </label>
              <DatePickerField
                className={inputBase}
                value={form.issueDate}
                onChange={(v) => {
                  setForm((f) => ({ ...f, issueDate: v }));
                  setErrors((e0) => ({ ...e0, issueDate: '' }));
                }}
                disabled={saving}
              />
              {errors.issueDate && <p className="mt-1 text-[11px] text-rose-600">{errors.issueDate}</p>}
            </div>
          </div>
          <div>
            <label className={labelGold}>
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              className={areaCls}
              value={form.description}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }));
                setErrors((e0) => ({ ...e0, description: '' }));
              }}
              disabled={saving}
            />
            {errors.description && <p className="mt-1 text-[11px] text-rose-600">{errors.description}</p>}
          </div>
          <div>
            <p className={labelGold}>Attachments</p>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              disabled={saving}
              onChange={(e) => {
                if (e.target.files?.length) addFilesFromList(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="rounded-lg border border-[#d6dbe8] bg-white p-4">
              {attachmentFiles.length === 0 && existingAttachments.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">There is nothing attached.</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    style={{ color: '#A08149' }}
                  >
                    <Paperclip size={16} />
                    Attach file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {attachmentFiles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Files to upload</p>
                      <ul className="space-y-1">
                        {attachmentFiles.map((f) => (
                          <li key={f.name} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{f.name}</span>
                            <button
                              type="button"
                              className="text-rose-600 shrink-0 hover:underline text-[11px]"
                              disabled={saving}
                              onClick={() => setAttachmentFiles((prev) => prev.filter((x) => x.name !== f.name))}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {existingAttachments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Current attachments</p>
                      <ul className="space-y-1">
                        {existingAttachments.map((f) => (
                          <li key={f.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => downloadFile(f).catch(() => onNotify?.('error', 'Download failed'))}
                              className="text-blue-600 shrink-0 hover:underline text-[11px]"
                            >
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
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

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => !saving && onBack()}
            className="h-9 min-w-[5.5rem] rounded-md border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className={`${enj.btnPrimary} min-w-[5.5rem]`}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {showIssueLogs && id ? <IssueLogsModal issueId={id} onClose={() => setShowIssueLogs(false)} /> : null}
    </section>
  );
}

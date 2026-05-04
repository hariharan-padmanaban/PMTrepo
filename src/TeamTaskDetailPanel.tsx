import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, RefreshCw } from 'lucide-react';
import { enj } from './ui/enjForm';
import { New_tasksnew_taskstatus } from './generated/models/New_tasksModel';
import { New_tasksService } from './generated/services/New_tasksService';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';
import { fetchAttachments, uploadAttachments, downloadFile, type AttachmentFile } from './services/attachmentService';

type Props = {
  task: Record<string, unknown> | null;
  onBack: () => void;
  onRefreshWorkspace: () => void;
  onOpenSubTask: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onTaskUpdated?: (row: Record<string, unknown>) => void;
};

const labelGold = 'text-[11px] font-medium text-secondary mb-1 block';
const inputBase = enj.control;
const areaCls = `${enj.textarea} min-h-[6.5rem] resize-y`;

const TASK_STATUS_ORDER: { value: New_tasksnew_taskstatus; label: string }[] = [
  { value: 100000000, label: 'Not Started' },
  { value: 100000001, label: 'In Progress' },
  { value: 100000002, label: 'Completed' },
  { value: 100000003, label: 'On Hold' },
];

function displayTaskId(row: Record<string, unknown>): string {
  const raw = String(row.new_taskid ?? '').replace(/[{}]/g, '');
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

export function TeamTaskDetailPanel({ task, onBack, onRefreshWorkspace, onOpenSubTask, onNotify, onTaskUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentFile[]>([]);
  const [form, setForm] = useState({
    status: 100000000 as New_tasksnew_taskstatus,
    priority: '',
    progress: '',
    description: '',
    endDate: toDateInputValue(null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const id = task ? String(task.new_taskid ?? '').replace(/[{}]/g, '').trim() : '';

  const resetFromTask = useCallback(() => {
    if (!task) return;
    const st = task.new_taskstatus;
    const n = typeof st === 'number' ? st : Number(st);
    setForm({
      status: (Number.isFinite(n) ? n : 100000000) as New_tasksnew_taskstatus,
      priority: String(task.new_priorityname ?? ''),
      progress: String(task.new_progresslevel ?? ''),
      description: String(task.new_description ?? ''),
      endDate: toDateInputValue(task.new_enddate ?? task.createdon),
    });
    setErrors({});
    setAttachmentFiles([]);

    const attachmentId = String(task.new_attachmentid ?? '').trim();
    if (attachmentId) {
      fetchAttachments(attachmentId)
        .then(setExistingAttachments)
        .catch(() => setExistingAttachments([]));
    } else {
      setExistingAttachments([]);
    }
  }, [task]);

  const addFilesFromList = (fileList: FileList) => {
    const newFiles = Array.from(fileList).filter(
      (f) => !attachmentFiles.some((existing) => existing.name === f.name),
    );
    if (newFiles.length > 0) setAttachmentFiles((prev) => [...prev, ...newFiles]);
  };

  useEffect(() => {
    resetFromTask();
  }, [resetFromTask]);

  const readOnly = task
    ? {
        id: displayTaskId(task),
        project: String(task.new_projectname ?? task.new_taskprojectname ?? '—'),
        title: String(task.new_tasktitle ?? '—'),
        created: formatShortDate(task.createdon),
        createdBy: String(task.createdbyname ?? '—'),
        assignee: String(task.new_assigntoteammember ?? '—'),
        completed: [100000002].includes(Number(task.new_taskstatus)) ? formatShortDate(task.new_taskcompleteddate ?? task.modifiedon) : '—',
      }
    : null;

  const save = async () => {
    if (!id || !task) {
      onNotify?.('error', 'No task selected.');
      return;
    }

    // Comprehensive validation
    const next: Record<string, string> = {};
    const trimmedDesc = form.description.trim();

    if (!trimmedDesc) {
      next.description = 'Description is required';
    } else if (trimmedDesc.length > 2000) {
      next.description = 'Description cannot exceed 2000 characters';
    }

    if (!form.endDate) {
      next.endDate = 'End Date is required';
    } else {
      const selectedDate = new Date(`${form.endDate}T12:00:00`);
      if (Number.isNaN(selectedDate.getTime())) {
        next.endDate = 'Invalid date format';
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
      const attachmentId = String(task.new_attachmentid ?? '').trim() ||
        (globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`);

      const payload: Parameters<typeof New_tasksService.update>[1] = {
        new_taskstatus: form.status,
        new_description: trimmedDesc,
        new_enddate: toIsoNoon(form.endDate),
      };

      if (attachmentFiles.length > 0 || !String(task.new_attachmentid ?? '').trim()) {
        (payload as Record<string, unknown>).new_attachmentid = attachmentId;
      }

      const res = await New_tasksService.update(id, payload);
      if (!res.success) {
        const errorMsg = res.error?.message ?? 'Update failed';
        throw new Error(`Task update failed: ${errorMsg}`);
      }
      const data = res.data;

      if (attachmentFiles.length > 0) {
        const { uploaded, errors: uploadErrs } = await uploadAttachments(attachmentId, attachmentFiles);
        if (uploaded.length > 0) {
          setExistingAttachments(await fetchAttachments(attachmentId));
        }
        if (uploaded.length > 0 && uploadErrs.length === 0) {
          onNotify?.('success', 'Task saved and files uploaded.');
        } else if (uploaded.length > 0 && uploadErrs.length > 0) {
          onNotify?.('info', `Task saved. ${uploaded.length} file(s) uploaded; some failed.`);
        } else if (uploadErrs.length > 0) {
          onNotify?.('info', `Task saved. No files uploaded — ${uploadErrs[0] ?? ''}`);
        } else {
          onNotify?.('success', 'Task saved successfully.');
        }
      } else {
        onNotify?.('success', 'Task saved successfully.');
      }

      if (data) {
        onTaskUpdated?.({ ...task, ...data, new_attachmentid: attachmentId } as Record<string, unknown>);
      } else {
        onRefreshWorkspace();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An unexpected error occurred';
      onNotify?.('error', errorMsg);
      console.error('Task save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!task || !readOnly) {
    return null;
  }

  return (
    <section className="relative w-full max-w-6xl mx-auto">
      {saving && <ScreenLoader overlay className="rounded-xl" />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
        <p className="text-[16px] font-bold text-primary">
          <button type="button" className="font-bold text-primary underline" onClick={onBack}>
            Tasks
          </button>
          <span className="text-gray-300"> / </span>
          <span className="text-primary">Task Details</span>
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

      <div className="mx-4 sm:mx-0 bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-3">
              <ReadonlyCell label="Task ID" value={readOnly.id} />
              <ReadonlyCell label="Project" value={readOnly.project} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Task Title" value={readOnly.title} />
              <ReadonlyCell label="Created Date" value={readOnly.created} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Created By" value={readOnly.createdBy} />
              <ReadonlyCell label="Assigned To" value={readOnly.assignee} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onOpenSubTask}
              className={`${enj.btnOutline} min-w-[6rem] text-xs`}
            >
              Sub Task
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelGold}>
                Task Status <span className="text-rose-500">*</span>
              </label>
              <select
                className={inputBase}
                value={String(form.status)}
                onChange={(e) => {
                  setForm((f) => ({ ...f, status: Number(e.target.value) as New_tasksnew_taskstatus }));
                  setErrors((e0) => ({ ...e0, status: '' }));
                }}
                disabled={saving}
              >
                {TASK_STATUS_ORDER.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelGold}>Priority</label>
              <input
                className={inputBase}
                value={form.priority}
                disabled
              />
            </div>
            <div>
              <label className={labelGold}>
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                className={`${inputBase} [color-scheme:light]`}
                value={form.endDate}
                onChange={(e) => {
                  setForm((f) => ({ ...f, endDate: e.target.value }));
                  setErrors((e0) => ({ ...e0, endDate: '' }));
                }}
                disabled={saving}
              />
              {errors.endDate && <p className="mt-1 text-[11px] text-rose-600">{errors.endDate}</p>}
            </div>
            <div>
              <label className={labelGold}>Progress</label>
              <input
                className={inputBase}
                value={form.progress}
                disabled
              />
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

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:px-5 shrink-0">
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

      <div className="pb-6" />
    </section>
  );
}

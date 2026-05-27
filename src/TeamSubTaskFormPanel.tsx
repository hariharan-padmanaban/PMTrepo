import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Paperclip, X } from 'lucide-react';
import type { ToastType } from './NotificationToast';
import { DatePickerField } from './EnjDatePicker';
import { ScreenLoader } from './ScreenLoader';
import { fetchAttachments, uploadAttachments, downloadFile, type AttachmentFile } from './services/attachmentService';
import { New_subtasksService } from './generated/services/New_subtasksService';

type Props = {
  parentTask: Record<string, unknown> | null;
  onBack: () => void;
  onRefresh?: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onSaved?: () => void;
};

type SubTask = Record<string, unknown>;


function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const GOLD = '#B09762';
const labelCls = 'text-[11px] font-medium mb-1.5 block';
const labelStyle = { color: GOLD } as const;
const fieldTextCls = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800';
const fieldDateCls = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-800 [color-scheme:light]';
const fieldTextareaCls = 'w-full min-h-[6.5rem] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 resize-y';

function formatDdMmYyyy(yyyyMmDd: string) {
  const p = yyyyMmDd.split('-');
  if (p.length !== 3) return '';
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function SubTaskCard({
  sub,
  onSelect,
  disabled,
}: {
  sub: SubTask;
  onSelect: (sub: SubTask) => void;
  disabled?: boolean;
}) {
  const name = String(sub.new_subtaskname ?? '—');
  const desc = String(sub.new_description ?? '—');
  const due = sub.new_duedate ? new Date(String(sub.new_duedate)).toLocaleDateString() : '—';

  return (
    <div
      className="flex gap-2 rounded-lg border p-2.5 shadow-sm"
      style={{ borderColor: `${GOLD}99`, backgroundColor: 'rgba(176, 151, 98, 0.08)' }}
    >
      <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] sm:text-[11px]">
        <div>
          <p className="text-[9px] font-medium uppercase text-gray-500">Sub task name</p>
          <p className="font-medium text-gray-900 line-clamp-1">{name}</p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase text-gray-500">Due Date</p>
          <p className="text-gray-800">{due}</p>
        </div>
        <div className="col-span-2">
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

export function TeamSubTaskFormPanel({ parentTask, onBack, onRefresh, onNotify, onSaved }: Props) {
  const [subTaskName, setSubTaskName] = useState('');
  const [dueDate, setDueDate] = useState(() => dateInputValue(new Date()));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [subTasksLoading, setSubTasksLoading] = useState(false);
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentFile[]>([]);


  const initFromParent = useCallback(() => {
    // Reset form to empty state
    setSubTaskName('');
    setDueDate(dateInputValue(new Date()));
    setDescription('');
  }, []);

  const parentId = parentTask ? String(parentTask.new_taskid ?? '').trim() : '';

  const loadSubTasks = useCallback(async () => {
    if (!parentId) {
      setSubTasks([]);
      return;
    }
    setSubTasksLoading(true);
    try {
      // Try fetching with filter first
      const res = await New_subtasksService.getAll({
        filter: `_new_taskid_value eq '${parentId}'`,
      });

      let rows: SubTask[] = res.success && res.data ? (res.data as any) : [];

      // If filter didn't work, fetch all and filter manually
      if (rows.length === 0) {
        const all = await New_subtasksService.getAll();
        if (all.success && all.data?.length) {
          const normalizedParentId = String(parentId).toLowerCase().trim();
          rows = (all.data as any).filter((r: any) => {
            const taskId = String(r.new_taskid ?? r._new_taskid_value ?? '').toLowerCase().trim();
            return taskId === normalizedParentId;
          });
        }
      }

      // Sort by most recent first
      rows.sort((a, b) => {
        const aTime = new Date(String(a.modifiedon ?? a.createdon ?? 0)).getTime();
        const bTime = new Date(String(b.modifiedon ?? b.createdon ?? 0)).getTime();
        return bTime - aTime;
      });

      setSubTasks(rows);
    } catch (e) {
      setSubTasks([]);
    } finally {
      setSubTasksLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    setEditingSubTaskId(null);
    initFromParent();
  }, [initFromParent]);

  useEffect(() => {
    void loadSubTasks();
  }, [loadSubTasks]);

  const beginNewSubTask = useCallback(() => {
    setErrors({});
    setEditingSubTaskId(null);
    initFromParent();
    setAttachmentFiles([]);
    setExistingAttachments([]);
  }, [initFromParent]);

  const selectSubForEdit = useCallback(
    (sub: SubTask) => {
      const id = String(sub.new_subtaskid ?? '').trim();
      if (!id) return;
      setEditingSubTaskId(id);
      setSubTaskName(String(sub.new_subtaskname ?? '').trim());
      const dur = sub.new_duedate;
      if (dur) {
        const d = new Date(String(dur));
        if (!Number.isNaN(d.getTime())) setDueDate(dateInputValue(d));
      }
      setDescription(String(sub.new_description ?? ''));
      setErrors({});
      setAttachmentFiles([]);

      const attachmentId = String((sub as any).new_attachmentid ?? '').trim();
      if (attachmentId) {
        fetchAttachments(attachmentId)
          .then(setExistingAttachments)
          .catch(() => setExistingAttachments([]));
      } else {
        setExistingAttachments([]);
      }
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

  const addFilesFromList = (fileList: FileList) => {
    const newFiles = Array.from(fileList).filter(
      (f) => !attachmentFiles.some((existing) => existing.name === f.name),
    );
    if (newFiles.length > 0) setAttachmentFiles((prev) => [...prev, ...newFiles]);
  };

  const submit = async () => {
    try {
      const name = subTaskName.trim();
      const date = dueDate.trim();

      // Validate
      if (!name || !date) {
        onNotify?.('error', 'Sub Task Name and Due Date are required');
        return;
      }

      if (!parentId) {
        onNotify?.('error', 'Parent task information is missing');
        return;
      }

      setSaving(true);

      // Generate attachment ID
      const attachmentId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

      if (editingSubTaskId) {
        // UPDATE
        const updatePayload: Record<string, unknown> = {
          new_subtaskname: name,
          new_duedate: new Date(`${date}T12:00:00`).toISOString(),
          new_description: description.trim(),
        };
        if (attachmentFiles.length > 0) {
          updatePayload.new_attachmentid = attachmentId;
        }

        const res = await New_subtasksService.update(editingSubTaskId, updatePayload as any);
        if (!res.success) throw new Error(res.error?.message || 'Update failed');
        onNotify?.('success', 'Sub-task updated successfully');
      } else {
        // CREATE
        const payload: Record<string, unknown> = {
          new_subtaskname: name,
          new_taskid: parentId,
          new_duedate: new Date(`${date}T12:00:00`).toISOString(),
        };

        if (description.trim()) {
          payload.new_description = description.trim();
        }

        if (attachmentId) {
          payload.new_attachmentid = attachmentId;
        }

        const res = await New_subtasksService.create(payload as any);

        if (!res.success) {
          const errorDetail = res.error?.message || JSON.stringify(res.error) || 'Unknown error';
          throw new Error(errorDetail);
        }

        onNotify?.('success', 'Sub-task created successfully');
      }

      // Handle attachments
      if (attachmentFiles.length > 0) {
        const { uploaded } = await uploadAttachments(attachmentId, attachmentFiles);
        onNotify?.('info', `${uploaded.length} file(s) uploaded`);
      }

      await loadSubTasks();
      beginNewSubTask();
      onRefresh?.();
      onSaved?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      onNotify?.('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-sub-task-title"
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
          {/* Left: sub-tasks list */}
          <aside className="order-2 flex min-h-[11rem] max-h-[40vh] flex-col border-t border-gray-200/80 bg-gray-50/30 md:order-1 md:max-h-none md:w-[40%] md:min-w-[14rem] md:border-t-0 md:border-r md:border-gray-200/80">
            <div className="flex min-h-0 flex-1 items-stretch p-3 sm:p-4">
              {!parentId ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-gray-200/90 bg-white px-4 text-sm text-gray-400">
                  No Data Found
                </div>
              ) : subTasksLoading ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200/90 bg-white text-sm text-gray-500">
                  Loading sub tasks…
                </div>
              ) : subTasks.length === 0 ? (
                <div className="flex w-full min-h-[10rem] flex-1 items-center justify-center rounded-lg border border-gray-200/90 bg-white px-4 text-center text-sm text-gray-400">
                  No sub tasks yet. Use the form to add one.
                </div>
              ) : (
                <div className="w-full min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {subTasks.map((s) => {
                    const sid = String(s.new_subtaskid ?? '');
                    return (
                      <div
                        key={sid}
                        className={
                          editingSubTaskId && sid === editingSubTaskId
                            ? 'ring-1 ring-[#B09762]/60 ring-offset-1 rounded-lg'
                            : undefined
                        }
                      >
                        <SubTaskCard
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

          {/* Right: form */}
          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col md:order-2">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100/90 px-4 pb-3 pt-4 sm:px-5">
              <h2
                id="team-sub-task-title"
                className="text-base font-bold leading-tight text-gray-900 sm:text-lg"
              >
                {editingSubTaskId ? 'Edit Sub Task' : 'Add New Sub Task'}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!saving) beginNewSubTask();
                  }}
                  className="inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-semibold transition-colors enabled:hover:bg-amber-50/80 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: GOLD, color: GOLD }}
                  disabled={saving}
                  title="Clear form to add another sub task"
                >
                  + Add Sub Task
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
                    Sub Task Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={fieldTextCls}
                    value={subTaskName}
                    onChange={(e) => {
                      setSubTaskName(e.target.value);
                      setErrors((e0) => ({ ...e0, subTaskName: '' }));
                    }}
                    disabled={saving}
                    maxLength={850}
                  />
                  {errors.subTaskName && <p className="mt-1 text-[11px] text-rose-600">{errors.subTaskName}</p>}
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Due Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <DatePickerField
                      className={fieldDateCls}
                      value={dueDate}
                      onChange={(v) => {
                        setDueDate(v);
                        setErrors((e0) => ({ ...e0, dueDate: '' }));
                      }}
                      disabled={saving}
                    />
                  </div>
                  {dueDate ? (
                    <p className="mt-1.5 text-[10px] tabular-nums text-gray-500" aria-hidden>
                      {formatDdMmYyyy(dueDate)}
                    </p>
                  ) : null}
                  {errors.dueDate && <p className="mt-1 text-[11px] text-rose-600">{errors.dueDate}</p>}
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <label className={labelCls} style={labelStyle}>
                    Description
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
              </div>

              <div className="mt-5 w-full min-w-0">
                <p className={labelCls} style={labelStyle}>
                  Attachments
                </p>
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
                <div className="rounded-lg border p-4" style={{ borderColor: `${GOLD}33`, backgroundColor: 'rgba(176, 151, 98, 0.03)' }}>
                  {attachmentFiles.length === 0 && existingAttachments.length === 0 ? (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3">There is nothing attached.</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                        style={{ color: GOLD }}
                      >
                        <Paperclip size={16} />
                        Attach file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attachmentFiles.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>Files to upload</p>
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
                          <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>Current attachments</p>
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
                      <div className="pt-2 border-t" style={{ borderColor: `${GOLD}22` }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={saving}
                          className="inline-flex items-center gap-2 text-xs font-semibold hover:opacity-80 disabled:opacity-50"
                          style={{ color: GOLD }}
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

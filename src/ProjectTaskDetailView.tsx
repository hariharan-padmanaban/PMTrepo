import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Pencil, RefreshCw, X } from 'lucide-react';
import { New_subtasksService } from './generated/services/New_subtasksService';
import { New_tasksService } from './generated/services/New_tasksService';
import type { New_tasksnew_taskstatus } from './generated/models/New_tasksModel';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';
import { TaskLogsModal } from './TaskLogsModal';
import { enj } from './ui/enjForm';

const TASK_STATUS_OPTIONS = ['To Do', 'In Progress', 'Delayed', 'Done'] as const;
type TaskStatusLabel = (typeof TASK_STATUS_OPTIONS)[number];

const STATUS_TO_CHOICE: Record<TaskStatusLabel, number> = {
  'To Do': 100000000,
  'In Progress': 100000001,
  Done: 100000002,
  Delayed: 100000003,
};

const CHOICE_TO_STATUS: Record<number, TaskStatusLabel> = {
  100000000: 'To Do',
  100000001: 'In Progress',
  100000002: 'Done',
  100000003: 'Delayed',
};

/** Display order for sub-task status dropdowns (To Do, In Progress, Done, Delayed). */
const SUB_TASK_STATUS_OPTIONS: TaskStatusLabel[] = ['To Do', 'In Progress', 'Done', 'Delayed'];

function formatDdMmYyyy(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}


function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

const SUBTASK_DESC_MAX = 100;

function toStartOfDayIsoFromYmd(dateYmd: string): string {
  if (!dateYmd) return '';
  const d = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function normGuid(s: string): string {
  return String(s).replace(/[{}]/g, '').toLowerCase();
}

function ymdFromToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdFromDataverseDate(raw: unknown): string {
  if (raw == null || raw === '') return ymdFromToday();
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return ymdFromToday();
  return d.toISOString().slice(0, 10);
}

function atStartOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function subtaskBelongsToTaskRow(row: Record<string, unknown>, parentTaskId: string): boolean {
  const tid = normGuid(parentTaskId);
  const v =
    (row as { new_taskid?: string }).new_taskid ??
    (row as { _new_taskid_value?: string })._new_taskid_value;
  if (v && typeof v === 'string' && normGuid(v) === tid) return true;
  const d = (row as { new_duration?: string }).new_duration;
  if (d && normGuid(d) === tid) return true;
  return false;
}

function getPmDisplay(row: Record<string, unknown>): string {
  const raw = row.new_projectmanager;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const a = o.internalemailaddress ?? o.emailaddress1 ?? o.primaryemail;
    if (typeof a === 'string' && a.includes('@')) return a.trim();
  }
  return String(row.new_projectmanager ?? row.new_assigntoteammember ?? '—').trim() || '—';
}

type Props = {
  task: Record<string, unknown>;
  onBack: () => void;
  onTaskRefreshed: (row: Record<string, unknown>) => void;
  onListRefresh: () => void;
  onNotify: (type: ToastType, message: string) => void;
};

export function ProjectTaskDetailView({
  task,
  onBack,
  onTaskRefreshed,
  onListRefresh,
  onNotify,
}: Props) {
  const taskId = String(task.new_taskid ?? '').trim();
  const [taskStatus, setTaskStatus] = useState<TaskStatusLabel>('To Do');
  const [estimationHours, setEstimationHours] = useState('');
  const [description, setDescription] = useState('');
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [localRow, setLocalRow] = useState(task);
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [subTaskName, setSubTaskName] = useState('');
  const [subTaskDurationYmd, setSubTaskDurationYmd] = useState(ymdFromToday);
  const [subTaskDescription, setSubTaskDescription] = useState('');
  const [subTaskErrors, setSubTaskErrors] = useState<{ name?: string; duration?: string; desc?: string }>({});
  const [subTaskSaving, setSubTaskSaving] = useState(false);
  const [subTaskRows, setSubTaskRows] = useState<Array<Record<string, unknown>>>([]);
  const [subTasksLoading, setSubTasksLoading] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<Record<string, unknown> | null>(null);
  const [editStName, setEditStName] = useState('');
  const [editStDurationYmd, setEditStDurationYmd] = useState(ymdFromToday);
  const [editStDesc, setEditStDesc] = useState('');
  const [editStStatus, setEditStStatus] = useState<TaskStatusLabel>('To Do');
  const [editStErrors, setEditStErrors] = useState<{ name?: string; duration?: string; desc?: string }>({});
  const [editStSaving, setEditStSaving] = useState(false);
  const [showTaskLogs, setShowTaskLogs] = useState(false);

  useEffect(() => {
    setLocalRow(task);
  }, [task]);

  const syncFormFromRow = useCallback((row: Record<string, unknown>) => {
    const n = Number(row.new_taskstatus ?? NaN);
    setTaskStatus(CHOICE_TO_STATUS[n] ?? 'To Do');
    const c = row.new_cost;
    if (c != null && c !== '' && !Number.isNaN(Number(c))) {
      setEstimationHours(String(c));
    } else {
      setEstimationHours('');
    }
    setDescription(String(row.new_description ?? ''));
  }, []);

  useEffect(() => {
    syncFormFromRow(localRow);
  }, [localRow, syncFormFromRow]);

  const loadTaskById = useCallback(
    async (opts?: { notify: boolean }) => {
      if (!taskId) return;
      const res = await New_tasksService.get(taskId);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Failed to load task');
      }
      const row = res.data as unknown as Record<string, unknown>;
      onTaskRefreshed(row);
      setLocalRow(row);
      onListRefresh();
      if (opts?.notify) onNotify('success', 'Task refreshed.');
    },
    [taskId, onTaskRefreshed, onListRefresh, onNotify],
  );

  const loadSubTasksForTask = useCallback(async () => {
    if (!taskId) {
      setSubTaskRows([]);
      return;
    }
    setSubTasksLoading(true);
    try {
      const res = await New_subtasksService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) {
        setSubTaskRows([]);
        return;
      }
      const rows = (res.data ?? []) as unknown as Array<Record<string, unknown>>;
      setSubTaskRows(rows.filter((r) => subtaskBelongsToTaskRow(r, taskId)));
    } catch {
      setSubTaskRows([]);
    } finally {
      setSubTasksLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadSubTasksForTask();
  }, [loadSubTasksForTask, taskId]);

  const handleRefresh = useCallback(async () => {
    setRefreshBusy(true);
    try {
      await loadTaskById({ notify: true });
      await loadSubTasksForTask();
    } catch (e) {
      onNotify('error', e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setRefreshBusy(false);
    }
  }, [loadTaskById, loadSubTasksForTask, onNotify]);

  const openAddSubTaskModal = useCallback(() => {
    setEditingSubTask(null);
    setSubTaskName('');
    setSubTaskDescription('');
    setSubTaskDurationYmd(ymdFromToday());
    setSubTaskErrors({});
    setShowAddSubTask(true);
  }, []);

  const closeAddSubTaskModal = useCallback(() => {
    if (subTaskSaving) return;
    setShowAddSubTask(false);
    setSubTaskErrors({});
  }, [subTaskSaving]);

  const taskEndDateLabel = formatDdMmYyyy(localRow.new_enddate);
  const taskEndValid = (() => {
    const s = String(localRow.new_enddate ?? '').trim();
    if (!s) return false;
    return !Number.isNaN(new Date(s).getTime());
  })();

  const handleSubmitSubTask = useCallback(async () => {
    if (!taskId) {
      onNotify('error', 'Missing task id.');
      return;
    }
    const name = subTaskName.trim();
    const desc = subTaskDescription.trim();
    const durYmd = subTaskDurationYmd.trim();
    const endMsg = taskEndDateLabel;
    const nextErr: { name?: string; duration?: string; desc?: string } = {};
    if (!name) nextErr.name = 'Required';
    if (!durYmd) nextErr.duration = 'Required';
    if (!desc) nextErr.desc = 'Required';
    if (Object.keys(nextErr).length > 0) {
      setSubTaskErrors(nextErr);
      onNotify(
        'error',
        `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg === '—' ? '(set parent end date, if used)' : endMsg}.`,
      );
      return;
    }
    const pickDate = new Date(`${durYmd}T12:00:00`);
    if (Number.isNaN(pickDate.getTime())) {
      setSubTaskErrors((e) => ({ ...e, duration: 'Invalid date' }));
      onNotify('error', `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg}.`);
      return;
    }
    const pickD = atStartOfLocalDay(pickDate);
    if (taskEndValid) {
      const endD = atStartOfLocalDay(new Date(String(localRow.new_enddate)));
      if (pickD > endD) {
        setSubTaskErrors({ name: nextErr.name, desc: nextErr.desc, duration: 'Must be on or before task end' });
        onNotify('error', `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg}.`);
        return;
      }
    } else {
      onNotify('info', 'Parent task has no end date; duration is not limited by an end date.');
    }
    setSubTaskErrors({});

    const base = {
      new_subtaskname: name.slice(0, 850),
      new_subtaskduration: toStartOfDayIsoFromYmd(durYmd),
      new_description: desc.slice(0, SUBTASK_DESC_MAX),
      new_subtaskstatus: 100000000,
      statecode: 0 as const,
    };
    setSubTaskSaving(true);
    try {
      const tryCreate = (extra: Record<string, unknown>) =>
        New_subtasksService.create({ ...base, ...extra } as Parameters<typeof New_subtasksService.create>[0]);
      let res = await tryCreate({ new_taskid: taskId });
      if (!res.success) {
        const em = (res.error?.message ?? '').toLowerCase();
        if (/new_taskid|attribute|not valid|field.*not|unknown|does not exist|could not find/.test(em)) {
          res = await tryCreate({ new_duration: taskId });
        } else {
          throw new Error(res.error?.message ?? 'Failed to create sub task');
        }
      }
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create sub task');
      }
      onNotify('success', 'Sub Task has been created.');
      setShowAddSubTask(false);
      setSubTaskName('');
      setSubTaskDescription('');
      setSubTaskDurationYmd(ymdFromToday());
      await loadSubTasksForTask();
      onListRefresh();
    } catch (e) {
      onNotify('error', e instanceof Error ? e.message : 'Failed to create sub task');
    } finally {
      setSubTaskSaving(false);
    }
  }, [
    taskId,
    subTaskName,
    subTaskDescription,
    subTaskDurationYmd,
    localRow.new_enddate,
    taskEndDateLabel,
    taskEndValid,
    onNotify,
    loadSubTasksForTask,
    onListRefresh,
  ]);

  const openEditSubTask = useCallback((row: Record<string, unknown>) => {
    setShowAddSubTask(false);
    setSubTaskErrors({});
    setEditingSubTask(row);
    setEditStName(String(row.new_subtaskname ?? '').trim());
    setEditStDurationYmd(ymdFromDataverseDate(row.new_subtaskduration));
    setEditStDesc(String(row.new_description ?? '').slice(0, SUBTASK_DESC_MAX));
    const stn = Number(row.new_subtaskstatus ?? NaN);
    setEditStStatus(CHOICE_TO_STATUS[stn] ?? 'To Do');
    setEditStErrors({});
  }, []);

  const closeEditSubTask = useCallback(() => {
    if (editStSaving) return;
    setEditingSubTask(null);
    setEditStErrors({});
  }, [editStSaving]);

  const handleUpdateSubTask = useCallback(async () => {
    const subId = String(editingSubTask?.new_subtaskid ?? '').trim();
    if (!subId) {
      onNotify('error', 'Missing sub task id.');
      return;
    }
    const name = editStName.trim();
    const desc = editStDesc.trim();
    const durYmd = editStDurationYmd.trim();
    const endMsg = taskEndDateLabel;
    const nextErr: { name?: string; duration?: string; desc?: string } = {};
    if (!name) nextErr.name = 'Required';
    if (!durYmd) nextErr.duration = 'Required';
    if (!desc) nextErr.desc = 'Required';
    if (Object.keys(nextErr).length > 0) {
      setEditStErrors(nextErr);
      onNotify(
        'error',
        `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg === '—' ? '(set parent end date, if used)' : endMsg}.`,
      );
      return;
    }
    const pickDate = new Date(`${durYmd}T12:00:00`);
    if (Number.isNaN(pickDate.getTime())) {
      setEditStErrors((e) => ({ ...e, duration: 'Invalid date' }));
      onNotify('error', `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg}.`);
      return;
    }
    const pickD = atStartOfLocalDay(pickDate);
    if (taskEndValid) {
      const endD = atStartOfLocalDay(new Date(String(localRow.new_enddate)));
      if (pickD > endD) {
        setEditStErrors((e) => ({ ...e, duration: 'Must be on or before task end' }));
        onNotify('error', `Please provide all required fields and ensure the date is before or equal to the task end date ${endMsg}.`);
        return;
      }
    } else {
      onNotify('info', 'Parent task has no end date; duration is not limited by an end date.');
    }
    setEditStErrors({});

    setEditStSaving(true);
    try {
      const res = await New_subtasksService.update(subId, {
        new_subtaskname: name.slice(0, 850),
        new_subtaskduration: toStartOfDayIsoFromYmd(durYmd),
        new_description: desc.slice(0, SUBTASK_DESC_MAX),
        new_subtaskstatus: STATUS_TO_CHOICE[editStStatus],
      } as Parameters<typeof New_subtasksService.update>[1]);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to update sub task');
      }
      onNotify('success', 'Sub task has been updated.');
      setEditingSubTask(null);
      await loadSubTasksForTask();
      onListRefresh();
    } catch (e) {
      onNotify('error', e instanceof Error ? e.message : 'Failed to update sub task');
    } finally {
      setEditStSaving(false);
    }
  }, [
    editingSubTask,
    editStName,
    editStDesc,
    editStDurationYmd,
    editStStatus,
    localRow.new_enddate,
    taskEndDateLabel,
    taskEndValid,
    onNotify,
    loadSubTasksForTask,
    onListRefresh,
  ]);

  const handleSave = useCallback(async () => {
    if (!taskId) {
      onNotify('error', 'Missing task id.');
      return;
    }
    const hoursRaw = estimationHours.trim();
    if (!hoursRaw) {
      onNotify('error', 'Estimation time is required (hours).');
      return;
    }
    const hours = Number(hoursRaw);
    if (Number.isNaN(hours) || hours < 0) {
      onNotify('error', 'Enter a valid number of hours.');
      return;
    }
    const desc = description.trim();
    if (!desc) {
      onNotify('error', 'Description is required.');
      return;
    }
    setSaveBusy(true);
    try {
      const payload = {
        new_taskstatus: STATUS_TO_CHOICE[taskStatus] as New_tasksnew_taskstatus,
        new_cost: hours,
        new_description: clip(desc, 2000),
      };
      const res = await New_tasksService.update(taskId, payload);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to save');
      }
      onNotify('success', 'Task saved successfully.');
      try {
        await loadTaskById();
      } catch {
        /* Re-fetch failed; list was not refreshed — user can use Refresh. */
        onListRefresh();
      }
    } catch (e) {
      onNotify('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaveBusy(false);
    }
  }, [
    taskId,
    estimationHours,
    description,
    taskStatus,
    onListRefresh,
    onNotify,
    onTaskRefreshed,
    loadTaskById,
  ]);

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

  const title = String(localRow.new_tasktitle ?? 'Task').trim() || 'Task';
  const assign = String(localRow.new_assigntoteammember ?? '').trim() || '—';
  const projectName = String(localRow.new_projectname ?? localRow.new_taskprojectname ?? '').trim() || '—';

  return (
    <section className="relative w-full max-w-6xl mx-auto">
      {(refreshBusy || saveBusy) && <ScreenLoader overlay className="rounded-xl" />}

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
          onClick={() => void handleRefresh()}
          disabled={refreshBusy || !taskId}
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
              <ReadonlyCell label="Task Title" value={title} />
              <ReadonlyCell label="Project" value={projectName} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Start Date" value={formatDdMmYyyy(localRow.new_startdate)} />
              <ReadonlyCell label="End Date" value={formatDdMmYyyy(localRow.new_enddate)} />
            </div>
            <div className="space-y-3">
              <ReadonlyCell label="Project Manager" value={getPmDisplay(localRow)} />
              <ReadonlyCell label="Assign to" value={assign} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={openAddSubTaskModal}
              className={`${enj.btnOutline} min-w-[6rem] text-xs`}
            >
              Sub Task
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-secondary mb-1 block">
                Task Status <span className="text-rose-500">*</span>
              </label>
              <select
                className={enj.control}
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value as TaskStatusLabel)}
                disabled={saveBusy}
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-secondary mb-1 block">
                Estimation Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                className={enj.control}
                placeholder="Mention In Hours"
                value={estimationHours}
                onChange={(e) => setEstimationHours(e.target.value)}
                disabled={saveBusy}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-secondary mb-1 block">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              className={`${enj.textarea} min-h-[6.5rem] resize-y`}
              placeholder="Description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saveBusy}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:px-5 shrink-0">
          <button
            type="button"
            onClick={onBack}
            disabled={saveBusy}
            className="h-9 min-w-[5.5rem] rounded-md border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveBusy}
            className={`${enj.btnPrimary} min-w-[5.5rem]`}
          >
            {saveBusy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mt-4 mx-4 sm:mx-0 space-y-4 pb-6">
        <aside className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Task Logs</h3>
          <p className="mt-1 text-[11px] text-gray-500">History from Task Details (Dataverse) for this task.</p>
          <button
            type="button"
            onClick={() => {
              if (!taskId) onNotify('error', 'Cannot open task logs: missing task id.');
              else setShowTaskLogs(true);
            }}
            className={`${enj.btnDefault} mt-3 w-full justify-center border-gray-200 bg-gray-50 py-2.5 text-[12px] font-medium text-primary hover:border-secondary/50 hover:bg-white`}
          >
            <Eye className="h-4 w-4 text-secondary" aria-hidden />
            View task logs
          </button>
        </aside>
        <aside className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Sub-Task Logs</h3>
          {subTasksLoading ? (
            <p className="mt-2 text-xs text-gray-400">Loading…</p>
          ) : subTaskRows.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400">No sub-tasks for this task yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {subTaskRows.map((st) => {
                const id = String(st.new_subtaskid ?? Math.random());
                const stName = String(st.new_subtaskname ?? 'Sub task').trim() || 'Sub task';
                const d = st.new_subtaskduration;
                return (
                  <li
                    key={id}
                    className="flex items-start justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-2 text-[12px] text-gray-700"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate" title={stName}>
                        {stName}
                      </p>
                      <p className="text-[11px] text-gray-500">{formatDdMmYyyy(d)}</p>
                      {st.new_description ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">{String(st.new_description)}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-white hover:text-secondary"
                      title="Edit sub task"
                      onClick={() => openEditSubTask(st)}
                      aria-label="Edit sub task"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {showAddSubTask
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="add-subtask-title">
              <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={closeAddSubTaskModal}
                aria-label="Close"
              />
              <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                {subTaskSaving && <ScreenLoader overlay className="rounded-xl" />}
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h2 id="add-subtask-title" className="text-base font-semibold text-primary">
                    Add Sub Task
                  </h2>
                  <button
                    type="button"
                    onClick={closeAddSubTaskModal}
                    disabled={subTaskSaving}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[min(80dvh,520px)] space-y-3 overflow-y-auto p-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-gray-500">
                      Sub Task Name <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      className={`${enj.control} ${
                        subTaskErrors.name ? 'border-rose-500 ring-1 ring-rose-200' : ''
                      }`}
                      value={subTaskName}
                      onChange={(e) => {
                        setSubTaskName(e.target.value);
                        setSubTaskErrors((o) => ({ ...o, name: undefined }));
                      }}
                      disabled={subTaskSaving}
                    />
                    {subTaskErrors.name && <p className="mt-0.5 text-[11px] text-rose-600">{subTaskErrors.name}</p>}
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-[11px] text-gray-500">
                        Sub Task Duration <span className="text-rose-500">*</span>
                      </span>
                      <input
                        type="date"
                        className={`${enj.control} px-2 ${
                          subTaskErrors.duration ? 'border-rose-500 ring-1 ring-rose-200' : ''
                        }`}
                        value={subTaskDurationYmd}
                        onChange={(e) => {
                          setSubTaskDurationYmd(e.target.value);
                          setSubTaskErrors((o) => ({ ...o, duration: undefined }));
                        }}
                        disabled={subTaskSaving}
                      />
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        On or before task end ({taskEndDateLabel}).
                      </p>
                      {subTaskErrors.duration && (
                        <p className="mt-0.5 text-[11px] text-rose-600">{subTaskErrors.duration}</p>
                      )}
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-gray-500">
                      Description <span className="text-rose-500">*</span>
                    </span>
                    <textarea
                      className={`${enj.textarea} min-h-[80px] ${
                        subTaskErrors.desc ? 'border-rose-500 ring-1 ring-rose-200' : ''
                      }`}
                      value={subTaskDescription}
                      onChange={(e) => {
                        setSubTaskDescription(e.target.value.slice(0, SUBTASK_DESC_MAX));
                        setSubTaskErrors((o) => ({ ...o, desc: undefined }));
                      }}
                      maxLength={SUBTASK_DESC_MAX}
                      disabled={subTaskSaving}
                    />
                    <p className="mt-0.5 text-right text-[10px] text-gray-400">
                      {subTaskDescription.length}/{SUBTASK_DESC_MAX}
                    </p>
                    {subTaskErrors.desc && <p className="mt-0.5 text-[11px] text-rose-600">{subTaskErrors.desc}</p>}
                  </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={closeAddSubTaskModal}
                    disabled={subTaskSaving}
                    className={`${enj.btnDefault} px-4`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmitSubTask()}
                    disabled={subTaskSaving}
                    className={`${enj.btnPrimary} px-4 font-semibold`}
                  >
                    {subTaskSaving ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {editingSubTask
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="update-subtask-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={closeEditSubTask}
                aria-label="Close"
              />
              <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                {editStSaving && <ScreenLoader overlay className="rounded-xl" />}
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h2 id="update-subtask-title" className="text-base font-semibold text-primary">
                    Sub Task Update
                  </h2>
                  <button
                    type="button"
                    onClick={closeEditSubTask}
                    disabled={editStSaving}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[min(85dvh,640px)] space-y-4 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-gray-500">Sub Task Name</span>
                      <input
                        type="text"
                        className={`${enj.control} ${
                          editStErrors.name ? 'border-rose-500 ring-1 ring-rose-200' : ''
                        }`}
                        value={editStName}
                        onChange={(e) => {
                          setEditStName(e.target.value);
                          setEditStErrors((o) => ({ ...o, name: undefined }));
                        }}
                        disabled={editStSaving}
                      />
                      {editStErrors.name && (
                        <p className="mt-0.5 text-[11px] text-rose-600">{editStErrors.name}</p>
                      )}
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-gray-500">Sub Task Duration</span>
                      <input
                        type="date"
                        className={`${enj.control} px-2 ${
                          editStErrors.duration ? 'border-rose-500 ring-1 ring-rose-200' : ''
                        }`}
                        value={editStDurationYmd}
                        onChange={(e) => {
                          setEditStDurationYmd(e.target.value);
                          setEditStErrors((o) => ({ ...o, duration: undefined }));
                        }}
                        disabled={editStSaving}
                      />
                      <p className="mt-0.5 text-[10px] text-gray-400">On or before task end ({taskEndDateLabel}).</p>
                      {editStErrors.duration && (
                        <p className="mt-0.5 text-[11px] text-rose-600">{editStErrors.duration}</p>
                      )}
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-gray-500">Sub Task Description</span>
                      <textarea
                        className={`${enj.textarea} min-h-[100px] ${
                          editStErrors.desc ? 'border-rose-500 ring-1 ring-rose-200' : ''
                        }`}
                        value={editStDesc}
                        onChange={(e) => {
                          setEditStDesc(e.target.value.slice(0, SUBTASK_DESC_MAX));
                          setEditStErrors((o) => ({ ...o, desc: undefined }));
                        }}
                        maxLength={SUBTASK_DESC_MAX}
                        disabled={editStSaving}
                      />
                      <p className="mt-0.5 text-right text-[10px] text-gray-400">
                        {editStDesc.length}/{SUBTASK_DESC_MAX}
                      </p>
                      {editStErrors.desc && (
                        <p className="mt-0.5 text-[11px] text-rose-600">{editStErrors.desc}</p>
                      )}
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-gray-500">Sub Task Status</span>
                      <select
                        className={enj.control}
                        value={editStStatus}
                        onChange={(e) => setEditStStatus(e.target.value as TaskStatusLabel)}
                        disabled={editStSaving}
                      >
                        {SUB_TASK_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={closeEditSubTask}
                    disabled={editStSaving}
                    className={`${enj.btnDefault} px-4`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateSubTask()}
                    disabled={editStSaving}
                    className={`${enj.btnPrimary} px-4 font-semibold`}
                  >
                    {editStSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showTaskLogs && taskId ? <TaskLogsModal taskId={taskId} onClose={() => setShowTaskLogs(false)} /> : null}
    </section>
  );
}

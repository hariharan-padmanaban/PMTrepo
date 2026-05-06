import { useCallback, useEffect, useMemo, useState } from 'react';
import { New_projectsService } from './generated/services/New_projectsService';
import { New_teammembersService } from './generated/services/New_teammembersService';
import { New_tasksService } from './generated/services/New_tasksService';
import { sendEmailNotification, generateEmailTemplate } from './services/PMTMailNotificationService';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';
import { enj } from './ui/enjForm';
import { getSessionUserEmail } from './sessionUser';

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;
const TASK_STATUS_OPTIONS = ['To Do', 'In Progress', 'Delayed', 'Done'] as const;

const PRIORITY_TO_CHOICE: Record<(typeof PRIORITY_OPTIONS)[number], number> = {
  Low: 100000000,
  Medium: 100000001,
  High: 100000002,
};

/** Dataverse new_taskstatus: Not Started, In Progress, Completed, On Hold */
const STATUS_TO_CHOICE: Record<(typeof TASK_STATUS_OPTIONS)[number], number> = {
  'To Do': 100000000,
  'In Progress': 100000001,
  Done: 100000002,
  Delayed: 100000003,
};

/** Power Apps: ProjectName on Project → Dataverse `new_projectname` (not `new_name`, which is Project ID text). */
function getProjectNameFromRow(p: Record<string, unknown>): string {
  return String(
    p.new_projectname ?? (p as { crcf8_projectname?: unknown }).crcf8_projectname ?? '',
  ).trim();
}

/**
 * Power Apps: `LookUp(Project, ProjectName = ProjectNameDropdown.Selected).ProjectID`
 * → Dataverse primary name field `new_name` (display label "Project ID").
 */
function getProjectIdTextFromRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(p.new_name ?? '').trim();
}

function getProjectAssignToManagerDisplay(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(
    p.crcf8_projectmanager ?? p.new_programmanager ?? p.crcf8_projectmanagername ?? p.new_programmanagername ?? '',
  ).trim();
}

/** Power Apps: AssignToProjectManager — text or lookup email on project row. */
function getAssignToProjectManagerEmail(p: Record<string, unknown>): string {
  const m = p.new_projectmanager;
  if (m && typeof m === 'object') {
    const o = m as Record<string, unknown>;
    const a = o.internalemailaddress ?? o.emailaddress1 ?? o.primaryemail;
    if (typeof a === 'string' && a.includes('@')) return a.trim().toLowerCase();
  }
  const raw =
    p.new_assigntoprojectmanager ??
    p.crcf8_assigntoprojectmanager ??
    getProjectAssignToManagerDisplay(p) ??
    (typeof m === 'string' ? m : '') ??
    p.new_projectmanagername ??
    '';
  const s = String(raw ?? '').trim();
  if (s.includes('@')) return s.toLowerCase();
  return s.toLowerCase();
}

function distinctSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

/**
 * Power Apps: `Split( LookUp(Project, ProjectName = ProjectNameDropdown.Selected).MileStone, "," )`
 * Mile-stone text is stored comma-separated; Project creation uses `crcf8_milestone` (see ProgramProjectsSection).
 */
function getProjectMileStoneCsv(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  const crcf8 = String(
    (p as { crcf8_milestone?: unknown }).crcf8_milestone
      ?? (p as { crcf8_MileStone?: unknown }).crcf8_MileStone
      ?? '',
  ).trim();
  if (crcf8) return crcf8;
  return String((p as { new_milestone?: unknown }).new_milestone ?? '').trim();
}

function splitMilestonesFromCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Power Apps: `ProjectName` on related Task — Dataverse `new_projectname` / `new_taskprojectname`. */
function getTaskProjectNameFromRow(t: Record<string, unknown>): string {
  return String(t.new_projectname ?? t.new_taskprojectname ?? '').trim();
}

function getTaskTitleFromRow(t: Record<string, unknown>): string {
  return String(t.new_tasktitle ?? '').trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

function toStartOfDayIso(dateYmd: string): string {
  if (!dateYmd) return '';
  const d = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

const CHOICE_TO_PRIORITY: Record<number, (typeof PRIORITY_OPTIONS)[number]> = {
  100000000: 'Low',
  100000001: 'Medium',
  100000002: 'High',
  100000003: 'High',
};

const CHOICE_TO_STATUS: Record<number, (typeof TASK_STATUS_OPTIONS)[number]> = {
  100000000: 'To Do',
  100000001: 'In Progress',
  100000002: 'Done',
  100000003: 'Delayed',
};

function dateInputFromDataverse(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseSuccessorAndBody(desc: string): { successor: string; body: string } {
  const t = String(desc ?? '');
  if (!t.trim()) return { successor: '', body: '' };
  const m = t.match(/^Successor:\s*([^\n]*)(?:\n\n([\s\S]*))?/i);
  if (m) {
    return { successor: (m[1] ?? '').trim(), body: (m[2] ?? '').trim() };
  }
  return { successor: '', body: t.trim() };
}

type Props = {
  onClose: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onSaved?: () => void;
  sectionClassName?: string;
  /** When set, form loads this row and save performs an update. */
  editingTask?: Record<string, unknown> | null;
};

export function AddNewTaskFormPanel({
  onClose,
  onNotify,
  onSaved,
  sectionClassName = 'bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto w-full',
  editingTask = null,
}: Props) {
  const [taskTitle, setTaskTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  /** Shown in "Project ID" and saved on task — same as LookUp Project.ProjectID (`new_name`). */
  const [projectIdText, setProjectIdText] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>('Low');
  const [taskStatus, setTaskStatus] = useState<(typeof TASK_STATUS_OPTIONS)[number]>('To Do');
  const [assignEmail, setAssignEmail] = useState('');
  const [predecessor, setPredecessor] = useState('');
  const [successor, setSuccessor] = useState('');
  const [description, setDescription] = useState('');

  const [projectRows, setProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [teamRows, setTeamRows] = useState<Array<Record<string, unknown>>>([]);
  const [taskRows, setTaskRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editingId = String(editingTask?.new_taskid ?? '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [projectsRes, teamRes, tasksRes] = await Promise.all([
          New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          New_teammembersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_tasksService.getAll({ top: 5000, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;
        const errParts: string[] = [];
        if (!projectsRes.success) {
          errParts.push(projectsRes.error?.message ?? 'Failed to load projects');
          setProjectRows([]);
        } else {
          setProjectRows((projectsRes.data ?? []) as unknown as Array<Record<string, unknown>>);
        }
        if (!teamRes.success) {
          errParts.push(teamRes.error?.message ?? 'Failed to load team members');
          setTeamRows([]);
        } else {
          setTeamRows((teamRes.data ?? []) as unknown as Array<Record<string, unknown>>);
        }
        if (!tasksRes.success) {
          errParts.push(tasksRes.error?.message ?? 'Failed to load tasks');
          setTaskRows([]);
        } else {
          setTaskRows((tasksRes.data ?? []) as unknown as Array<Record<string, unknown>>);
        }
        if (errParts.length) setLoadError(errParts.join(' '));
        else setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionEmail = useMemo(() => getSessionUserEmail()?.toLowerCase(), []);

  const projectNameOptions = useMemo(() => {
    const email = sessionEmail;
    let rows = projectRows;
    if (email) {
      const mine = projectRows.filter((p) => {
        const pm = getAssignToProjectManagerEmail(p);
        return pm && pm === email;
      });
      if (mine.length > 0) rows = mine;
    }
    return distinctSortedStrings(rows.map(getProjectNameFromRow).filter(Boolean));
  }, [projectRows, sessionEmail]);

  const selectedProjectRow = useMemo(() => {
    const key = projectName.trim().toLowerCase();
    if (!key) return undefined;
    return projectRows.find((p) => getProjectNameFromRow(p).toLowerCase() === key);
  }, [projectRows, projectName]);

  useEffect(() => {
    if (!selectedProjectRow) {
      setProjectIdText('');
      setLinkTo('');
      return;
    }
    setProjectIdText(getProjectIdTextFromRow(selectedProjectRow));
    const m = getProjectMileStoneCsv(selectedProjectRow);
    const options = splitMilestonesFromCsv(m);
    setLinkTo((prev) => (prev && options.includes(prev) ? prev : ''));
  }, [selectedProjectRow]);

  const linkToOptions = useMemo(() => {
    if (!selectedProjectRow) return [] as string[];
    return splitMilestonesFromCsv(getProjectMileStoneCsv(selectedProjectRow));
  }, [selectedProjectRow]);

  /**
   * Power Apps: `LookUp(Project, ProjectName = ...).ProjectID` then filter Team by that project.
   * `new_projectid` on the project row = GUID; `new_name` = Project ID text. Team rows usually
   * match on lookup GUID, sometimes on the same text id.
   */
  const assignEmailOptions = useMemo(() => {
    if (!selectedProjectRow) return [] as string[];
    const pGuid = String(selectedProjectRow.new_projectid ?? '').trim().toLowerCase();
    const pIdText = getProjectIdTextFromRow(selectedProjectRow).toLowerCase();
    if (!pGuid && !pIdText) return [] as string[];
    return distinctSortedStrings(
      teamRows
        .filter((t) => {
          const tProj = String(t.new_projectid ?? '').trim();
          if (!tProj) return false;
          const tl = tProj.toLowerCase();
          if (pGuid && tl === pGuid) return true;
          if (pIdText && tl === pIdText) return true;
          return false;
        })
        .map((t) => String(t.new_teamemail ?? '').trim())
        .filter(Boolean),
    );
  }, [teamRows, selectedProjectRow]);

  /**
   * Power Apps: `ShowColumns( Filter( Task, ProjectName = ProjectNameDropdown.Selected ), 'Task Title' )`
   */
  const predecessorOptions = useMemo(() => {
    const pn = projectName.trim();
    if (!pn) return [] as string[];
    const k = pn.toLowerCase();
    const currentId = editingId.toLowerCase();
    const fromRows = taskRows
      .filter((t) => {
        if (getTaskProjectNameFromRow(t).toLowerCase() !== k) return false;
        const id = String(t.new_taskid ?? '').trim().toLowerCase();
        if (editingId && id === currentId) return false;
        return true;
      })
      .map((t) => getTaskTitleFromRow(t))
      .filter(Boolean);
    const base = distinctSortedStrings(fromRows);
    const pre = predecessor.trim();
    if (pre && !base.includes(pre)) return [pre, ...base];
    return base;
  }, [taskRows, projectName, editingId, predecessor]);

  useEffect(() => {
    setPredecessor((prev) => (prev && predecessorOptions.includes(prev) ? prev : ''));
  }, [predecessorOptions]);

  /** Load edit row after lists are ready. */
  useEffect(() => {
    if (loading || !editingId || !editingTask) return;
    setTaskTitle(String(editingTask.new_tasktitle ?? '').trim());
    setProjectName(String(editingTask.new_projectname ?? editingTask.new_taskprojectname ?? '').trim());
    setProjectIdText(String(editingTask.new_projectid ?? '').trim());
    setLinkTo(String(editingTask.new_progress ?? '').trim());
    setStartDate(dateInputFromDataverse(editingTask.new_startdate));
    setEndDate(dateInputFromDataverse(editingTask.new_enddate));
    const pNum = Number(editingTask.new_priority);
    setPriority(
      Number.isFinite(pNum) && pNum in CHOICE_TO_PRIORITY ? CHOICE_TO_PRIORITY[pNum] : 'Low',
    );
    const sNum = Number(editingTask.new_taskstatus);
    setTaskStatus(
      Number.isFinite(sNum) && sNum in CHOICE_TO_STATUS ? CHOICE_TO_STATUS[sNum] : 'To Do',
    );
    setAssignEmail(String(editingTask.new_assigntoteammember ?? '').trim());
    setPredecessor(String(editingTask.new_predecessor ?? '').trim());
    const { successor: suc, body } = parseSuccessorAndBody(String(editingTask.new_description ?? ''));
    setSuccessor(suc);
    setDescription(body);
  }, [loading, editingId, editingTask]);

  const handleSave = useCallback(async () => {
    const nextErrors: Record<string, string> = {};
    if (!taskTitle.trim()) nextErrors.taskTitle = 'Task Title is required';
    if (!projectName.trim()) nextErrors.projectName = 'Project Name is required';
    if (!projectIdText.trim()) nextErrors.projectId = 'Project ID is required';
    if (!linkTo.trim()) nextErrors.linkTo = 'Link To is required';
    if (!startDate) nextErrors.startDate = 'Task Start Date is required';
    if (!endDate) nextErrors.endDate = 'Task End Date is required';
    if (!assignEmail.trim()) nextErrors.assignEmail = 'Assign to team member is required';
    if (!description.trim()) nextErrors.description = 'Description is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.('error', 'Please fill all required fields.');
      return;
    }
    setErrors({});

    const startIso = toStartOfDayIso(startDate);
    const endIso = toStartOfDayIso(endDate);
    if (!startIso || !endIso) {
      onNotify?.('error', 'Invalid dates.');
      return;
    }

    const descWithSuccessor = successor.trim()
      ? `Successor: ${clip(successor.trim(), 400)}\n\n${description.trim()}`
      : description.trim();

    setSaveBusy(true);
    try {
      const payload: Record<string, unknown> = {
        new_tasktitle: clip(taskTitle.trim(), 850),
        new_projectname: clip(projectName.trim(), 100),
        new_taskprojectname: clip(projectName.trim(), 100),
        new_projectid: clip(projectIdText.trim(), 100),
        new_startdate: startIso,
        new_enddate: endIso,
        new_priority: PRIORITY_TO_CHOICE[priority],
        new_taskstatus: STATUS_TO_CHOICE[taskStatus],
        new_assigntoteammember: clip(assignEmail.trim(), 100),
        new_progress: clip(linkTo.trim(), 100),
        ...(predecessor.trim() ? { new_predecessor: clip(predecessor.trim(), 100) } : { new_predecessor: '' }),
        new_description: clip(descWithSuccessor, 2000),
        statecode: 0,
      };

      if (editingId) {
        const res = await New_tasksService.update(
          editingId,
          payload as unknown as Parameters<typeof New_tasksService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update task');
        onNotify?.('success', 'Task updated successfully.');
      } else {
        const res = await New_tasksService.create(
          payload as unknown as Parameters<typeof New_tasksService.create>[0],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to save task');
        onNotify?.('success', 'Task saved successfully.');

        // Send email notification for new task
        if (assignEmail && assignEmail.includes('@')) {
          const priorityLabel = Object.entries(PRIORITY_TO_CHOICE).find(([, val]) => val === Number(priority))?.[0] || priority;
          const statusLabel = Object.entries(STATUS_TO_CHOICE).find(([, val]) => val === Number(taskStatus))?.[0] || taskStatus;

          const emailTemplate = generateEmailTemplate(
            'New Task Assigned',
            'Dear Team Member,',
            'A new task has been assigned to you. Please review the details below and plan your work accordingly.',
            [
              { label: 'Task Title', value: taskTitle },
              { label: 'Project', value: projectName },
              { label: 'Status', value: statusLabel },
              { label: 'Priority', value: priorityLabel },
              { label: 'Start Date', value: startDate || '-' },
              { label: 'End Date', value: endDate || '-' },
              { label: 'Link To', value: linkTo || '-' },
            ],
          );

          sendEmailNotification({
            toEmail: assignEmail,
            subject: `New Task: ${taskTitle}`,
            htmlBody: emailTemplate,
          }).catch((err) => {
            console.error('Failed to send task creation email:', err);
          });
        }
      }
      onSaved?.();
      onClose();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save task');
    } finally {
      setSaveBusy(false);
    }
  }, [
    editingId,
    taskTitle,
    projectName,
    projectIdText,
    linkTo,
    startDate,
    endDate,
    priority,
    taskStatus,
    assignEmail,
    predecessor,
    successor,
    description,
    onClose,
    onNotify,
    onSaved,
  ]);

  const labelReq = (text: string) => (
    <span className="text-[11px] text-gray-500 mb-1 block">
      {text} <span className="text-rose-500">*</span>
    </span>
  );

  const labelOpt = (text: string) => <span className="text-[11px] text-gray-500 mb-1 block">{text}</span>;
  const controlCls = enj.control;
  const inputCls = enj.control;

  return (
    <section className={`${sectionClassName} relative`}>
      {loading && <ScreenLoader overlay />}
      <p className="text-[16px] font-bold text-primary mb-4">
        <button type="button" className="underline text-primary font-semibold" onClick={onClose}>
          Tasks
        </button>
        {' > '}
        {editingId ? 'Edit Task' : 'Add New Task'}
      </p>
      {loadError && <p className="text-sm text-rose-600 mb-3">{loadError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
        <label>
          {labelReq('Task Title')}
          <input
            className={inputCls}
            placeholder="Enter Task Title"
            value={taskTitle}
            onChange={(e) => { setTaskTitle(e.target.value); setErrors((prev) => ({ ...prev, taskTitle: '' })); }}
            disabled={loading || saveBusy}
          />
          {errors.taskTitle && <p className="mt-1 text-[11px] text-rose-600">{errors.taskTitle}</p>}
        </label>
        <label>
          {labelReq('Project Name')}
          <select
            className={controlCls}
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setAssignEmail('');
              setErrors((prev) => ({ ...prev, projectName: '' }));
            }}
            disabled={loading || saveBusy}
          >
            <option value="">Select project</option>
            {projectNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.projectName && <p className="mt-1 text-[11px] text-rose-600">{errors.projectName}</p>}
        </label>
        <label>
          {labelOpt('Project ID')}
          <input
            className={`${enj.control} cursor-default bg-gray-50 text-gray-700`}
            readOnly
            value={projectIdText}
            placeholder="—"
            title="LookUp(Project, ProjectName = selected project).ProjectID (Dataverse new_name)"
          />
          {errors.projectId && <p className="mt-1 text-[11px] text-rose-600">{errors.projectId}</p>}
        </label>

        <label>
          {labelReq('Link to')}
          <select
            className={controlCls}
            value={linkTo}
            onChange={(e) => { setLinkTo(e.target.value); setErrors((prev) => ({ ...prev, linkTo: '' })); }}
            disabled={loading || saveBusy || linkToOptions.length === 0}
          >
            <option value="">{linkToOptions.length ? 'Select milestone' : 'Select project first'}</option>
            {linkToOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.linkTo && <p className="mt-1 text-[11px] text-rose-600">{errors.linkTo}</p>}
        </label>
        <label>
          {labelReq('Task Start Date')}
          <input
            type="date"
            className={inputCls}
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setErrors((prev) => ({ ...prev, startDate: '' })); }}
            disabled={loading || saveBusy}
          />
          {errors.startDate && <p className="mt-1 text-[11px] text-rose-600">{errors.startDate}</p>}
        </label>
        <label>
          {labelReq('Task End Date')}
          <input
            type="date"
            className={inputCls}
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setErrors((prev) => ({ ...prev, endDate: '' })); }}
            disabled={loading || saveBusy}
          />
          {errors.endDate && <p className="mt-1 text-[11px] text-rose-600">{errors.endDate}</p>}
        </label>

        <label>
          {labelReq('Priority')}
          <select
            className={controlCls}
            value={priority}
            onChange={(e) => setPriority(e.target.value as (typeof PRIORITY_OPTIONS)[number])}
            disabled={loading || saveBusy}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labelReq('Task Status')}
          <select
            className={controlCls}
            value={taskStatus}
            onChange={(e) => setTaskStatus(e.target.value as (typeof TASK_STATUS_OPTIONS)[number])}
            disabled={loading || saveBusy}
          >
            {TASK_STATUS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labelReq('Assign to team member')}
          <select
            className={controlCls}
            value={assignEmail}
            onChange={(e) => { setAssignEmail(e.target.value); setErrors((prev) => ({ ...prev, assignEmail: '' })); }}
            disabled={loading || saveBusy || !selectedProjectRow}
          >
            <option value="">{selectedProjectRow ? 'Select team member' : 'Select project first'}</option>
            {assignEmailOptions.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>
          {errors.assignEmail && <p className="mt-1 text-[11px] text-rose-600">{errors.assignEmail}</p>}
        </label>

        <label>
          {labelOpt('Predecessor')}
          <select
            className={controlCls}
            value={predecessor}
            onChange={(e) => setPredecessor(e.target.value)}
            disabled={loading || saveBusy || !projectName.trim()}
            title="Filter(Task, ProjectName = selected) → Task Title"
          >
            <option value="">{projectName.trim() ? '—' : 'Select project first'}</option>
            {predecessorOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labelOpt('Successor')}
          <input
            className={inputCls}
            placeholder="Successor"
            value={successor}
            onChange={(e) => setSuccessor(e.target.value)}
            disabled={loading || saveBusy}
          />
        </label>
        <label>
          {labelReq('Description')}
          <textarea
            className={`${enj.textarea} min-h-[4.5rem] resize-none`}
            placeholder="Description…"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setErrors((prev) => ({ ...prev, description: '' })); }}
            disabled={loading || saveBusy}
          />
          {errors.description && <p className="mt-1 text-[11px] text-rose-600">{errors.description}</p>}
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className={`${enj.btnOutline} min-w-[6.5rem] px-8 font-semibold`}
          disabled={saveBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          className={`${enj.btnPrimary} min-w-[6.5rem] px-8 font-semibold`}
          disabled={loading || saveBusy}
        >
          {saveBusy ? 'Saving…' : editingId ? 'Save changes' : 'Assign Task'}
        </button>
      </div>
    </section>
  );
}

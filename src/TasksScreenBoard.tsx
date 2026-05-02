/**
 * Kanban board for Dataverse `new_tasks` — matches four status columns with scrollable lists and task cards
 * (title, Time Sheet, project, description, priority, subtask count, days left, due date, assignee, edit/delete).
 */

import { Calendar, Clock, List, Pencil, Trash2 } from 'lucide-react';

export type TaskBoardRow = Record<string, unknown>;

const STATUS_NOTSTARTED = 100000000;
const STATUS_INPROGRESS = 100000001;
const STATUS_COMPLETED = 100000002;
const STATUS_ONHOLD = 100000003;

type StatusBucket = 'todo' | 'inprogress' | 'delayed' | 'done';

export function taskStatusBucket(row: TaskBoardRow): StatusBucket {
  const n = Number(row.new_taskstatus ?? NaN);
  if (n === STATUS_NOTSTARTED) return 'todo';
  if (n === STATUS_INPROGRESS) return 'inprogress';
  if (n === STATUS_COMPLETED) return 'done';
  if (n === STATUS_ONHOLD) return 'delayed';
  const name = String(row.new_taskstatusname ?? '').toLowerCase();
  if (name.includes('complet') || name.includes('done')) return 'done';
  if (name.includes('progress')) return 'inprogress';
  if (name.includes('hold') || name.includes('delay') || name.includes('on hold')) return 'delayed';
  return 'todo';
}

const PRIORITY_NUM_MAP: Record<number, string> = {
  100000000: 'Low',
  100000001: 'Medium',
  100000002: 'High',
  100000003: 'Critical',
};

function priorityLabel(row: TaskBoardRow): string {
  const n = Number(row.new_priority ?? NaN);
  if (Number.isFinite(n) && PRIORITY_NUM_MAP[n]) return PRIORITY_NUM_MAP[n];
  const name = String(row.new_priorityname ?? '').trim();
  if (name) return name;
  return '—';
}

function subTaskCount(row: TaskBoardRow): number {
  const n = Number(row.new_subtask ?? NaN);
  if (n === 100000001) return 1;
  const s = String(row.new_subtaskname ?? '').toLowerCase();
  if (s === 'yes') return 1;
  return 0;
}

function daysLeftLabel(end: unknown): string {
  const d = new Date(String(end ?? ''));
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} days`;
  if (diff === 0) return '0 days';
  return `${diff} days`;
}

function dueDateDdMmYyyy(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function initialsFromText(s: string): string {
  const t = s.trim();
  if (!t) return '?';
  if (t.includes('@')) {
    const local = t.split('@')[0] ?? '';
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase().slice(0, 2);
    return local.slice(0, 2).toUpperCase() || '?';
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase().slice(0, 2);
  return t.slice(0, 2).toUpperCase();
}

function clipText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type ColumnDef = { bucket: StatusBucket; name: string; accent: string };

const TEAM_COLUMNS: ColumnDef[] = [
  { bucket: 'todo', name: 'To do', accent: '#10b981' },
  { bucket: 'inprogress', name: 'In Progress', accent: '#f59e0b' },
  { bucket: 'delayed', name: 'Delayed', accent: '#ef4444' },
  { bucket: 'done', name: 'Done', accent: '#3b82f6' },
];

const PROJECT_COLUMNS: ColumnDef[] = [
  { bucket: 'todo', name: 'Future Tasks', accent: '#10b981' },
  { bucket: 'inprogress', name: 'In Progress', accent: '#f59e0b' },
  { bucket: 'delayed', name: 'Delayed', accent: '#ef4444' },
  { bucket: 'done', name: 'Completed', accent: '#3b82f6' },
];

type Props = {
  variant: 'team' | 'project';
  tasks: TaskBoardRow[];
  onTaskOpen?: (row: TaskBoardRow) => void;
  onTaskEdit?: (row: TaskBoardRow) => void;
  onTaskDelete?: (row: TaskBoardRow) => void;
  className?: string;
};

export function TasksScreenBoard({
  variant,
  tasks,
  onTaskOpen,
  onTaskEdit,
  onTaskDelete,
  className = '',
}: Props) {
  const columns = variant === 'team' ? TEAM_COLUMNS : PROJECT_COLUMNS;

  const byBucket = (bucket: StatusBucket) => tasks.filter((t) => taskStatusBucket(t) === bucket);

  return (
    <div className={`grid min-h-0 grid-cols-1 items-start gap-3 min-w-0 lg:grid-cols-4 ${className}`}>
      {columns.map((col) => {
        const colTasks = byBucket(col.bucket);
        return (
          <div key={col.name} className="flex w-full min-w-0 flex-col gap-3">
            <div className="shrink-0 rounded-xl border border-gray-100 bg-white px-3 py-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">
                {col.name}
                <span className="ml-1 text-[10px] font-normal text-gray-400">({colTasks.length})</span>
              </p>
            </div>
            <div className="h-[calc(3*8rem+0.5rem*2)] w-full min-h-0 shrink-0 space-y-2 overflow-y-auto pr-0.5">
              {colTasks.length === 0 && (
                <p className="text-[10px] text-gray-400 px-1 py-4 text-center rounded-lg border border-dashed border-gray-200 bg-white">
                  No tasks
                </p>
              )}
              {colTasks.map((row) => {
                const id = String(row.new_taskid ?? Math.random());
                const title = String(row.new_tasktitle ?? 'Task').trim() || 'Task';
                const project = String(row.new_projectname ?? row.new_taskprojectname ?? '').trim();
                const desc = clipText(String(row.new_description ?? ''), 200);
                const assign = String(row.new_assigntoteammember ?? '').trim();
                const pri = priorityLabel(row);
                const subs = subTaskCount(row);
                const days = daysLeftLabel(row.new_enddate);
                const due = dueDateDdMmYyyy(row.new_enddate);

                const open = () => onTaskOpen?.(row);
                const edit = () => (onTaskEdit ?? onTaskOpen)?.(row);
                const del = () => onTaskDelete?.(row);

                return (
                  <div
                    key={id}
                    className="flex h-[8rem] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm"
                  >
                    <div className="flex min-h-0 items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        {onTaskOpen ? (
                          <button
                            type="button"
                            onClick={open}
                            className="line-clamp-2 text-left text-[11px] font-medium leading-snug hover:underline"
                            style={{ color: col.accent }}
                          >
                            {clipText(title, 56)}
                          </button>
                        ) : (
                          <p className="line-clamp-2 text-[11px] font-medium leading-snug" style={{ color: col.accent }}>
                            {clipText(title, 56)}
                          </p>
                        )}
                      </div>
                      {project ? (
                        <span className="truncate text-[8px] text-gray-500 max-w-[48%]" title={project}>
                          {clipText(project, 20)}
                        </span>
                      ) : null}
                    </div>

                    {desc ? (
                      <p className="mt-1 min-h-0 line-clamp-2 text-[10px] leading-snug text-gray-600">{desc}</p>
                    ) : null}
                    <p className="mt-0.5 line-clamp-1 text-[9px] text-gray-400">{pri}</p>

                    <div className="mt-1.5 flex min-h-0 items-center justify-between gap-1 text-[9px] text-gray-500">
                      <span className="flex min-w-0 items-center gap-0.5">
                        <List className="h-2.5 w-2.5 shrink-0 text-gray-400" strokeWidth={2} />
                        <span className="truncate">Sub Task: {subs}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5 text-gray-400" strokeWidth={2} />
                        {days}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-1.5">
                      <div className="flex min-w-0 items-center gap-1 text-[9px] text-gray-500">
                        <Calendar className="h-2.5 w-2.5 shrink-0 text-gray-400" strokeWidth={2} />
                        <span>Due</span>
                        <span className="text-gray-700">{due}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <div
                          className="mr-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[8px] font-bold text-amber-900"
                          title={assign || 'Assignee'}
                        >
                          {initialsFromText(assign || '?')}
                        </div>
                        {variant === 'project' && (
                          <>
                            <button
                              type="button"
                              onClick={edit}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#b28a44] disabled:opacity-30"
                              disabled={!onTaskEdit && !onTaskOpen}
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={del}
                              className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                              disabled={!onTaskDelete}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

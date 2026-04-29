import { useEffect, useMemo, useState } from 'react';
import { Bell, Calendar } from 'lucide-react';

export type InboxTabId = 'team' | 'task' | 'pinned';

export type AppInboxNotificationItem = {
  id: string;
  tab: InboxTabId;
  projectName: string;
  projectIdLabel: string;
  message: string;
  personLabel: string;
  date: string;
  time: string;
  ts: number;
};

function notificationDateTimeLabel(value: unknown) {
  const d = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function tsFromWhen(when: unknown): number {
  const t = new Date(String(when ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function projectCodeFromRows(projectName: string, projects: Array<Record<string, unknown>>): string {
  const name = projectName.trim();
  if (!name) return '—';
  for (const p of projects) {
    const pn = String(p.new_projectname ?? '').trim();
    if (pn === name) {
      const code = String(p.new_name ?? '').trim();
      if (code) return code;
    }
  }
  return name;
}

function taskInboxStatusLabel(row: Record<string, unknown>): string {
  const s = String(row.new_taskstatusname ?? '').trim();
  if (s) return s;
  const n = Number(row.new_taskstatus ?? NaN);
  if (n === 100000000) return 'Not Started';
  if (n === 100000001) return 'In Progress';
  if (n === 100000002) return 'Completed';
  if (n === 100000003) return 'On Hold';
  return '—';
}

/**
 * In-app inbox from Dataverse: team allocations, tasks, and active/priority tasks.
 */
export function buildInboxNotifications(
  role: 'team' | 'project' | 'program',
  ctx: {
    teamMembers: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    myProjectNameSet?: Set<string>;
    scopedProjectNames?: Set<string>;
    sessionEmail?: string;
  },
): AppInboxNotificationItem[] {
  const { teamMembers, projects, tasks, myProjectNameSet, scopedProjectNames, sessionEmail } = ctx;
  const out: AppInboxNotificationItem[] = [];
  const em = (sessionEmail ?? '').trim().toLowerCase();

  const teamFiltered = teamMembers.filter((r) => {
    const pn = String(r.new_projectname ?? '').trim();
    if (!pn) return false;
    if (role === 'team') {
      if (myProjectNameSet && myProjectNameSet.size > 0 && myProjectNameSet.has(pn)) return true;
      const te = String(r.new_teamemail ?? '').toLowerCase();
      if (em && te) {
        const parts = te.split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
        if (parts.some((p) => p === em)) return true;
      }
      return false;
    }
    if (scopedProjectNames && scopedProjectNames.size > 0) return scopedProjectNames.has(pn);
    return true;
  });

  teamFiltered.forEach((r, idx) => {
    const projectName = String(r.new_projectname ?? '—').trim() || '—';
    const projectId = projectCodeFromRows(projectName, projects);
    const when = r.createdon ?? r.modifiedon;
    const label = notificationDateTimeLabel(when);
    const id = `inbox-team-${String(r.new_teammemberid ?? '').trim() || idx}`;
    const person = String(r.new_fullname ?? r.new_teamemail ?? '—').trim() || '—';
    out.push({
      id,
      tab: 'team',
      projectName,
      projectIdLabel: projectId,
      message: `A new team has been assigned to the project '${projectName}' (Project ID: ${projectId}). The assignment is intended for the selected project team.`,
      personLabel: person,
      date: label.date,
      time: label.time,
      ts: tsFromWhen(when),
    });
  });

  const taskPool =
    role === 'team'
      ? tasks
      : scopedProjectNames && scopedProjectNames.size > 0
        ? tasks.filter((t) => scopedProjectNames.has(String(t.new_projectname ?? '').trim()))
        : tasks;

  taskPool.slice(0, 30).forEach((t, idx) => {
    const when = t.modifiedon ?? t.createdon ?? t.new_enddate;
    const label = notificationDateTimeLabel(when);
    const title = String(t.new_tasktitle ?? 'Task').trim() || 'Task';
    const pn = String(t.new_projectname ?? '—').trim() || '—';
    const pid = projectCodeFromRows(pn, projects);
    const id = `inbox-task-${String(t.new_taskid ?? '').trim() || idx}`;
    const assignee = String(t.new_assigntoteammember ?? '—').trim() || '—';
    out.push({
      id,
      tab: 'task',
      projectName: pn,
      projectIdLabel: pid,
      message: `Task information: «${title}» for project '${pn}' (Project ID: ${pid}). ${taskInboxStatusLabel(t)}.`,
      personLabel: assignee,
      date: label.date,
      time: label.time,
      ts: tsFromWhen(when),
    });
  });

  const pinPool = taskPool.filter((t) => {
    const st = Number(t.new_taskstatus ?? NaN);
    const pr = Number(t.new_priority ?? NaN);
    return st === 100000001 || st === 100000000 || pr === 100000003;
  });
  const pinSorted = [...pinPool].sort(
    (a, b) => tsFromWhen(b.modifiedon ?? b.createdon) - tsFromWhen(a.modifiedon ?? a.createdon),
  );
  pinSorted.slice(0, 20).forEach((t, idx) => {
    const when = t.modifiedon ?? t.createdon ?? t.new_enddate;
    const label = notificationDateTimeLabel(when);
    const title = String(t.new_tasktitle ?? 'Task').trim() || 'Task';
    const pn = String(t.new_projectname ?? '—').trim() || '—';
    const pid = projectCodeFromRows(pn, projects);
    const id = `inbox-pinned-${String(t.new_taskid ?? '').trim() || idx}`;
    const assignee = String(t.new_assigntoteammember ?? '—').trim() || '—';
    out.push({
      id,
      tab: 'pinned',
      projectName: pn,
      projectIdLabel: pid,
      message: `Active / priority task: «${title}» — ${taskInboxStatusLabel(t)} (Project: ${pn}).`,
      personLabel: assignee,
      date: label.date,
      time: label.time,
      ts: tsFromWhen(when),
    });
  });

  return out.sort((a, b) => b.ts - a.ts);
}

const INBOX_TABS: { id: InboxTabId; label: string }[] = [
  { id: 'team', label: 'Team Details' },
  { id: 'task', label: "Task's Information" },
  { id: 'pinned', label: 'Pinned Task' },
];

export function NotificationBell({ items }: { items: AppInboxNotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTabId>('team');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  const idSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const visibleItems = useMemo(
    () => items.filter((i) => !dismissedIds.includes(i.id)),
    [items, dismissedIds],
  );
  const tabItems = useMemo(
    () => visibleItems.filter((i) => i.tab === activeTab),
    [visibleItems, activeTab],
  );
  const unreadCount = useMemo(
    () => visibleItems.filter((i) => !readIds.includes(i.id)).length,
    [visibleItems, readIds],
  );

  useEffect(() => {
    setDismissedIds((prev) => prev.filter((id) => idSet.has(id)));
  }, [idSet]);

  const markRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const clearAll = () => {
    setDismissedIds((prev) => Array.from(new Set([...prev, ...visibleItems.map((i) => i.id)])));
  };

  const personCaption = activeTab === 'team' ? 'Team Member' : 'Assignee';

  return (
    <div className="relative flex items-center">
      <button type="button" className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-[min(100vw-1rem,380px)] rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Notification</h3>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="px-2 pt-0 flex border-b border-gray-100 text-xs">
            {INBOX_TABS.map((tab) => {
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-2 py-2.5 text-center font-medium transition-colors ${
                    on ? 'text-[#A08149] border-b-2 border-[#A08149] -mb-px' : 'text-gray-400 border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="max-h-[min(50vh,360px)] overflow-auto">
            {tabItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-gray-400">No notifications in this section.</p>
            ) : (
              tabItems.map((item) => {
                const opened = readIds.includes(item.id);
                return (
                  <div key={item.id} className="border-b border-dashed border-gray-200 last:border-0">
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className={`w-full px-4 py-3 text-left transition-opacity hover:bg-gray-50/80 ${opened ? 'opacity-70' : ''}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Project Name</p>
                      <p className="text-sm font-bold text-primary mt-0.5">{item.projectName}</p>
                      <p className="text-xs text-cyan-800 mt-2 leading-relaxed">{item.message}</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-3">{personCaption}</p>
                      <p className="text-sm font-bold text-primary">{item.personLabel}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={1.75} />
                        <span>
                          {item.date} {item.time}
                        </span>
                        {!opened && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Unread" aria-hidden />}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-3 border-t border-gray-100">
            <button
              type="button"
              className="text-[11px] text-gray-500 hover:text-gray-800"
              onClick={() => {
                clearAll();
                setOpen(false);
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

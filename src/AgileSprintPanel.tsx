import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ListFilter, Pencil, Plus, RefreshCw, Search, Share2, X } from 'lucide-react';
import { New_sprintsService } from './generated/services/New_sprintsService';
import { New_sprintissuesService } from './generated/services/New_sprintissuesService';
import type { ToastType } from './NotificationToast';
import { enj } from './ui/enjForm';

type ProjectRow = Record<string, unknown>;
type SprintRow = Record<string, unknown>;
type IssueRow = Record<string, unknown>;

function fmtDate(v: unknown): string {
  const raw = String(v ?? '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isoDateToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDateInputValue(v: unknown): string {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sprintProgressPct(row: SprintRow): number {
  const n = Number(row.new_progress ?? NaN);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.min(100, Math.round(n));
}

function sprintStatusLabel(row: SprintRow): string {
  const s = String(row.new_sprintstatusname ?? '').trim();
  if (s) return s.replace(/([a-z])([A-Z])/g, '$1 $2');
  const n = Number(row.new_sprintstatus ?? NaN);
  if (n === 100000000) return 'To Do';
  if (n === 100000001) return 'In Progress';
  if (n === 100000002) return 'Done';
  return '—';
}

function issueStatusLabel(row: IssueRow): string {
  const s = String(row.new_statusname ?? '').trim();
  if (s) return s.replace(/([a-z])([A-Z])/g, '$1 $2');
  const n = Number(row.new_status ?? NaN);
  if (n === 100000000) return 'To Do';
  if (n === 100000001) return 'In Progress';
  if (n === 100000002) return 'Delayed';
  if (n === 100000003) return 'Done';
  return '—';
}

function issueTypeLabel(row: IssueRow): string {
  const s = String(row.new_issuetypename ?? '').trim();
  if (s) return s;
  const n = Number(row.new_issuetype ?? NaN);
  if (n === 100000000) return 'Task';
  if (n === 100000001) return 'Issue';
  if (n === 100000002) return 'Bug';
  return '—';
}

const SPRINT_STATUS_OPTIONS: Array<{ label: 'To Do' | 'In Progress' | 'Done'; value: 100000000 | 100000001 | 100000002 }> = [
  { label: 'To Do', value: 100000000 },
  { label: 'In Progress', value: 100000001 },
  { label: 'Done', value: 100000002 },
];
const ACTIVITY_TYPE_OPTIONS: Array<{ label: 'Task' | 'Issue' | 'Bug'; value: 100000000 | 100000001 | 100000002 }> = [
  { label: 'Task', value: 100000000 },
  { label: 'Issue', value: 100000001 },
  { label: 'Bug', value: 100000002 },
];

export function AgileSprintPanel({
  project,
  onBack,
  onNotify,
}: {
  project: ProjectRow;
  onBack: () => void;
  onNotify: (p: { type: ToastType; message: string }) => void;
}) {
  const projectName = String(project.new_projectname ?? project.new_name ?? '').trim() || 'Project';
  const projectId = String(project.new_projectid ?? '').trim();
  const [loading, setLoading] = useState(false);
  const [sprints, setSprints] = useState<SprintRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [selectedSprintName, setSelectedSprintName] = useState('');
  const [searchSprint, setSearchSprint] = useState('');
  const [searchIssue, setSearchIssue] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState('All Status');
  const [issueTypeFilter, setIssueTypeFilter] = useState('All Issue Type');
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    sprintName: '',
    sprintGoal: '',
    startDate: isoDateToday(),
    endDate: isoDateToday(),
  });
  const [editSprint, setEditSprint] = useState<SprintRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    sprintName: '',
    progress: '',
    sprintGoal: '',
    startDate: '',
    endDate: '',
    sprintStatus: '100000000',
  });
  const [backlogSprintName, setBacklogSprintName] = useState('');
  const [backlogSearch, setBacklogSearch] = useState('');
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityErr, setActivityErr] = useState<Record<string, string>>({});
  const [activityForm, setActivityForm] = useState({
    sprintName: '',
    issueType: '',
    epic: '',
    issueDescription: '',
    startDate: isoDateToday(),
    endDate: isoDateToday(),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const idFilter = projectId ? `new_projectid eq '${projectId.replace(/'/g, "''")}'` : '';
      const nameFilter = `new_projectname eq '${projectName.replace(/'/g, "''")}'`;
      const filter = idFilter || nameFilter;
      const [sRes, iRes] = await Promise.all([
        New_sprintsService.getAll({ top: 500, orderBy: ['createdon desc'], filter }),
        New_sprintissuesService.getAll({ top: 2000, orderBy: ['createdon desc'], filter }),
      ]);
      if (!sRes.success) throw new Error(sRes.error?.message ?? 'Failed to load sprints');
      if (!iRes.success) throw new Error(iRes.error?.message ?? 'Failed to load sprint activity');
      const sprintRows = (sRes.data ?? []) as unknown as SprintRow[];
      setSprints(sprintRows);
      setIssues((iRes.data ?? []) as unknown as IssueRow[]);
      if (!selectedSprintName && sprintRows.length > 0) {
        setSelectedSprintName(String(sprintRows[0].new_sprintname ?? '').trim());
      }
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to load agile sprint data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, projectName]);

  useEffect(() => {
    if (!showCreateSprint) return;
    setCreateForm({
      sprintName: '',
      sprintGoal: '',
      startDate: isoDateToday(),
      endDate: isoDateToday(),
    });
    setCreateErr({});
  }, [showCreateSprint]);

  const saveSprint = async () => {
    const err: Record<string, string> = {};
    if (!createForm.sprintName.trim()) err.sprintName = 'Sprint Name is required';
    if (!createForm.sprintGoal.trim()) err.sprintGoal = 'Sprint Goal is required';
    if (!createForm.startDate) err.startDate = 'Start Date is required';
    if (!createForm.endDate) err.endDate = 'End Date is required';
    if (createForm.startDate && createForm.endDate && createForm.endDate < createForm.startDate) {
      err.endDate = 'End Date should be after Start Date';
    }
    if (!projectId.trim()) err.project = 'Project ID is missing';
    setCreateErr(err);
    if (Object.keys(err).length) return;

    setCreateBusy(true);
    try {
      const payload: Record<string, unknown> = {
        new_projectid: projectId.trim(),
        new_projectname: projectName.trim(),
        new_sprintname: createForm.sprintName.trim(),
        new_sprintgoal: createForm.sprintGoal.trim(),
        new_startdate: new Date(createForm.startDate).toISOString(),
        new_enddate: new Date(createForm.endDate).toISOString(),
        new_progress: 0,
        new_sprintstatus: 100000000,
        statecode: 0,
      };
      const res = await New_sprintsService.create(payload as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create sprint');
      onNotify({ type: 'success', message: 'Sprint created successfully.' });
      setShowCreateSprint(false);
      await loadData();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to create sprint' });
    } finally {
      setCreateBusy(false);
    }
  };

  const openEditSprint = (row: SprintRow) => {
    const statusRaw = Number(row.new_sprintstatus ?? NaN);
    const statusFromName = SPRINT_STATUS_OPTIONS.find((o) => o.label.toLowerCase() === sprintStatusLabel(row).toLowerCase())?.value;
    const status = Number.isFinite(statusRaw)
      ? statusRaw
      : (statusFromName ?? 100000000);
    setEditSprint(row);
    setEditForm({
      sprintName: String(row.new_sprintname ?? '').trim(),
      progress: String(row.new_progress ?? '').trim(),
      sprintGoal: String(row.new_sprintgoal ?? '').trim(),
      startDate: toDateInputValue(row.new_startdate),
      endDate: toDateInputValue(row.new_enddate),
      sprintStatus: String(status),
    });
    setEditErr({});
  };

  const updateSprint = async () => {
    if (!editSprint) return;
    const err: Record<string, string> = {};
    if (!editForm.sprintName.trim()) err.sprintName = 'Sprint Name is required';
    if (!editForm.sprintGoal.trim()) err.sprintGoal = 'Sprint Goal is required';
    if (!editForm.startDate) err.startDate = 'Start Date is required';
    if (!editForm.endDate) err.endDate = 'End Date is required';
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) {
      err.endDate = 'End Date should be after Start Date';
    }
    const progressNum = Number(editForm.progress);
    if (editForm.progress.trim() === '') err.progress = 'Progress is required';
    else if (Number.isNaN(progressNum) || progressNum < 0 || progressNum > 100) err.progress = 'Progress must be between 0 and 100';
    if (!editForm.sprintStatus) err.sprintStatus = 'Sprint Status is required';
    const sprintGuid = String(editSprint.new_sprintid ?? '').trim();
    if (!sprintGuid) err.row = 'Sprint record id is missing';
    setEditErr(err);
    if (Object.keys(err).length > 0) return;

    setEditBusy(true);
    try {
      const res = await New_sprintsService.update(sprintGuid, {
        new_sprintname: editForm.sprintName.trim(),
        new_sprintgoal: editForm.sprintGoal.trim(),
        new_startdate: new Date(editForm.startDate).toISOString(),
        new_enddate: new Date(editForm.endDate).toISOString(),
        new_progress: progressNum,
        new_sprintstatus: Number(editForm.sprintStatus) as 100000000 | 100000001 | 100000002,
      } as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update sprint');
      onNotify({ type: 'success', message: 'Sprint updated successfully.' });
      setEditSprint(null);
      await loadData();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to update sprint' });
    } finally {
      setEditBusy(false);
    }
  };

  const saveActivity = async () => {
    const err: Record<string, string> = {};
    if (!activityForm.sprintName.trim()) err.sprintName = 'Sprint Name is required';
    if (!activityForm.issueType) err.issueType = 'Issue Type is required';
    if (!activityForm.issueDescription.trim()) err.issueDescription = 'Issue Description is required';
    if (!activityForm.startDate) err.startDate = 'Start Date is required';
    if (!activityForm.endDate) err.endDate = 'End Date is required';
    if (activityForm.startDate && activityForm.endDate && activityForm.endDate < activityForm.startDate) {
      err.endDate = 'End Date should be after Start Date';
    }
    if (!projectId.trim()) err.project = 'Project ID is missing';
    setActivityErr(err);
    if (Object.keys(err).length > 0) return;

    setActivityBusy(true);
    try {
      const payload: Record<string, unknown> = {
        new_projectid: projectId.trim(),
        new_projectname: projectName.trim(),
        new_sprintname: activityForm.sprintName.trim(),
        new_issuetype: Number(activityForm.issueType) as 100000000 | 100000001 | 100000002,
        new_epic: activityForm.epic.trim() || undefined,
        new_issuedescription: activityForm.issueDescription.trim(),
        new_startdate: new Date(activityForm.startDate).toISOString(),
        new_enddate: new Date(activityForm.endDate).toISOString(),
        new_status: 100000000,
        new_progress: '0',
        statecode: 0,
      };
      const res = await New_sprintissuesService.create(payload as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create activity');
      onNotify({ type: 'success', message: 'Activity created successfully.' });
      setShowCreateActivity(false);
      await loadData();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to create activity' });
    } finally {
      setActivityBusy(false);
    }
  };

  const visibleSprints = useMemo(() => {
    const q = searchSprint.trim().toLowerCase();
    if (!q) return sprints;
    return sprints.filter((s) => String(s.new_sprintname ?? '').toLowerCase().includes(q) || String(s.new_sprintgoal ?? '').toLowerCase().includes(q));
  }, [searchSprint, sprints]);

  const visibleIssues = useMemo(() => {
    const q = searchIssue.trim().toLowerCase();
    return issues.filter((i) => {
      const bySprint = selectedSprintName ? String(i.new_sprintname ?? '').trim() === selectedSprintName : true;
      if (!bySprint) return false;
      const status = issueStatusLabel(i);
      const type = issueTypeLabel(i);
      const byStatus = issueStatusFilter === 'All Status' || status === issueStatusFilter;
      const byType = issueTypeFilter === 'All Issue Type' || type === issueTypeFilter;
      const bySearch = !q
        || String(i.new_issuedescription ?? '').toLowerCase().includes(q)
        || type.toLowerCase().includes(q);
      return byStatus && byType && bySearch;
    });
  }, [issues, issueStatusFilter, issueTypeFilter, searchIssue, selectedSprintName]);

  const backlogIssues = useMemo(() => {
    const q = backlogSearch.trim().toLowerCase();
    return issues.filter((i) => {
      const bySprint = backlogSprintName ? String(i.new_sprintname ?? '').trim() === backlogSprintName : true;
      if (!bySprint) return false;
      if (!q) return true;
      return (
        String(i.new_issuedescription ?? '').toLowerCase().includes(q)
        || String(i.new_epic ?? '').toLowerCase().includes(q)
        || issueTypeLabel(i).toLowerCase().includes(q)
      );
    });
  }, [issues, backlogSearch, backlogSprintName]);

  useEffect(() => {
    if (!showCreateActivity) return;
    setActivityForm({
      sprintName: backlogSprintName || selectedSprintName || '',
      issueType: '',
      epic: '',
      issueDescription: '',
      startDate: isoDateToday(),
      endDate: isoDateToday(),
    });
    setActivityErr({});
  }, [showCreateActivity, backlogSprintName, selectedSprintName]);

  const statusOptions = useMemo(
    () => ['All Status', ...Array.from(new Set(issues.map(issueStatusLabel).filter((s) => s && s !== '—')))],
    [issues],
  );
  const typeOptions = useMemo(
    () => ['All Issue Type', ...Array.from(new Set(issues.map(issueTypeLabel).filter((s) => s && s !== '—')))],
    [issues],
  );

  const rightMeta = {
    sponsor: String(project.crcf8_projectsponsor ?? project.new_projectsponsorname ?? project.new_projectsponsor ?? 'IT'),
    objective: String(project.new_projecttypename ?? project.new_projecttype ?? 'Time bound'),
    priority: String(project.new_projectpriorityname ?? project.new_projectpriority ?? '—'),
    type: String(project.new_methodologyname ?? project.new_methodology ?? 'Agile'),
    budget: String(project.new_budget ?? '—'),
    category: String(project.new_projectcategoryname ?? project.new_projectcategory ?? '—'),
    description: String(project.new_description ?? project.crcf8_description ?? 'NA'),
  };

  if (backlogSprintName) {
    return (
      <section className={`${enj.panelBg} flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden`}>
        <div className="min-h-0 rounded-xl border border-[#e4e7f1] bg-white p-4 flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              <button type="button" className="underline text-gray-700" onClick={() => setBacklogSprintName('')}>Sprint</button>
              {' > '}Agile Backlog
            </p>
            <button type="button" onClick={() => void loadData()} className="h-7 rounded border border-gray-200 px-2 text-[11px] text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className={enj.pageTitle}>Backlog</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  className="h-8 w-40 rounded-md border border-gray-200 bg-[#f5f6fb] pl-7 pr-2 text-xs outline-none"
                  placeholder="Search"
                  value={backlogSearch}
                  onChange={(e) => setBacklogSearch(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className={`${enj.btnPrimary} !h-8 px-3 text-xs`}
              onClick={() => setShowCreateActivity(true)}
            >
              + Create Activity
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d8dff5]">
            <table className={`${enj.tableBrand} text-xs`}>
              <thead>
                <tr>
                  <th>Sprint Name</th>
                  <th>Epic</th>
                  <th>Type</th>
                  <th>Issue Description</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {backlogIssues.length === 0 ? (
                  <tr>
                    <td className="px-3 py-28 text-center text-sm text-primary" colSpan={7}>No Issues Created for this Sprint</td>
                  </tr>
                ) : (
                  backlogIssues.map((i, idx) => (
                    <tr key={`${String(i.new_sprintissueid ?? idx)}`} className="border-b border-[#edf0f8]">
                      <td className="px-3 py-2">{String(i.new_sprintname ?? '—')}</td>
                      <td className="px-3 py-2">{String(i.new_epic ?? '—')}</td>
                      <td className="px-3 py-2">{issueTypeLabel(i)}</td>
                      <td className="px-3 py-2">{String(i.new_issuedescription ?? '—')}</td>
                      <td className="px-3 py-2">{fmtDate(i.new_startdate)} - {fmtDate(i.new_enddate)}</td>
                      <td className="px-3 py-2">{issueStatusLabel(i)}</td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {showCreateActivity && (
          <div className="fixed inset-0 z-[122] flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-4xl rounded-xl bg-white p-7 shadow-2xl">
              <p className="mb-4 text-xl font-semibold text-primary">Create Activity</p>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-600">Sprint Name</label>
                  <input
                    className={`mt-1 ${enj.control}`}
                    value={activityForm.sprintName}
                    onChange={(e) => setActivityForm((f) => ({ ...f, sprintName: e.target.value }))}
                  />
                  {activityErr.sprintName && <p className="mt-1 text-[11px] text-rose-600">{activityErr.sprintName}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600">Issue Type</label>
                  <select
                    className={`mt-1 ${enj.control}`}
                    value={activityForm.issueType}
                    onChange={(e) => setActivityForm((f) => ({ ...f, issueType: e.target.value }))}
                  >
                    <option value="">Find items</option>
                    {ACTIVITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
                  </select>
                  {activityErr.issueType && <p className="mt-1 text-[11px] text-rose-600">{activityErr.issueType}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600">Epic</label>
                  <textarea
                    className={`mt-1 ${enj.textarea} min-h-[4rem] resize-none`}
                    value={activityForm.epic}
                    onChange={(e) => setActivityForm((f) => ({ ...f, epic: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Issue Description</label>
                  <textarea
                    className={`mt-1 ${enj.textarea} min-h-[4rem] resize-none`}
                    value={activityForm.issueDescription}
                    onChange={(e) => setActivityForm((f) => ({ ...f, issueDescription: e.target.value }))}
                  />
                  {activityErr.issueDescription && <p className="mt-1 text-[11px] text-rose-600">{activityErr.issueDescription}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600">Start Date</label>
                  <input
                    type="date"
                    className={`mt-1 ${enj.control}`}
                    value={activityForm.startDate}
                    onChange={(e) => setActivityForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                  {activityErr.startDate && <p className="mt-1 text-[11px] text-rose-600">{activityErr.startDate}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600">End Date</label>
                  <input
                    type="date"
                    className={`mt-1 ${enj.control}`}
                    value={activityForm.endDate}
                    onChange={(e) => setActivityForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                  {activityErr.endDate && <p className="mt-1 text-[11px] text-rose-600">{activityErr.endDate}</p>}
                </div>
              </div>
              {activityErr.project && <p className="mt-2 text-[11px] text-rose-600">{activityErr.project}</p>}
              <div className="mt-8 flex items-center justify-end gap-4">
                <button
                  type="button"
                  className={`${enj.btnOutline} min-w-[7rem]`}
                  onClick={() => setShowCreateActivity(false)}
                  disabled={activityBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${enj.btnPrimary} min-w-[7rem]`}
                  onClick={() => void saveActivity()}
                  disabled={activityBusy}
                >
                  {activityBusy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`${enj.panelBg} flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden`}>
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-h-0 rounded-xl border border-[#e4e7f1] bg-white p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              <button type="button" onClick={onBack} className="text-gray-700 underline">
                Project
              </button>
              {' > '}
              {projectName}
            </p>
            <button type="button" onClick={() => void loadData()} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className={enj.pageTitle}>Agile</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  className={`${enj.control} !h-8 pl-7 pr-2 text-xs`}
                  placeholder="Search"
                  value={searchSprint}
                  onChange={(e) => setSearchSprint(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={`${enj.btnPrimary} !h-8 px-3 text-xs`}
                onClick={() => setShowCreateSprint(true)}
              >
                Create Sprint
              </button>
            </div>
          </div>

          <div className="min-h-[12rem] rounded-lg border border-[#d8dff5] overflow-hidden bg-white">
            <table className={`${enj.tableBrand} text-xs`}>
              <thead>
                <tr>
                  <th>Sprint Name</th>
                  <th>Sprint Goal</th>
                  <th>Schedule</th>
                  <th>Progress Level</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleSprints.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-400" colSpan={6}>No sprints found.</td>
                  </tr>
                ) : (
                  visibleSprints.map((s, idx) => {
                    const sprintName = String(s.new_sprintname ?? '').trim() || `Sprint ${idx + 1}`;
                    const selected = sprintName === selectedSprintName;
                    const pct = sprintProgressPct(s);
                    return (
                      <tr key={`${sprintName}-${idx}`} className={selected ? 'bg-indigo-50/20' : ''}>
                        <td className="px-4 py-3">
                          <button type="button" className="underline decoration-primary/30 underline-offset-2" onClick={() => setSelectedSprintName(sprintName)}>
                            {sprintName}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-primary">{String(s.new_sprintgoal ?? '—')}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 text-[11px]">
                            <div>
                              <p className="text-[10px] text-gray-500">Start Date</p>
                              <p className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-gray-500" />{fmtDate(s.new_startdate)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500">End Date</p>
                              <p className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-gray-500" />{fmtDate(s.new_enddate)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[10px] text-right text-gray-500">{pct} %</div>
                          <div className="h-3 w-32 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-[#1b67e0]" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`${enj.pillSuccess} min-w-[44px]`}>{sprintStatusLabel(s)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <button
                              type="button"
                              className="rounded p-0.5 hover:bg-gray-100"
                              title="Edit sprint"
                              onClick={() => openEditSprint(s)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-0.5 hover:bg-gray-100"
                              title="Add issue"
                              onClick={() => setBacklogSprintName(sprintName)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[#dfe3f2] p-3 min-h-0 flex-1 overflow-hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className={enj.pageTitle}>Activity</h3>
                <select className="h-7 rounded border border-gray-200 bg-[#f5f6fb] px-2 text-xs" value={issueStatusFilter} onChange={(e) => setIssueStatusFilter(e.target.value)}>
                  {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <select className="h-7 rounded border border-gray-200 bg-[#f5f6fb] px-2 text-xs" value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)}>
                  {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-gray-400" />
                <RefreshCw className="h-4 w-4 text-gray-400" />
                <ListFilter className="h-4 w-4 text-gray-400" />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input className="h-7 rounded bg-[#f5f6fb] pl-7 pr-2 text-xs outline-none" placeholder="Search" value={searchIssue} onChange={(e) => setSearchIssue(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className={`${enj.tableBrand} text-xs`}>
                <thead>
                  <tr>
                    <th className="px-3 py-1.5">Type</th>
                    <th className="px-3 py-1.5">Issue Description</th>
                    <th className="px-3 py-1.5">Progress</th>
                    <th className="px-3 py-1.5">Status</th>
                    <th className="px-3 py-1.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIssues.length === 0 ? (
                    <tr>
                      <td className="px-3 py-12 text-center text-gray-500" colSpan={5}>
                        {selectedSprintName ? 'No activity in selected sprint' : 'Select sprint to view activity'}
                      </td>
                    </tr>
                  ) : (
                    visibleIssues.map((i, idx) => (
                      <tr key={`${String(i.new_sprintissueid ?? idx)}`}>
                        <td className="px-3 py-2">{issueTypeLabel(i)}</td>
                        <td className="px-3 py-2">{String(i.new_issuedescription ?? '—')}</td>
                        <td className="px-3 py-2">{String(i.new_progress ?? '—')}</td>
                        <td className="px-3 py-2">{issueStatusLabel(i)}</td>
                        <td className="px-3 py-2">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-700">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Pro. Sponsor</span>
              <span className="font-semibold text-right">{rightMeta.sponsor}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Starg. Obj</span>
              <span className="font-semibold text-right">{rightMeta.objective}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Priority</span>
              <span className={enj.pillDanger}>{rightMeta.priority}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold text-right">{rightMeta.type}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Budget</span>
              <span className="font-semibold text-right text-rose-600">{rightMeta.budget}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Category</span>
              <span className="font-semibold text-right">{rightMeta.category}</span>
            </div>
            <div className="pt-1">
              <p className="text-gray-500">Description</p>
              <p className="mt-2 leading-relaxed">{rightMeta.description || 'NA'}</p>
            </div>
          </div>
        </aside>
      </div>
      {editSprint && (
        <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className={enj.sectionTitle}>Edit Sprint</p>
              <button type="button" onClick={() => setEditSprint(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-600">Sprint Name</label>
                <input
                  className={`mt-1 ${enj.control}`}
                  value={editForm.sprintName}
                  onChange={(e) => setEditForm((f) => ({ ...f, sprintName: e.target.value }))}
                />
                {editErr.sprintName && <p className="mt-1 text-[11px] text-rose-600">{editErr.sprintName}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">Progress</label>
                <input
                  className={`mt-1 ${enj.control}`}
                  value={editForm.progress}
                  onChange={(e) => setEditForm((f) => ({ ...f, progress: e.target.value }))}
                />
                {editErr.progress && <p className="mt-1 text-[11px] text-rose-600">{editErr.progress}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-600">Sprint Goal</label>
                <input
                  className={`mt-1 ${enj.control}`}
                  value={editForm.sprintGoal}
                  onChange={(e) => setEditForm((f) => ({ ...f, sprintGoal: e.target.value }))}
                />
                {editErr.sprintGoal && <p className="mt-1 text-[11px] text-rose-600">{editErr.sprintGoal}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">Start Date</label>
                <input
                  type="date"
                  className={`mt-1 ${enj.control}`}
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                {editErr.startDate && <p className="mt-1 text-[11px] text-rose-600">{editErr.startDate}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">End Date</label>
                <input
                  type="date"
                  className={`mt-1 ${enj.control}`}
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                />
                {editErr.endDate && <p className="mt-1 text-[11px] text-rose-600">{editErr.endDate}</p>}
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs text-gray-600">Sprint Status</label>
                <select
                  className={`mt-1 ${enj.control}`}
                  value={editForm.sprintStatus}
                  onChange={(e) => setEditForm((f) => ({ ...f, sprintStatus: e.target.value }))}
                >
                  {SPRINT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
                {editErr.sprintStatus && <p className="mt-1 text-[11px] text-rose-600">{editErr.sprintStatus}</p>}
              </div>
            </div>
            {editErr.row && <p className="mt-2 text-[11px] text-rose-600">{editErr.row}</p>}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                className={`${enj.btnOutline} min-w-[7rem]`}
                onClick={() => setEditSprint(null)}
                disabled={editBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${enj.btnPrimary} min-w-[7rem]`}
                onClick={() => void updateSprint()}
                disabled={editBusy}
              >
                {editBusy ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateSprint && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className={enj.sectionTitle}>
                Create Sprint {'>'} <span className="underline">{projectName}</span>
              </p>
              <button type="button" onClick={() => setShowCreateSprint(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-600">Sprint Name</label>
                <input
                  className={`mt-1 ${enj.control}`}
                  placeholder="Enter Sprint Name"
                  value={createForm.sprintName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sprintName: e.target.value }))}
                />
                {createErr.sprintName && <p className="mt-1 text-[11px] text-rose-600">{createErr.sprintName}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">Sprint Goal</label>
                <input
                  className={`mt-1 ${enj.control}`}
                  placeholder="Enter Sprint Goal"
                  value={createForm.sprintGoal}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sprintGoal: e.target.value }))}
                />
                {createErr.sprintGoal && <p className="mt-1 text-[11px] text-rose-600">{createErr.sprintGoal}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">Start Date</label>
                <input
                  type="date"
                  className={`mt-1 ${enj.control}`}
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                {createErr.startDate && <p className="mt-1 text-[11px] text-rose-600">{createErr.startDate}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-600">End Date</label>
                <input
                  type="date"
                  className={`mt-1 ${enj.control}`}
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                />
                {createErr.endDate && <p className="mt-1 text-[11px] text-rose-600">{createErr.endDate}</p>}
              </div>
            </div>
            {createErr.project && <p className="mt-2 text-[11px] text-rose-600">{createErr.project}</p>}
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                type="button"
                className={`${enj.btnOutline} min-w-[7rem]`}
                onClick={() => setShowCreateSprint(false)}
                disabled={createBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${enj.btnPrimary} min-w-[7rem]`}
                onClick={() => void saveSprint()}
                disabled={createBusy}
              >
                {createBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

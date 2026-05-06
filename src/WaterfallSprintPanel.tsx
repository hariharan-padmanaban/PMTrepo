import { useEffect, useState } from 'react';
import { CalendarDays, ListFilter, Pencil, RefreshCw, Search, Users } from 'lucide-react';
import type { ToastType } from './NotificationToast';
import { New_classicwaterfallsService } from './generated/services/New_classicwaterfallsService';
import { enj } from './ui/enjForm';

type ProjectRow = Record<string, unknown>;
const STAGE_OPTIONS: Array<{ label: 'Requirement' | 'Development' | 'Design' | 'Testing' | 'Deployment' | 'Support'; value: 100000000 | 100000001 | 100000002 | 100000003 | 100000004 | 100000005 }> = [
  { label: 'Requirement', value: 100000000 },
  { label: 'Development', value: 100000001 },
  { label: 'Design', value: 100000002 },
  { label: 'Testing', value: 100000003 },
  { label: 'Deployment', value: 100000004 },
  { label: 'Support', value: 100000005 },
];
const TASK_STATUS_OPTIONS: Array<{ label: 'To Do' | 'In progress' | 'Delayed' | 'Done'; value: number }> = [
  { label: 'To Do', value: 100000000 },
  { label: 'In progress', value: 100000001 },
  { label: 'Delayed', value: 100000002 },
  { label: 'Done', value: 100000003 },
];

export function WaterfallSprintPanel({
  project,
  onBack,
  onNotify,
}: {
  project: ProjectRow;
  onBack: () => void;
  onNotify: (p: { type: ToastType; message: string }) => void;
}) {
  const projectName = String(project.new_projectname ?? project.new_name ?? '').trim() || 'Project';
  const isoToday = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [taskErr, setTaskErr] = useState<Record<string, string>>({});
  const [editErr, setEditErr] = useState<Record<string, string>>({});
  const [rowsLoading, setRowsLoading] = useState(false);
  const [taskRows, setTaskRows] = useState<Array<Record<string, unknown>>>([]);
  const [searchText, setSearchText] = useState('');
  const [stageFilter, setStageFilter] = useState('All Stages');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;
  const [taskForm, setTaskForm] = useState({
    key: '',
    summary: '',
    startDate: isoToday,
    endDate: isoToday,
    stage: '',
  });
  const [editForm, setEditForm] = useState({
    key: '',
    summary: '',
    stage: '',
    startDate: isoToday,
    endDate: isoToday,
    status: '',
  });

  useEffect(() => {
    if (!showCreateTask) return;
    setTaskForm({ key: '', summary: '', startDate: isoToday, endDate: isoToday, stage: '' });
    setTaskErr({});
  }, [showCreateTask]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, stageFilter, statusFilter]);

  const toDateInput = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return isoToday;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return isoToday;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openEditTask = (row: Record<string, unknown>) => {
    const stage = String(row.new_stage ?? '').trim();
    const status = String(row.new_status ?? '').trim();
    setEditingRow(row);
    setEditForm({
      key: String(row.new_key ?? '').trim(),
      summary: String(row.new_summary ?? '').trim(),
      stage: stage || '',
      startDate: toDateInput(row.new_startdate),
      endDate: toDateInput(row.new_enddate),
      status: status || '',
    });
    setEditErr({});
    setShowEditTask(true);
  };

  const loadWaterfallRows = async () => {
    setRowsLoading(true);
    try {
      const escapedProject = projectName.replace(/'/g, "''");
      const filter = `new_projectname eq '${escapedProject}'`;
      const res = await New_classicwaterfallsService.getAll({ top: 1000, orderBy: ['createdon desc'], filter });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load waterfall tasks');
      setTaskRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to load waterfall tasks' });
      setTaskRows([]);
    } finally {
      setRowsLoading(false);
    }
  };

  useEffect(() => {
    void loadWaterfallRows();
  }, [projectName]);

  const stageLabelFromRow = (r: Record<string, unknown>) => {
    const stageNum = Number(r.new_stage ?? NaN);
    return STAGE_OPTIONS.find((s) => s.value === stageNum)?.label ?? String(r.new_stagename ?? '—');
  };

  const statusLabelFromRow = (r: Record<string, unknown>) => {
    const statusNum = Number(r.new_status ?? NaN);
    return TASK_STATUS_OPTIONS.find((s) => s.value === statusNum)?.label ?? String(r.new_statusname ?? '—');
  };

  const getStatusColorClass = (statusLabel: string) => {
    const lower = statusLabel.toLowerCase();
    if (lower.includes('done')) return 'bg-blue-100 text-blue-700';
    if (lower.includes('progress')) return 'bg-amber-100 text-amber-700';
    if (lower.includes('delay')) return 'bg-rose-100 text-rose-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const filteredRows = taskRows.filter((r) => {
    const stageLabel = stageLabelFromRow(r);
    const statusLabel = statusLabelFromRow(r);
    const matchesStage = stageFilter === 'All Stages' || stageLabel === stageFilter;
    const matchesStatus = statusFilter === 'All Status' || statusLabel === statusFilter;
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q
      || String(r.new_key ?? '').toLowerCase().includes(q)
      || String(r.new_summary ?? '').toLowerCase().includes(q)
      || String(r.new_assign_to_member ?? '').toLowerCase().includes(q)
      || stageLabel.toLowerCase().includes(q)
      || statusLabel.toLowerCase().includes(q);
    return matchesStage && matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const saveTask = async () => {
    const err: Record<string, string> = {};
    if (!taskForm.key.trim()) err.key = 'Key is required';
    if (!taskForm.summary.trim()) err.summary = 'Summary is required';
    if (!taskForm.startDate) err.startDate = 'Start Date is required';
    if (!taskForm.endDate) err.endDate = 'End Date is required';
    if (taskForm.startDate && taskForm.endDate && taskForm.endDate < taskForm.startDate) {
      err.endDate = 'End Date should be after Start Date';
    }
    if (!taskForm.stage) err.stage = 'Stage is required';
    setTaskErr(err);
    if (Object.keys(err).length > 0) return;

    setTaskBusy(true);
    try {
      const existingRes = await New_classicwaterfallsService.getAll({ top: 1000, orderBy: ['createdon desc'] });
      const rows = existingRes.success ? (existingRes.data ?? []) : [];
      let maxWaterfallId = 0;
      rows.forEach((r) => {
        const n = Number(String((r as unknown as { new_waterfall_id?: unknown }).new_waterfall_id ?? '').trim());
        if (Number.isFinite(n) && n > maxWaterfallId) maxWaterfallId = n;
      });
      const nextWaterfallId = String(maxWaterfallId + 1);
      const selectedStage = Number(taskForm.stage) as 100000000 | 100000001 | 100000002 | 100000003 | 100000004 | 100000005;

      const res = await New_classicwaterfallsService.create({
        new_projectname: projectName,
        new_waterfall_id: nextWaterfallId,
        new_key: taskForm.key.trim(),
        new_summary: taskForm.summary.trim(),
        new_startdate: new Date(taskForm.startDate).toISOString(),
        new_enddate: new Date(taskForm.endDate).toISOString(),
        new_stage: selectedStage,
        new_status: selectedStage,
        statecode: 0,
      } as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create waterfall task');
      onNotify({ type: 'success', message: 'Task has been created successfully.' });
      setShowCreateTask(false);
      await loadWaterfallRows();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to create task' });
    } finally {
      setTaskBusy(false);
    }
  };

  const updateTask = async () => {
    if (!editingRow) return;
    const err: Record<string, string> = {};
    if (!editForm.key.trim()) err.key = 'Key is required';
    if (!editForm.summary.trim()) err.summary = 'Summary is required';
    if (!editForm.stage) err.stage = 'Stage is required';
    if (!editForm.startDate) err.startDate = 'Start Date is required';
    if (!editForm.endDate) err.endDate = 'End Date is required';
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) err.endDate = 'End Date should be after Start Date';
    if (!editForm.status) err.status = 'Status is required';
    const rowId = String(editingRow.new_classicwaterfallid ?? '').trim();
    if (!rowId) err.row = 'Task id missing';
    setEditErr(err);
    if (Object.keys(err).length > 0) return;

    setEditBusy(true);
    try {
      const res = await New_classicwaterfallsService.update(rowId, {
        new_key: editForm.key.trim(),
        new_summary: editForm.summary.trim(),
        new_stage: Number(editForm.stage),
        new_startdate: new Date(editForm.startDate).toISOString(),
        new_enddate: new Date(editForm.endDate).toISOString(),
        new_status: Number(editForm.status),
      } as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update task');
      onNotify({ type: 'success', message: 'Task updated successfully.' });
      setShowEditTask(false);
      setEditingRow(null);
      await loadWaterfallRows();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to update task' });
    } finally {
      setEditBusy(false);
    }
  };
  const rightMeta = {
    sponsor: String(project.crcf8_projectsponsor ?? project.new_projectsponsorname ?? project.new_projectsponsor ?? '—'),
    objective: String(project.new_projecttypename ?? project.new_projecttype ?? '—'),
    priority: String(project.new_projectpriorityname ?? project.new_projectpriority ?? '—'),
    type: String(project.new_methodologyname ?? project.new_methodology ?? 'Waterfall'),
    budget: String(project.new_budget ?? '—'),
    category: String(project.new_projectcategoryname ?? project.new_projectcategory ?? '—'),
    description: String(project.new_description ?? project.crcf8_description ?? 'NA'),
  };

  return (
    <section className={`${enj.panelBg} flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden`}>
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-h-0 rounded-xl border border-[#e4e7f1] bg-white p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">
              <button type="button" onClick={onBack} className="text-primary underline">
                Project
              </button>
              {' > '}
              {projectName}
            </p>
            <button
              type="button"
              onClick={() => void loadWaterfallRows()}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xl font-semibold text-primary">Classic project</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  className={`${enj.control} !w-56 bg-[#f5f6fb] pl-7 pr-2 text-sm`}
                  placeholder="Search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <RefreshCw className="h-4 w-4 text-gray-400" />
              <ListFilter className="h-4 w-4 text-gray-400" />
              <select
                className={`${enj.control} !w-auto min-w-[8rem] text-sm`}
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option>All Stages</option>
                {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.label}>{s.label}</option>)}
              </select>
              <select
                className={`${enj.control} !w-auto min-w-[8rem] text-sm`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All Status</option>
                {TASK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.label}>{s.label}</option>)}
              </select>
              <button
                type="button"
                className={`${enj.btn} ${enj.btnPrimary} !h-9 !w-9 !min-h-0 !max-h-none p-0 text-lg font-normal leading-none`}
                onClick={() => setShowCreateTask(true)}
              >
                +
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-transparent">
            <table className="w-full border-separate [border-spacing:0_8px] bg-transparent text-xs">
              <thead>
                <tr className="bg-[rgba(225,227,236,1)]">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Key</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Team Member</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Timeline</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Stage</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[rgba(118,131,150,1)] border-0">Action</th>
                </tr>
              </thead>
              <tbody>
                {rowsLoading ? (
                  <tr>
                    <td className="px-3 py-20 text-center text-sm text-gray-500" colSpan={6}>
                      Loading tasks...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-28 text-center text-sm text-primary" colSpan={6}>
                      No matching tasks found
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((r, idx) => {
                    const stageLabel = stageLabelFromRow(r);
                    const statusLabel = statusLabelFromRow(r);
                    const timelineStart = String(r.new_startdate ?? '').trim();
                    const timelineEnd = String(r.new_enddate ?? '').trim();
                    const fmt = (v: string) => {
                      if (!v) return '—';
                      const d = new Date(v);
                      if (Number.isNaN(d.getTime())) return v;
                      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    };
                    return (
                      <tr key={`${String(r.new_classicwaterfallid ?? idx)}`} className="bg-white rounded-[11.9px] hover:shadow-md">
                        <td className="px-3 py-2 text-xs font-normal text-[#4c556d]">{String(r.new_key ?? '—')}</td>
                        <td className="px-3 py-2 text-xs font-normal text-[#4c556d]">{String(r.new_assign_to_member ?? '').trim() || 'Not Assigned'}</td>
                        <td className="px-3 py-2 text-xs font-normal text-[#4c556d]">
                          <div className="flex items-center gap-3 text-[11px]">
                            <div>
                              <p className="text-[10px] text-gray-500">Start Date</p>
                              <p className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-gray-500" />{fmt(timelineStart)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500">End Date</p>
                              <p className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-gray-500" />{fmt(timelineEnd)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-normal text-[#4c556d]">
                          <span className="inline-flex items-center gap-1">
                            <ListFilter className="h-3.5 w-3.5 text-[#b28a44]" />
                            {stageLabel || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-flex min-w-[56px] items-center justify-center rounded-md px-2 py-0.5 text-[12px] font-medium ${getStatusColorClass(statusLabel)}`}>
                            {statusLabel || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 text-gray-500">
                            <button type="button" className="rounded p-0.5 hover:bg-gray-100" title="Edit task" onClick={() => openEditTask(r)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" className="rounded p-0.5 hover:bg-gray-100" title="Assign member">
                              <Users className="h-4 w-4" />
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
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="h-6 rounded border border-gray-200 px-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              &lsaquo;
            </button>
            <span className="text-[11px] text-gray-500">{(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredRows.length)}</span>
            <button type="button" className="h-6 rounded border border-gray-200 px-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              &rsaquo;
            </button>
          </div>
        </div>

        <aside className="rounded-xl border border-[#e4e7f1] bg-white px-5 py-4 text-xs text-primary">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Pro. Sponsor</span>
              <span className="font-semibold text-right">{rightMeta.sponsor}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Strategic Goal</span>
              <span className="font-semibold text-right">{rightMeta.objective}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Priority</span>
              <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">{rightMeta.priority}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Type</span>
              <span className="font-semibold text-right">{rightMeta.type}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Budget</span>
              <span className="font-semibold text-right text-rose-600">{rightMeta.budget}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-primary">Category</span>
              <span className="font-semibold text-right">{rightMeta.category}</span>
            </div>
            <div className="pt-1">
              <p className="text-primary">Description</p>
              <p className="mt-2 leading-relaxed">{rightMeta.description || 'NA'}</p>
            </div>
          </div>
        </aside>
      </div>
      {showCreateTask && (
        <div className="fixed inset-0 z-[122] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-7 shadow-2xl">
            <p className="mb-4 text-xl font-semibold text-primary">Create Task {'>'} {projectName}</p>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-primary">Key <span className="text-rose-600">*</span></label>
                <textarea
                  className={`${enj.textarea} mt-1 h-16 min-h-16 resize-none`}
                  placeholder="Enter key value"
                  value={taskForm.key}
                  onChange={(e) => setTaskForm((f) => ({ ...f, key: e.target.value }))}
                />
                {taskErr.key && <p className="mt-1 text-[11px] text-rose-600">{taskErr.key}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Summary <span className="text-rose-600">*</span></label>
                <textarea
                  className={`${enj.textarea} mt-1 h-16 min-h-16 resize-none`}
                  placeholder="Enter summary of an task"
                  value={taskForm.summary}
                  onChange={(e) => setTaskForm((f) => ({ ...f, summary: e.target.value }))}
                />
                {taskErr.summary && <p className="mt-1 text-[11px] text-rose-600">{taskErr.summary}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Start Date <span className="text-rose-600">*</span></label>
                <input
                  type="date"
                  className={`${enj.control} mt-1`}
                  value={taskForm.startDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                {taskErr.startDate && <p className="mt-1 text-[11px] text-rose-600">{taskErr.startDate}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">End Date <span className="text-rose-600">*</span></label>
                <input
                  type="date"
                  className={`${enj.control} mt-1`}
                  value={taskForm.endDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, endDate: e.target.value }))}
                />
                {taskErr.endDate && <p className="mt-1 text-[11px] text-rose-600">{taskErr.endDate}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Stage <span className="text-rose-600">*</span></label>
                <select
                  className={`${enj.control} mt-1`}
                  value={taskForm.stage}
                  onChange={(e) => setTaskForm((f) => ({ ...f, stage: e.target.value }))}
                >
                  <option value="">Find items</option>
                  {STAGE_OPTIONS.map((s) => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
                </select>
                {taskErr.stage && <p className="mt-1 text-[11px] text-rose-600">{taskErr.stage}</p>}
              </div>
            </div>
            <div className="mt-8 flex items-center justify-end gap-4">
              <button
                type="button"
                className={`${enj.btn} ${enj.btnOutline} min-w-[7rem] font-semibold hover:bg-amber-50`}
                onClick={() => setShowCreateTask(false)}
                disabled={taskBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${enj.btn} ${enj.btnPrimary} min-w-[7rem] font-semibold`}
                onClick={() => void saveTask()}
                disabled={taskBusy}
              >
                {taskBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditTask && (
        <div className="fixed inset-0 z-[123] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xl font-semibold text-primary">Edit Task {'>'} {projectName}</p>
              <button type="button" onClick={() => setShowEditTask(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100">x</button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-primary">Key <span className="text-rose-600">*</span></label>
                <textarea className={`${enj.textarea} mt-1 h-16 min-h-16 resize-none`} value={editForm.key} onChange={(e) => setEditForm((f) => ({ ...f, key: e.target.value }))} />
                {editErr.key && <p className="mt-1 text-[11px] text-rose-600">{editErr.key}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Summary <span className="text-rose-600">*</span></label>
                <textarea className={`${enj.textarea} mt-1 h-16 min-h-16 resize-none`} value={editForm.summary} onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))} />
                {editErr.summary && <p className="mt-1 text-[11px] text-rose-600">{editErr.summary}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Stage <span className="text-rose-600">*</span></label>
                <select className={`${enj.control} mt-1`} value={editForm.stage} onChange={(e) => setEditForm((f) => ({ ...f, stage: e.target.value }))}>
                  <option value="">Find items</option>
                  {STAGE_OPTIONS.map((s) => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
                </select>
                {editErr.stage && <p className="mt-1 text-[11px] text-rose-600">{editErr.stage}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Start Date <span className="text-rose-600">*</span></label>
                <input type="date" className={`${enj.control} mt-1`} value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
                {editErr.startDate && <p className="mt-1 text-[11px] text-rose-600">{editErr.startDate}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">End Date <span className="text-rose-600">*</span></label>
                <input type="date" className={`${enj.control} mt-1`} value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} />
                {editErr.endDate && <p className="mt-1 text-[11px] text-rose-600">{editErr.endDate}</p>}
              </div>
              <div>
                <label className="text-xs text-primary">Status <span className="text-rose-600">*</span></label>
                <select className={`${enj.control} mt-1`} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Find items</option>
                  {TASK_STATUS_OPTIONS.map((s) => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
                </select>
                {editErr.status && <p className="mt-1 text-[11px] text-rose-600">{editErr.status}</p>}
              </div>
            </div>
            {editErr.row && <p className="mt-2 text-[11px] text-rose-600">{editErr.row}</p>}
            <div className="mt-8 flex items-center justify-end gap-4">
              <button type="button" className={`${enj.btn} ${enj.btnOutline} min-w-[7rem] font-semibold hover:bg-amber-50`} onClick={() => setShowEditTask(false)} disabled={editBusy}>Cancel</button>
              <button type="button" className={`${enj.btn} ${enj.btnPrimary} min-w-[7rem] font-semibold`} onClick={() => void updateTask()} disabled={editBusy}>{editBusy ? 'Updating...' : 'Update'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

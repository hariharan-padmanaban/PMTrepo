/**
 * Shared Reports workspace: same UI and Dataverse wiring as Program role.
 * @license Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Pencil } from 'lucide-react';
import { PagerBar } from './PagerBar';
import { enj } from './ui/enjForm';
import { DonutChart } from './DonutChart';
import { New_projectsService } from './generated/services/New_projectsService';
import type { New_programs } from './generated/models/New_programsModel';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsnew_projectstatus, New_projectsnew_projecttype } from './generated/models/New_projectsModel';
import { New_reportsService } from './generated/services/New_reportsService';
import { EnjazMasterDataService } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import type { ToastType } from './NotificationToast';
import { AddReportFormPanel } from './AddReportFormPanel';
import { buildProgramIdToNameMap, resolveProjectProgramName } from './programNameResolve';

/** Dataverse `new_role` = Business (Users) — same as AddReportFormPanel assign list. */
const USERS_BUSINESS_ROLE = 100000001;
function isUserBusinessRoleRow(u: Record<string, unknown>): boolean {
  return String(u.new_role ?? '') === String(USERS_BUSINESS_ROLE) || String(u.new_rolename ?? '').toLowerCase() === 'business';
}
function userEmailForReportAssignee(u: Record<string, unknown>): string {
  return String(u.new_newcolumn ?? u.new_userid ?? '').trim();
}

function formatListNumber(n: number) {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

const FILTER_STATUS_OPTIONS = ['All', 'To Start', 'On Track', 'Completed', 'Delayed'] as const;
const FILTER_TYPE_OPTIONS = ['All', 'Enhancement', 'New'] as const;

function getProjectManagerDisplayFromProjectRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(
    p.crcf8_projectmanager ?? p.new_programmanager ?? p.crcf8_projectmanagername ?? p.new_projectmanagername ?? p.new_programmanagername ?? '',
  ).trim();
}

/** Maps a project row to the fixed status labels used in the top filter. */
function canonicalStatusForFilter(row: Record<string, unknown>): string {
  const raw = row.new_projectstatus;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(n) && (n as number) in New_projectsnew_projectstatus) {
    const key = n as keyof typeof New_projectsnew_projectstatus;
    const v = New_projectsnew_projectstatus[key];
    if (v === 'ToStart') return 'To Start';
    if (v === 'OnTrack') return 'On Track';
    if (v === 'Delayed') return 'Delayed';
    if (v === 'Completed') return 'Completed';
  }
  const name = String(row.new_projectstatusname ?? '').trim();
  if (!name) return 'To Start';
  const low = name.toLowerCase();
  if (low.includes('complet')) return 'Completed';
  if (low.includes('delay')) return 'Delayed';
  if (low.includes('on') && low.includes('track')) return 'On Track';
  if (low.includes('to start') || (low.includes('start') && !low.includes('track'))) return 'To Start';
  return 'To Start';
}

/** Maps a project row to the fixed type labels: New, Enhancement. */
function canonicalTypeForFilter(row: Record<string, unknown>): string {
  const raw = row.new_projecttype;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(n) && (n as number) in New_projectsnew_projecttype) {
    const key = n as keyof typeof New_projectsnew_projecttype;
    const v = New_projectsnew_projecttype[key];
    if (v === 'New') return 'New';
    if (v === 'Enhancement') return 'Enhancement';
    if (v === 'ChangeRequest') return 'New';
  }
  const name = String(row.new_projecttypename ?? '').trim();
  if (!name) return 'New';
  const low = name.toLowerCase();
  if (low.includes('enhance')) return 'Enhancement';
  if (low.includes('change') || low.includes('new')) return 'New';
  if (name === 'New' || name === 'Enhancement') return name;
  return 'New';
}

export type ProgramReportsPanelProps = {
  isActive: boolean;
  onNotify: (type: ToastType, message: string) => void;
  /** When false, the reports table has no row Edit action (e.g. Business role). */
  showTableEdit?: boolean;
};

export function ProgramReportsPanel({ isActive, onNotify, showTableEdit = true }: ProgramReportsPanelProps) {
  const [showAddReportForm, setShowAddReportForm] = useState(false);
  const [showEditReportModal, setShowEditReportModal] = useState(false);
  const [reportEditBusy, setReportEditBusy] = useState(false);
  const [reportEditError, setReportEditError] = useState('');
  const [editingReportId, setEditingReportId] = useState('');
  const [reportTypeMasterOptions, setReportTypeMasterOptions] = useState<string[]>([]);
  const [reportAssigneeEmailOptions, setReportAssigneeEmailOptions] = useState<string[]>([]);
  const [reportEditAttachment, setReportEditAttachment] = useState<File | null>(null);
  const [reportEditForm, setReportEditForm] = useState({
    programName: '',
    reportTitle: '',
    projectName: '',
    reportType: '',
    sector: '',
    assigneeEmail: '',
    summary: '',
    remark: '',
    programStatus: '',
  });
  const [reportProjectsRows, setReportProjectsRows] = useState<Array<Record<string, unknown>>>([]);
  const [reportEntityRows, setReportEntityRows] = useState<Array<Record<string, unknown>>>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportSectorFilter, setReportSectorFilter] = useState('All');
  const [reportProgramFilter, setReportProgramFilter] = useState('All');
  const [reportProjectFilter, setReportProjectFilter] = useState('All');
  const [reportTypeFilter, setReportTypeFilter] = useState('All');
  const [reportPmFilter, setReportPmFilter] = useState('All');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [reportDurationFilter, setReportDurationFilter] = useState('All Dates');
  const [showReportViewAll, setShowReportViewAll] = useState(false);
  const [reportViewAllPage, setReportViewAllPage] = useState(1);
  const REPORT_VIEW_ALL_PAGE_SIZE = 6;
  const [allProgramNames, setAllProgramNames] = useState<string[]>([]);
  const [programIdToName, setProgramIdToName] = useState<Map<string, string>>(() => new Map());

  const loadReportData = useCallback(async () => {
    setReportsLoading(true);
    try {
      const [projectsRes, programsListRes, reportsRes, usersRes, reportTypeRes] = await Promise.all([
        New_projectsService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        New_programsService.getAll({ top: 500, orderBy: ['new_name asc'] }),
        New_reportsService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        NewUsersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        EnjazMasterDataService.getActiveReportTypeMasterRows(),
      ]);
      if (programsListRes.success) {
        const programRows: New_programs[] = programsListRes.data ?? [];
        const rowNames = programRows.map((p) => p.new_name.trim()).filter(Boolean);
        setAllProgramNames(
          Array.from(new Set(rowNames)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        );
        setProgramIdToName(buildProgramIdToNameMap(programRows as unknown as Array<Record<string, unknown>>));
      } else {
        setAllProgramNames([]);
        setProgramIdToName(new Map());
      }
      setReportProjectsRows(projectsRes.success ? ((projectsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
      setReportEntityRows(reportsRes.success ? ((reportsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
      if (usersRes.success) {
        const userRows = (usersRes.data ?? []) as Array<Record<string, unknown>>;
        const fromBusiness = userRows
          .filter(isUserBusinessRoleRow)
          .map(userEmailForReportAssignee)
          .filter(Boolean);
        const fromNewColumn = userRows
          .map((u) => String(u.new_newcolumn ?? '').trim())
          .filter((v) => v.includes('@'));
        setReportAssigneeEmailOptions(
          Array.from(new Set([...fromBusiness, ...fromNewColumn])).sort((a, b) => a.localeCompare(b)),
        );
      } else {
        setReportAssigneeEmailOptions([]);
      }
      setReportTypeMasterOptions(
        reportTypeRes.success
          ? Array.from(
              new Set(
                (reportTypeRes.data ?? [])
                  .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
                  .filter(Boolean),
              ),
            ).sort((a, b) => a.localeCompare(b))
          : [],
      );
    } catch {
      setAllProgramNames([]);
      setProgramIdToName(new Map());
      setReportProjectsRows([]);
      setReportEntityRows([]);
      setReportAssigneeEmailOptions([]);
      setReportTypeMasterOptions([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      setShowAddReportForm(false);
      setShowEditReportModal(false);
      return;
    }
    void loadReportData();
  }, [isActive, loadReportData]);

  const reportFilterOptions = useMemo(() => {
    try {
      const uniq = (vals: string[]) =>
        ['All', ...Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
      const fromProjects = uniq(reportProjectsRows.map((r) => resolveProjectProgramName(r, programIdToName)).filter((s) => s && s !== 'Unassigned'));
      const programs = allProgramNames.length > 0 ? (['All', ...allProgramNames] as string[]) : fromProjects;
      return {
        sectors: uniq(reportProjectsRows.map((r) => String(r.new_sectorname ?? r.new_sector ?? '').trim())),
        programs,
        projects: uniq(reportProjectsRows.map((r) => String(r.new_projectname ?? r.new_name ?? '').trim())),
        types: [...FILTER_TYPE_OPTIONS],
        pms: uniq(reportProjectsRows.map((r) => getProjectManagerDisplayFromProjectRow(r)).filter((s) => s.length > 0)),
        statuses: [...FILTER_STATUS_OPTIONS],
      };
    } catch {
      return {
        sectors: ['All'],
        programs: ['All'],
        projects: ['All'],
        types: [...FILTER_TYPE_OPTIONS],
        pms: ['All'],
        statuses: [...FILTER_STATUS_OPTIONS],
      };
    }
  }, [reportProjectsRows, allProgramNames, programIdToName]);

  const filteredReportProjects = useMemo(() => {
    try {
      const inDuration = (row: Record<string, unknown>) => {
        if (reportDurationFilter === 'All Dates') return true;
        const dt = new Date(String(row.new_startdate ?? row.createdon ?? ''));
        if (Number.isNaN(dt.getTime())) return false;
        const now = new Date();
        if (reportDurationFilter === 'This Month') {
          return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
        }
        if (reportDurationFilter === 'This Quarter') {
          const q0 = Math.floor(now.getMonth() / 3) * 3;
          return dt.getFullYear() === now.getFullYear() && dt.getMonth() >= q0 && dt.getMonth() <= q0 + 2;
        }
        return dt.getFullYear() === now.getFullYear();
      };
      return reportProjectsRows.filter((r) => {
        const sector = String(r.new_sectorname ?? r.new_sector ?? '').trim();
        const program = resolveProjectProgramName(r, programIdToName);
        const project = String(r.new_projectname ?? r.new_name ?? '').trim();
        const type = canonicalTypeForFilter(r);
        const pm = getProjectManagerDisplayFromProjectRow(r);
        const status = canonicalStatusForFilter(r);
        if (reportSectorFilter !== 'All' && sector !== reportSectorFilter) return false;
        if (reportProgramFilter !== 'All' && program !== reportProgramFilter) return false;
        if (reportProjectFilter !== 'All' && project !== reportProjectFilter) return false;
        if (reportTypeFilter !== 'All' && type !== reportTypeFilter) return false;
        if (reportPmFilter !== 'All' && pm !== reportPmFilter) return false;
        if (reportStatusFilter !== 'All' && status !== reportStatusFilter) return false;
        return inDuration(r);
      });
    } catch {
      return [];
    }
  }, [
    reportProjectsRows,
    reportSectorFilter,
    reportProgramFilter,
    reportProjectFilter,
    reportTypeFilter,
    reportPmFilter,
    reportStatusFilter,
    reportDurationFilter,
    programIdToName,
  ]);

  const reportDashboardStats = useMemo(() => {
    try {
      const projects = filteredReportProjects;
      const sectors = new Set(projects.map((p) => String(p.new_sectorname ?? p.new_sector ?? '').trim()).filter(Boolean)).size;
      const programs = new Set(projects.map((p) => resolveProjectProgramName(p, programIdToName)).filter((s) => s && s !== 'Unassigned')).size;
      const delayed = projects.filter((p) => String(p.new_projectstatusname ?? '').toLowerCase().includes('delay')).length;
      const completed = projects.filter((p) => String(p.new_projectstatusname ?? '').toLowerCase().includes('complet')).length;
      /** `new_status` 100000002 = OnHold in Dataverse option set. */
      const onHold = projects.filter((p) => {
        const n = Number(p.new_status ?? NaN);
        if (n === 100000002) return true;
        const name = String(p.new_statusname ?? '')
          .toLowerCase()
          .replace(/[\s-]+/g, ' ');
        return name.includes('on hold') || name.replace(/\s/g, '') === 'onhold';
      }).length;
      const categoryCounts = new Map<string, number>();
      const typeCounts = new Map<string, number>();
      const budgetBySector = new Map<string, number>();
      const progressBuckets = new Map<string, number>();
      const progressLabel = (p: Record<string, unknown>) => canonicalStatusForFilter(p);
      projects.forEach((p) => {
        const cat = String(p.new_projectcategoryname ?? p.new_projectcategory ?? 'Other').trim() || 'Other';
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        const typ = canonicalTypeForFilter(p);
        typeCounts.set(typ, (typeCounts.get(typ) ?? 0) + 1);
        const sec = String(p.new_sectorname ?? p.new_sector ?? 'Other').trim() || 'Other';
        const budget = Number(p.new_budget ?? 0);
        if (Number.isFinite(budget) && budget > 0) budgetBySector.set(sec, (budgetBySector.get(sec) ?? 0) + budget);
        const status = progressLabel(p);
        progressBuckets.set(status, (progressBuckets.get(status) ?? 0) + 1);
      });
      const colors = ['#d65257', '#f6be00', '#3b3a80', '#60a5fa', '#34d399'];
      const toSlices = (src: Map<string, number>) => {
        const arr = Array.from(src.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        return arr.length > 0
          ? arr.map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
          : [{ label: 'No Data', value: 1, color: '#cbd5e1' }];
      };
      const totalBudget = Array.from(budgetBySector.values()).reduce((a, b) => a + b, 0);
      return {
        cards: [
          { label: 'Sectors', value: sectors, color: '#b28a44' },
          { label: 'Programs', value: programs, color: '#d65257' },
          { label: 'Projects', value: projects.length, color: '#3b82f6' },
          { label: 'Completed Projects', value: completed, color: '#7c2d12' },
          { label: 'On Hold', value: onHold, color: '#e5a008' },
          { label: 'Delayed Projects', value: delayed, color: '#0d9488' },
        ],
        categorySlices: toSlices(categoryCounts),
        typeBars: Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5) as Array<[string, number]>,
        budgetSlices: toSlices(budgetBySector),
        progressSlices: toSlices(progressBuckets),
        filterMeta: {
          projectCount: projects.length,
          hasBudgetData: budgetBySector.size > 0,
          totalBudget,
        },
      };
    } catch {
      return {
        cards: [
          { label: 'Sectors', value: 0, color: '#b28a44' },
          { label: 'Programs', value: 0, color: '#d65257' },
          { label: 'Projects', value: 0, color: '#3b82f6' },
          { label: 'Completed Projects', value: 0, color: '#7c2d12' },
          { label: 'On Hold', value: 0, color: '#e5a008' },
          { label: 'Delayed Projects', value: 0, color: '#0d9488' },
        ],
        categorySlices: [{ label: 'No Data', value: 1, color: '#cbd5e1' }],
        typeBars: [] as Array<[string, number]>,
        budgetSlices: [{ label: 'No Data', value: 1, color: '#cbd5e1' }],
        progressSlices: [{ label: 'No Data', value: 1, color: '#cbd5e1' }],
        filterMeta: {
          projectCount: 0,
          hasBudgetData: false,
          totalBudget: 0,
        },
      };
    }
  }, [filteredReportProjects, programIdToName]);

  const safeDateLabel = (raw: string) => {
    try {
      const s = String(raw ?? '').trim();
      if (!s) return '—';
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const reportProjectMap = useMemo(() => {
    try {
      const m = new Map<string, Record<string, unknown>>();
      filteredReportProjects.forEach((p) => m.set(String(p.new_projectname ?? p.new_name ?? '').trim().toLowerCase(), p));
      return m;
    } catch {
      return new Map<string, Record<string, unknown>>();
    }
  }, [filteredReportProjects]);

  const filteredReportTableRows = useMemo(() => {
    try {
      const rows = reportEntityRows.map((r) => {
        const projectName = String(r.new_projectname ?? '').trim();
        const project = reportProjectMap.get(projectName.toLowerCase()) ?? null;
        const status = String(project?.new_projectstatusname ?? 'To Start');
        return {
          id: String(r.new_reportid ?? ''),
          programName: String(
            r.new_program ?? (project ? resolveProjectProgramName(project, programIdToName) : '') ?? '',
          ),
          reportTitle: String(r.new_report1 ?? 'Report'),
          projectName: projectName || String(project?.new_projectname ?? project?.new_name ?? '—'),
          reportType: String(r.new_reporttype ?? '—'),
          sector: String(r.new_sector ?? project?.new_sectorname ?? project?.new_sector ?? '—'),
          assigneeEmail: String(r.new_assigntomanagementmember ?? ''),
          summary: String(r.new_summary ?? ''),
          remark: String(r.new_remark ?? ''),
          programStatus: String(r.new_programstatus ?? ''),
          start: String(project?.new_startdate ?? ''),
          end: String(project?.new_enddate ?? ''),
          progress: Number(project?.new_progress ?? 0),
          status,
        };
      });
      return rows.filter((r) => reportProjectFilter === 'All' || r.projectName === reportProjectFilter);
    } catch {
      return [];
    }
  }, [reportEntityRows, reportProjectMap, reportProjectFilter, programIdToName]);

  const openEditReport = (row: {
    id: string;
    programName: string;
    reportTitle: string;
    projectName: string;
    reportType: string;
    sector: string;
    assigneeEmail: string;
    summary: string;
    remark: string;
    programStatus: string;
  }) => {
    setEditingReportId(row.id);
    setReportEditForm({
      programName: row.programName,
      reportTitle: row.reportTitle,
      projectName: row.projectName,
      reportType: row.reportType,
      sector: row.sector,
      assigneeEmail: row.assigneeEmail,
      summary: row.summary,
      remark: row.remark,
      programStatus: row.programStatus,
    });
    setReportEditAttachment(null);
    setReportEditError('');
    setShowEditReportModal(true);
  };

  const saveEditedReport = async () => {
    const programName = reportEditForm.programName.trim();
    const title = reportEditForm.reportTitle.trim();
    const projectName = reportEditForm.projectName.trim();
    if (!editingReportId) {
      setReportEditError('Report ID is missing.');
      return;
    }
    if (!title) {
      setReportEditError('Report Title is required.');
      return;
    }
    if (!programName) {
      setReportEditError('Program Name is required.');
      return;
    }
    if (!projectName) {
      setReportEditError('Project Name is required.');
      return;
    }
    if (!reportEditForm.sector.trim()) {
      setReportEditError('Sector is required.');
      return;
    }
    if (!reportEditForm.reportType.trim()) {
      setReportEditError('Report Type is required.');
      return;
    }
    if (!reportEditForm.assigneeEmail.trim()) {
      setReportEditError('Assigned Team Member email is required.');
      return;
    }
    if (!reportEditForm.programStatus.trim()) {
      setReportEditError('Program Status is required.');
      return;
    }
    if (!reportEditForm.summary.trim()) {
      setReportEditError('Summary is required.');
      return;
    }
    if (!reportEditForm.remark.trim()) {
      setReportEditError('Remark is required.');
      return;
    }
    setReportEditBusy(true);
    setReportEditError('');
    try {
      const res = await New_reportsService.update(editingReportId, {
        new_program: programName,
        new_report1: title,
        new_projectname: projectName,
        new_reporttype: reportEditForm.reportType.trim() || undefined,
        new_sector: reportEditForm.sector.trim() || undefined,
        new_assigntomanagementmember: reportEditForm.assigneeEmail.trim() || undefined,
        new_summary: reportEditForm.summary.trim() || undefined,
        new_remark: reportEditForm.remark.trim() || undefined,
        new_programstatus: reportEditForm.programStatus.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update report');
      onNotify('success', 'Report updated successfully.');
      setShowEditReportModal(false);
      const refreshRes = await New_reportsService.getAll({ top: 2000, orderBy: ['createdon desc'] });
      setReportEntityRows(refreshRes.success ? ((refreshRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
    } catch (error) {
      setReportEditError(error instanceof Error ? error.message : 'Failed to update report');
    } finally {
      setReportEditBusy(false);
    }
  };

  const reportStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('complet')) return 'enj-table-status enj-table-status--completed';
    if (s.includes('delay')) return 'enj-table-status enj-table-status--delayed';
    if (s.includes('track') || s.includes('on track')) return 'enj-table-status enj-table-status--ontrack';
    return 'enj-table-status enj-table-status--neutral';
  };

  const reportEditProgramOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...reportProjectsRows.map((r) => resolveProjectProgramName(r, programIdToName)),
            ...reportEntityRows.map((r) => String(r.new_program ?? '').trim()),
            reportEditForm.programName,
          ].filter((s) => Boolean(s) && s !== 'Unassigned'),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reportProjectsRows, reportEntityRows, reportEditForm.programName, programIdToName],
  );
  const reportEditProjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...reportProjectsRows.map((r) => String(r.new_projectname ?? r.new_name ?? '').trim()),
            ...reportEntityRows.map((r) => String(r.new_projectname ?? '').trim()),
            reportEditForm.projectName,
          ].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reportProjectsRows, reportEntityRows, reportEditForm.projectName],
  );
  const reportEditProgramStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...reportProjectsRows.map((r) => String(r.new_projectstatusname ?? '').trim()),
            ...reportEntityRows.map((r) => String(r.new_programstatus ?? '').trim()),
            reportEditForm.programStatus,
          ].filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reportProjectsRows, reportEntityRows, reportEditForm.programStatus],
  );

  const handleCloseAdd = () => {
    setShowAddReportForm(false);
    void loadReportData();
  };

  if (!isActive) return null;

  if (showAddReportForm) {
    return <AddReportFormPanel onClose={handleCloseAdd} onNotify={onNotify} />;
  }

  const reportViewAllTotalPages = Math.max(1, Math.ceil(filteredReportTableRows.length / REPORT_VIEW_ALL_PAGE_SIZE));
  const pagedReportViewAllRows = filteredReportTableRows.slice(
    (reportViewAllPage - 1) * REPORT_VIEW_ALL_PAGE_SIZE,
    reportViewAllPage * REPORT_VIEW_ALL_PAGE_SIZE,
  );

  const reportTableRow = (row: (typeof filteredReportTableRows)[0], idx: number) => (
    <tr key={`${row.reportTitle}-${idx}`} className="text-sm text-[#374151]">
      <td className={`px-3 py-2 ${enj.tableLink}`}>{row.reportTitle}</td>
      <td className="px-3 py-2">{row.projectName}</td>
      <td className="px-3 py-2">{row.reportType}</td>
      <td className="px-3 py-2">{row.sector}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-normal text-[#6B7280]">Start Date</p>
            <p className="flex items-center gap-1 text-[10px]">
              <Calendar size={12} className="text-[#9CA3AF]" />
              <span className="font-medium text-[#111827]">{safeDateLabel(row.start)}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-[#E5E7EB]" />
          <div>
            <p className="text-[10px] font-normal text-[#6B7280]">End Date</p>
            <p className="flex items-center gap-1 text-[10px]">
              <Calendar size={12} className="text-[#9CA3AF]" />
              <span className="font-medium text-[#111827]">{safeDateLabel(row.end)}</span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="w-[150px]">
          <p className="mb-1 text-right text-[11px] text-[#6B7280]">{row.progress}%</p>
          <div className="enj-table-progress-track w-full max-w-[150px]">
            <div className="enj-table-progress-fill" style={{ width: `${row.progress}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-block min-w-[90px] text-center text-[11px] ${reportStatusBadge(String(row.status))}`}>
          {row.status}
        </span>
      </td>
      {showTableEdit && (
        <td className="sticky right-0 z-10 w-[1%] min-w-[3rem] whitespace-nowrap border-l border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-[#A08149] hover:text-[#A08149] transition-colors"
            onClick={() => openEditReport(row)}
            title="Edit"
          >
            <Pencil size={14} className="shrink-0" />
          </button>
        </td>
      )}
    </tr>
  );

  const reportTableHead = (
    <thead>
      <tr>
        <th>Report Title</th>
        <th>Project Name</th>
        <th>Report Type</th>
        <th>Sector</th>
        <th>Schedule</th>
        <th>Progress Level</th>
        <th>Status</th>
        {showTableEdit && (
          <th className="sticky right-0 z-20 w-[1%] min-w-[3rem] whitespace-nowrap border-l border-[#E5E7EB] bg-[rgba(225,227,236,1)] px-3 py-2 text-left shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)]" />
        )}
      </tr>
    </thead>
  );

  const editReportModal = showTableEdit && showEditReportModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className={enj.sectionTitle}>Edit Report</h3>
          <button type="button" onClick={() => setShowEditReportModal(false)} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
        </div>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-3">
          <label>
            <span className="text-[11px] text-gray-500">Program Name *</span>
            <select className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={reportEditForm.programName} onChange={(e) => setReportEditForm((f) => ({ ...f, programName: e.target.value }))}>
              <option value="">Select Program</option>
              {reportEditProgramOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Report Title *</span>
            <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={reportEditForm.reportTitle} onChange={(e) => setReportEditForm((f) => ({ ...f, reportTitle: e.target.value }))} />
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Project Name *</span>
            <select className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={reportEditForm.projectName} onChange={(e) => setReportEditForm((f) => ({ ...f, projectName: e.target.value }))}>
              <option value="">Select Project</option>
              {reportEditProjectOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Sector *</span>
            <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={reportEditForm.sector} onChange={(e) => setReportEditForm((f) => ({ ...f, sector: e.target.value }))} />
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Report Type *</span>
            <select className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={reportEditForm.reportType} onChange={(e) => setReportEditForm((f) => ({ ...f, reportType: e.target.value }))}>
              <option value="">Select Report Type</option>
              {Array.from(new Set([...reportTypeMasterOptions, reportEditForm.reportType].filter(Boolean))).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Program Status *</span>
            <select className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={reportEditForm.programStatus} onChange={(e) => setReportEditForm((f) => ({ ...f, programStatus: e.target.value }))}>
              <option value="">Select Program Status</option>
              {reportEditProgramStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[11px] text-gray-500">Assign to Manager/Member *</span>
            <select className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm" value={reportEditForm.assigneeEmail} onChange={(e) => setReportEditForm((f) => ({ ...f, assigneeEmail: e.target.value }))}>
              <option value="">Select Team Member Email</option>
              {Array.from(new Set([...reportAssigneeEmailOptions, reportEditForm.assigneeEmail].filter(Boolean))).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label className="md:col-span-1">
            <span className="text-[11px] text-gray-500">Summary *</span>
            <textarea className="mt-1 h-20 w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm" value={reportEditForm.summary} onChange={(e) => setReportEditForm((f) => ({ ...f, summary: e.target.value }))} />
          </label>
          <label className="md:col-span-1">
            <span className="text-[11px] text-gray-500">Remark *</span>
            <textarea className="mt-1 h-20 w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm" value={reportEditForm.remark} onChange={(e) => setReportEditForm((f) => ({ ...f, remark: e.target.value }))} />
          </label>
          <label className="md:col-span-1">
            <span className="text-[11px] text-gray-500">Attachments</span>
            <div className="mt-1 rounded-md border border-gray-200 p-2">
              {reportEditAttachment ? (
                <div className="flex items-center justify-between text-xs text-gray-700">
                  <span className="truncate">{reportEditAttachment.name}</span>
                  <button type="button" className="ml-2 text-gray-500 hover:text-gray-700" onClick={() => setReportEditAttachment(null)}>✕</button>
                </div>
              ) : <p className="mb-1 text-xs text-gray-400">Attach file</p>}
              <input type="file" className="mt-1 w-full text-xs text-gray-600" onChange={(e) => setReportEditAttachment(e.target.files?.[0] ?? null)} />
            </div>
          </label>
        </div>
        {reportEditError && <p className="px-5 pb-2 text-xs text-rose-600">{reportEditError}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={() => setShowEditReportModal(false)} className={enj.btnOutline} disabled={reportEditBusy}>Cancel</button>
          <button type="button" onClick={() => void saveEditedReport()} className={enj.btnPrimary} disabled={reportEditBusy}>{reportEditBusy ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  ) : null;

  if (showReportViewAll) {
    return (
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => { setShowReportViewAll(false); setReportViewAllPage(1); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-base font-bold text-[rgba(35,35,96,1)] truncate">Project Reports – All Records</h1>
        </div>
        <div className="overflow-x-auto">
          <table className={`${enj.table} min-w-[920px] w-full`}>
            {reportTableHead}
            <tbody>
              {pagedReportViewAllRows.length === 0 ? (
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <td className="px-3 py-3" colSpan={showTableEdit ? 8 : 7}>
                    No report rows for selected filters.
                  </td>
                </tr>
              ) : (
                pagedReportViewAllRows.map((row, idx) => reportTableRow(row, idx))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-5 py-3">
          <PagerBar
            page={reportViewAllPage}
            pageSize={REPORT_VIEW_ALL_PAGE_SIZE}
            total={filteredReportTableRows.length}
            onPrev={() => setReportViewAllPage((p) => Math.max(1, p - 1))}
            onNext={() => setReportViewAllPage((p) => Math.min(reportViewAllTotalPages, p + 1))}
          />
        </div>
        {editReportModal}
      </div>
    );
  }

  return (
    <>
      <section className="flex items-center justify-between">
        <h2 className={enj.pageTitle}>Reports</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-gray-200 bg-white px-4 text-xs text-gray-600"
            onClick={() => {
              setReportSectorFilter('All');
              setReportProgramFilter('All');
              setReportProjectFilter('All');
              setReportTypeFilter('All');
              setReportPmFilter('All');
              setReportStatusFilter('All');
              setReportDurationFilter('All Dates');
              void loadReportData();
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            className={`${enj.btnPrimary} !h-8`}
            onClick={() => setShowAddReportForm(true)}
          >
            Create a Report
          </button>
        </div>
      </section>
      <section className="rounded-xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Sector</p>
            <select
              value={reportSectorFilter}
              onChange={(e) => setReportSectorFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.sectors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Program</p>
            <select
              value={reportProgramFilter}
              onChange={(e) => setReportProgramFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.programs.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Project</p>
            <select
              value={reportProjectFilter}
              onChange={(e) => setReportProjectFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.projects.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Type</p>
            <select
              value={reportTypeFilter}
              onChange={(e) => setReportTypeFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.types.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Program Manager</p>
            <select
              value={reportPmFilter}
              onChange={(e) => setReportPmFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.pms.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Status</p>
            <select
              value={reportStatusFilter}
              onChange={(e) => setReportStatusFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              {reportFilterOptions.statuses.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-gray-400">Duration</p>
            <select
              value={reportDurationFilter}
              onChange={(e) => setReportDurationFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-600"
            >
              <option>All Dates</option>
              <option>This Month</option>
              <option>This Quarter</option>
              <option>This Year</option>
            </select>
          </div>
        </div>
      </section>
      <section className="flex flex-wrap gap-3">
        {reportDashboardStats.cards.map((card) => (
          <div
            key={card.label}
            className="min-w-[140px] flex-1 rounded-xl border bg-white p-4 text-center shadow-sm"
            style={{ borderColor: card.color, borderWidth: 1, borderStyle: 'solid' }}
          >
            <p className="text-sm font-medium text-gray-900">{card.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="chart-card flex min-h-[280px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">Project category</h3>
          <div className="mt-2 flex min-h-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-start">
            <div className="mx-auto flex shrink-0 justify-center">
              <DonutChart
                className="chart-svg h-48 w-48"
                showOuterLabels={false}
                ringWidth={40}
                slices={reportDashboardStats.categorySlices}
                centerText={String(reportDashboardStats.filterMeta.projectCount)}
                centerSubtext={reportDashboardStats.filterMeta.projectCount === 1 ? 'project' : 'projects'}
                labelColor="#64748b"
              />
            </div>
            <ul className="w-full min-w-0 space-y-1.5 sm:max-h-44 sm:overflow-y-auto sm:pt-0.5">
              {reportDashboardStats.filterMeta.projectCount === 0 ? (
                <li className="rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[10px] text-amber-900">
                  No projects match the filters — set filters to <span className="font-semibold">All</span> or adjust
                  duration to see category split.
                </li>
              ) : (
                reportDashboardStats.categorySlices
                  .filter((s) => s.label !== 'No Data')
                  .map((slice) => (
                    <li
                      key={slice.label}
                      className="flex items-center justify-between gap-2 text-[10px] text-gray-600"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden
                        />
                        <span className="truncate text-gray-700">{slice.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-gray-800">
                        {formatListNumber(slice.value)}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </div>
        </div>
        <div className="chart-card flex min-h-[280px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">Project type</h3>
          <div className="mt-1 min-w-0 flex-1">
            <svg viewBox="0 0 240 188" className="chart-svg h-44 w-full" role="img" aria-label="Project type counts">
              {(() => {
                const bars: Array<[string, number]> =
                  reportDashboardStats.typeBars.length > 0
                    ? reportDashboardStats.typeBars
                    : [['No data', 0]];
                const isEmpty =
                  reportDashboardStats.filterMeta.projectCount === 0 || reportDashboardStats.typeBars.length === 0;
                const max = isEmpty ? 1 : Math.max(1, ...bars.map(([, v]) => v));
                const total = bars.filter(([n]) => n !== 'No data').reduce((s, [, v]) => s + v, 0) || 0;
                const y0 = 148;
                const hMax = 100;
                const x0 = 40;
                const barW = 14;
                const gap = 22;
                const tickVals = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));
                return (
                  <>
                    {tickVals.map((tv, i) => (
                      <g key={`g-${i}`}>
                        <line
                          x1={x0}
                          x2={220}
                          y1={y0 - (i / 4) * hMax}
                          y2={y0 - (i / 4) * hMax}
                          stroke="#f1f5f9"
                        />
                        <text x="28" y={4 + y0 - (i / 4) * hMax} fontSize="7" textAnchor="end" fill="#94a3b8">
                          {tv}
                        </text>
                      </g>
                    ))}
                    {bars.map(([name, v], i) => {
                      const nh = isEmpty || name === 'No data' ? 0 : (v / max) * hMax;
                      const bx = x0 + 8 + i * (barW + gap);
                      const pct = !isEmpty && total > 0 && name !== 'No data' ? Math.round((v / total) * 100) : 0;
                      return (
                        <g key={`${name}-${i}`}>
                          <rect
                            x={bx}
                            y={y0 - nh}
                            width={barW}
                            height={Math.max(0, nh)}
                            rx="3"
                            className="chart-bar"
                            fill={['#59628a', '#d4a759', '#b28a44', '#60a5fa', '#d65257'][i % 5]}
                          >
                            <title>
                              {isEmpty || name === 'No data' ? 'No data' : `${name}: ${v} (${pct}% of bar total)`}
                            </title>
                          </rect>
                          {nh > 0 && (
                            <text
                              x={bx + barW / 2}
                              y={y0 - nh - 4}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="600"
                              fill="#334155"
                            >
                              {v}
                            </text>
                          )}
                          <text
                            x={bx + barW / 2}
                            y="178"
                            textAnchor="middle"
                            fontSize="7.5"
                            fill="#64748b"
                            transform={`rotate(-42 ${bx + barW / 2} 178)`}
                          >
                            {name.length > 11 ? `${name.slice(0, 10)}…` : name}
                          </text>
                        </g>
                      );
                    })}
                    <text x="120" y="14" textAnchor="middle" fontSize="8" fill="#94a3b8">
                      Count (max {formatListNumber(max)})
                    </text>
                  </>
                );
              })()}
            </svg>
            <ul className="mt-1 space-y-1 border-t border-gray-100 pt-2">
              {reportDashboardStats.filterMeta.projectCount === 0 || reportDashboardStats.typeBars.length === 0 ? (
                <li className="text-[10px] text-amber-800/90">
                  No projects in view — relax filters to see how types are distributed.
                </li>
              ) : (
                reportDashboardStats.typeBars.map(([name, v], i) => {
                  const tot = reportDashboardStats.typeBars.reduce((s, [, c]) => s + c, 0);
                  const pct = tot > 0 ? Math.round((v / tot) * 100) : 0;
                  return (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-2 text-[10px] text-gray-600"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: ['#59628a', '#d4a759', '#b28a44', '#60a5fa', '#d65257'][i % 5] }}
                          aria-hidden
                        />
                        <span className="truncate text-gray-700">{name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-gray-800">
                        {formatListNumber(v)} <span className="font-normal text-gray-500">({pct}% of total)</span>
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
        <div className="chart-card flex min-h-[320px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">Budget by sector</h3>
          <div className="mt-2 flex min-h-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-start">
            <div className="mx-auto flex shrink-0 justify-center">
              <DonutChart
                className="chart-svg h-48 w-48"
                showOuterLabels={false}
                ringWidth={42}
                slices={reportDashboardStats.budgetSlices}
                centerText={
                  reportDashboardStats.filterMeta.totalBudget > 0
                    ? formatListNumber(reportDashboardStats.filterMeta.totalBudget)
                    : '—'
                }
                centerSubtext="total (sum)"
                labelColor="#64748b"
              />
            </div>
            <ul className="w-full min-w-0 space-y-1.5 sm:max-h-56 sm:overflow-y-auto sm:pt-0.5">
              {reportDashboardStats.filterMeta.projectCount === 0 ? (
                <li className="rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[10px] text-amber-900">
                  No projects in filter — there is no budget to aggregate.
                </li>
              ) : !reportDashboardStats.filterMeta.hasBudgetData ? (
                <li className="text-[10px] text-gray-500">
                  No budget data on the filtered projects, or sector is missing.
                </li>
              ) : (
                reportDashboardStats.budgetSlices
                  .filter((s) => s.label !== 'No Data')
                  .map((slice) => (
                    <li
                      key={slice.label}
                      className="flex items-center gap-1.5 text-[10px] text-gray-600"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: slice.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-gray-700">
                        <span className="font-medium">{slice.label}</span>
                        <span className="text-gray-600"> — </span>
                        <span className="font-semibold text-gray-800">{formatListNumber(slice.value)}</span>
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </div>
        </div>
        <div className="chart-card flex min-h-[260px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">Projects by progress</h3>
          <div className="mt-1 flex items-center justify-center">
            <DonutChart
              className="chart-svg h-48 w-48"
              showOuterLabels
              ringWidth={42}
              slices={reportDashboardStats.progressSlices}
              labelColor="#64748b"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-600">
            {reportDashboardStats.progressSlices.map((slice) => (
              <span key={slice.label} className="inline-flex max-w-full items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="min-w-0">
                  <span className="font-medium text-gray-700">{slice.label}</span>
                  <span className="text-gray-500"> — {formatListNumber(slice.value)} projects</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className={enj.pageTitle}>Project Reports</h3>
          {filteredReportTableRows.length > 0 && (
            <button
              type="button"
              onClick={() => { setShowReportViewAll(true); setReportViewAllPage(1); }}
              className="bg-transparent p-0 text-xs font-semibold text-[#A08149] hover:underline"
            >
              View All
            </button>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className={`${enj.table} min-w-[920px]`}>
            {reportTableHead}
            <tbody>
              {reportsLoading && (
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <td className="px-3 py-3" colSpan={showTableEdit ? 8 : 7}>Loading reports...</td>
                </tr>
              )}
              {!reportsLoading && filteredReportTableRows.length === 0 && (
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <td className="px-3 py-3" colSpan={showTableEdit ? 8 : 7}>No report rows for selected filters.</td>
                </tr>
              )}
              {!reportsLoading && filteredReportTableRows.slice(0, 10).map((row, idx) => reportTableRow(row, idx))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-right text-[10px] text-gray-400">Showing {Math.min(10, filteredReportTableRows.length)} of {filteredReportTableRows.length} rows</div>
      </section>
      {editReportModal}
    </>
  );
}

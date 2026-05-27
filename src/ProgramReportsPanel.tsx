/**
 * Shared Reports workspace: same UI and Dataverse wiring as Program role.
 * @license Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Paperclip, Pencil, Trash2, Download } from 'lucide-react';
import { PagerBar } from './PagerBar';
import { enj } from './ui/enjForm';
import { TABLE_STYLES } from './tableStyles';
import { DonutChart } from './DonutChart';
import { New_projectsService } from './generated/services/New_projectsService';
import type { New_programs } from './generated/models/New_programsModel';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsnew_projectstatus, New_projectsnew_projecttype } from './generated/models/New_projectsModel';
import { New_reportsService } from './generated/services/New_reportsService';
import { EnjazMasterDataService } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import { uploadFilesForReport } from './services/reportFileUpload';
import { fetchAttachments, type AttachmentFile } from './services/attachmentService';
import type { ToastType } from './NotificationToast';
import { AddReportFormPanel } from './AddReportFormPanel';
import { FormFieldLabel, FormPageActions, FormPageShell } from './FormPageShell';
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

/** Fit axis/category labels in bar slot; append … when truncated. */
function truncateChartLabel(text: string, maxWidthPx: number, fontSize = 9): string {
  const avgCharPx = fontSize * 0.58;
  const maxChars = Math.max(3, Math.floor(maxWidthPx / avgCharPx));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function darkenHex(hex: string, factor = 0.82): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function ReportStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center rounded-lg border-2 bg-white px-2 py-3 text-center shadow-sm"
      style={{ borderColor: darkenHex(color) }}
    >
      <p className="text-[0.8rem] leading-tight text-gray-600">{label}</p>
      <p className="mt-1 text-[1.8rem] font-semibold leading-none tabular-nums text-gray-900">
        {formatListNumber(value)}
      </p>
    </div>
  );
}

const FILTER_STATUS_OPTIONS = ['All', 'To Start', 'On Track', 'Completed', 'Delayed'] as const;
const FILTER_TYPE_OPTIONS = ['All', 'Enhancement', 'New'] as const;

function getProgramManagerDisplayFromProjectRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(p.new_programmanagername ?? p.new_programmanager ?? '').trim();
}

function getProjectManagerOnlyDisplayFromProjectRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(p.new_projectmanagername ?? p.crcf8_projectmanagername ?? '').trim();
}

function getKpiDisplayFromProjectRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(p.new_kpiname ?? p.new_kpi ?? '').trim();
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
  const reportHeaderStyle: React.CSSProperties = {
    fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    fontSize: '12.81px',
    fontWeight: 600,
    lineHeight: '1',
    letterSpacing: '0px',
    color: '#768396',
    backgroundColor: '#E1E3EC',
    padding: '12px 10px',
    border: '0px',
    textAlign: 'left',
    verticalAlign: 'middle',
    height: '44px',
    display: 'table-cell'
  };

  const [showAddReportForm, setShowAddReportForm] = useState(false);
  const [showEditReportModal, setShowEditReportModal] = useState(false);
  const [reportEditBusy, setReportEditBusy] = useState(false);
  const [reportEditError, setReportEditError] = useState('');
  const [editingReportId, setEditingReportId] = useState('');
  const [reportEditAttachmentFiles, setReportEditAttachmentFiles] = useState<File[]>([]);
  const [reportEditExistingFiles, setReportEditExistingFiles] = useState<AttachmentFile[]>([]);
  const [reportEditExistingAttachmentId, setReportEditExistingAttachmentId] = useState<string>('');
  const reportEditFileInputRef = useRef<HTMLInputElement>(null);
  const [reportTypeMasterOptions, setReportTypeMasterOptions] = useState<string[]>([]);
  const [reportAssigneeEmailOptions, setReportAssigneeEmailOptions] = useState<string[]>([]);
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
  const [reportProjectMgrFilter, setReportProjectMgrFilter] = useState('All');
  const [reportKpiFilter, setReportKpiFilter] = useState('All');
  const [reportBudgetFilter, setReportBudgetFilter] = useState('All');
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
      const reportRows = reportsRes.success ? ((reportsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [];
      console.log('Loaded report rows:', reportRows);
      if (reportRows.length > 0) {
        console.log('First report row keys:', Object.keys(reportRows[0]));
        console.log('First report row:', reportRows[0]);
      }
      setReportEntityRows(reportRows);
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
        kpis: uniq(reportProjectsRows.map((r) => getKpiDisplayFromProjectRow(r)).filter((s) => s.length > 0)),
        budgets: ['All', 'Has Budget', 'No Budget'],
        programManagers: uniq(
          reportProjectsRows.map((r) => getProgramManagerDisplayFromProjectRow(r)).filter((s) => s.length > 0),
        ),
        projectManagers: uniq(
          reportProjectsRows.map((r) => getProjectManagerOnlyDisplayFromProjectRow(r)).filter((s) => s.length > 0),
        ),
        statuses: [...FILTER_STATUS_OPTIONS],
      };
    } catch {
      return {
        sectors: ['All'],
        programs: ['All'],
        projects: ['All'],
        types: [...FILTER_TYPE_OPTIONS],
        kpis: ['All'],
        budgets: ['All', 'Has Budget', 'No Budget'],
        programManagers: ['All'],
        projectManagers: ['All'],
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
        const programMgr = getProgramManagerDisplayFromProjectRow(r);
        const projectMgr = getProjectManagerOnlyDisplayFromProjectRow(r);
        const kpi = getKpiDisplayFromProjectRow(r);
        const budget = Number(r.new_budget ?? 0);
        const status = canonicalStatusForFilter(r);
        if (reportSectorFilter !== 'All' && sector !== reportSectorFilter) return false;
        if (reportProgramFilter !== 'All' && program !== reportProgramFilter) return false;
        if (reportProjectFilter !== 'All' && project !== reportProjectFilter) return false;
        if (reportKpiFilter !== 'All' && kpi !== reportKpiFilter) return false;
        if (reportTypeFilter !== 'All' && type !== reportTypeFilter) return false;
        if (reportBudgetFilter === 'Has Budget' && !(Number.isFinite(budget) && budget > 0)) return false;
        if (reportBudgetFilter === 'No Budget' && Number.isFinite(budget) && budget > 0) return false;
        if (reportPmFilter !== 'All' && programMgr !== reportPmFilter) return false;
        if (reportProjectMgrFilter !== 'All' && projectMgr !== reportProjectMgrFilter) return false;
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
    reportKpiFilter,
    reportBudgetFilter,
    reportPmFilter,
    reportProjectMgrFilter,
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
      const completedPrograms = new Set(
        projects
          .filter((p) => String(p.new_projectstatusname ?? '').toLowerCase().includes('complet'))
          .map((p) => resolveProjectProgramName(p, programIdToName))
          .filter((s) => s && s !== 'Unassigned'),
      ).size;
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
          { label: 'Sectors', value: sectors, color: '#22c55e' },
          { label: 'Delayed Projects', value: delayed, color: '#ef4444' },
          { label: 'Programs', value: programs, color: '#3b82f6' },
          { label: 'Projects', value: projects.length, color: '#eab308' },
          { label: 'On Hold', value: onHold, color: '#ef4444' },
          { label: 'Completed Programs', value: completedPrograms, color: '#3b82f6' },
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
          { label: 'Sectors', value: 0, color: '#22c55e' },
          { label: 'Delayed Projects', value: 0, color: '#ef4444' },
          { label: 'Programs', value: 0, color: '#3b82f6' },
          { label: 'Projects', value: 0, color: '#eab308' },
          { label: 'On Hold', value: 0, color: '#ef4444' },
          { label: 'Completed Programs', value: 0, color: '#3b82f6' },
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
      reportProjectsRows.forEach((p) => {
        const name = String(p.new_projectname ?? p.new_name ?? '').trim().toLowerCase();
        if (name) m.set(name, p);
      });
      return m;
    } catch {
      return new Map();
    }
  }, [reportProjectsRows]);

  const filteredReportTableRows = useMemo(() => {
    try {
      const rows = reportEntityRows.map((r) => {
        const projectName = String(r.new_projectname ?? '').trim();

        // Find project using the map
        let project = null;
        if (projectName) {
          project = reportProjectMap.get(projectName.toLowerCase()) ?? null;
        }

        // Get status using the same logic as canonicalStatusForFilter
        let status = 'To Start';
        let progressValue = 0;
        if (project) {
          // Convert status code to readable label
          const raw = project.new_projectstatus;
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (Number.isFinite(n) && (n as number) in New_projectsnew_projectstatus) {
            const key = n as keyof typeof New_projectsnew_projectstatus;
            const v = New_projectsnew_projectstatus[key];
            if (v === 'ToStart') status = 'To Start';
            else if (v === 'OnTrack') status = 'On Track';
            else if (v === 'Delayed') status = 'Delayed';
            else if (v === 'Completed') status = 'Completed';
          } else {
            const name = String(project.new_projectstatusname ?? '').trim();
            if (name) {
              const low = name.toLowerCase();
              if (low.includes('complet')) status = 'Completed';
              else if (low.includes('delay')) status = 'Delayed';
              else if (low.includes('on') && low.includes('track')) status = 'On Track';
              else if (low.includes('to start') || (low.includes('start') && !low.includes('track'))) status = 'To Start';
            }
          }

          // Get progress from multiple possible field names
          const progressRaw = project.new_progresslevel ?? project.new_progress ?? project.new_Progress ?? 0;
          progressValue = Number(progressRaw) || 0;
          // Ensure it's a valid number between 0-100
          if (!Number.isFinite(progressValue) || progressValue < 0) progressValue = 0;
          if (progressValue > 100) progressValue = 100;
        }

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
          progress: progressValue,
          status,
        };
      });
      return rows.filter((r) => reportProjectFilter === 'All' || r.projectName === reportProjectFilter);
    } catch {
      return [];
    }
  }, [reportEntityRows, reportProjectMap, reportProjectFilter, programIdToName]);

  const openEditReport = async (row: {
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
    const reportRow = reportEntityRows.find((r) => String(r.new_reportid ?? '') === row.id);
    const attachmentId = reportRow ? String(reportRow.new_attachmentid ?? '').trim() : '';

    console.log('Opening edit report - reportRow:', reportRow);
    console.log('Opening edit report - attachmentId:', attachmentId);

    setEditingReportId(row.id);
    setReportEditExistingAttachmentId(attachmentId);
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
    setReportEditAttachmentFiles([]);
    setReportEditError('');

    if (attachmentId) {
      console.log('Fetching files for attachmentId:', attachmentId);
      try {
        const existingFiles = await fetchAttachments(attachmentId);
        console.log('Fetched existing files:', existingFiles);
        setReportEditExistingFiles(existingFiles);
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
        setReportEditExistingFiles([]);
      }
    } else {
      console.log('No attachment ID found');
      setReportEditExistingFiles([]);
    }

    setShowEditReportModal(true);
  };

  const addEditReportFilesFromList = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).filter(
      (f) => !reportEditAttachmentFiles.some((existing) => existing.name === f.name),
    );
    if (newFiles.length > 0) setReportEditAttachmentFiles((prev) => [...prev, ...newFiles]);
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
      // Use existing attachment ID if available, otherwise generate a new one for new files
      let attachmentId = reportEditExistingAttachmentId;
      if (reportEditAttachmentFiles.length > 0 && !attachmentId) {
        attachmentId = `ATT-${Date.now()}`;
      }

      const updatePayload: Record<string, unknown> = {
        new_program: programName,
        new_report1: title,
        new_projectname: projectName,
        new_reporttype: reportEditForm.reportType.trim() || undefined,
        new_sector: reportEditForm.sector.trim() || undefined,
        new_assigntomanagementmember: reportEditForm.assigneeEmail.trim() || undefined,
        new_summary: reportEditForm.summary.trim() || undefined,
        new_remark: reportEditForm.remark.trim() || undefined,
        new_programstatus: reportEditForm.programStatus.trim() || undefined,
      };

      if (attachmentId) {
        updatePayload.new_attachmentid = attachmentId;
      }

      const res = await New_reportsService.update(editingReportId, updatePayload);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update report');

      if (attachmentId && reportEditAttachmentFiles.length > 0) {
        void uploadFilesForReport(attachmentId, reportEditAttachmentFiles);
      }

      onNotify?.('success', 'Report updated successfully.');
      setShowEditReportModal(false);
      setReportEditAttachmentFiles([]);
      setReportEditExistingFiles([]);
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

  const closeEditReport = () => {
    setShowEditReportModal(false);
    setReportEditAttachmentFiles([]);
    setReportEditExistingFiles([]);
    setReportEditExistingAttachmentId('');
  };

  if (!isActive) return null;

  if (showAddReportForm) {
    return <AddReportFormPanel onClose={handleCloseAdd} onNotify={onNotify} />;
  }

  if (showTableEdit && showEditReportModal) {
    const reportFieldClass = `enj-add-project-field mt-1 ${enj.control}`;
    return (
      <FormPageShell parentLabel="Reports" onBack={closeEditReport} title="Edit Report">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
          <div>
            <FormFieldLabel label="Program Name" required />
            <select className={reportFieldClass} value={reportEditForm.programName} onChange={(e) => setReportEditForm((f) => ({ ...f, programName: e.target.value }))}>
              <option value="">Select Program</option>
              {reportEditProgramOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <FormFieldLabel label="Report Title" required />
            <input className={reportFieldClass} value={reportEditForm.reportTitle} onChange={(e) => setReportEditForm((f) => ({ ...f, reportTitle: e.target.value }))} />
          </div>
          <div>
            <FormFieldLabel label="Project Name" required />
            <select className={reportFieldClass} value={reportEditForm.projectName} onChange={(e) => setReportEditForm((f) => ({ ...f, projectName: e.target.value }))}>
              <option value="">Select Project</option>
              {reportEditProjectOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <FormFieldLabel label="Sector" required />
            <input className={reportFieldClass} value={reportEditForm.sector} onChange={(e) => setReportEditForm((f) => ({ ...f, sector: e.target.value }))} />
          </div>
          <div>
            <FormFieldLabel label="Report Type" required />
            <select className={reportFieldClass} value={reportEditForm.reportType} onChange={(e) => setReportEditForm((f) => ({ ...f, reportType: e.target.value }))}>
              <option value="">Select Report Type</option>
              {Array.from(new Set([...reportTypeMasterOptions, reportEditForm.reportType].filter(Boolean))).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <FormFieldLabel label="Program Status" required />
            <select className={reportFieldClass} value={reportEditForm.programStatus} onChange={(e) => setReportEditForm((f) => ({ ...f, programStatus: e.target.value }))}>
              <option value="">Select Program Status</option>
              {reportEditProgramStatusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <FormFieldLabel label="Assign to Manager/Member" required />
            <select className={reportFieldClass} value={reportEditForm.assigneeEmail} onChange={(e) => setReportEditForm((f) => ({ ...f, assigneeEmail: e.target.value }))}>
              <option value="">Select Team Member Email</option>
              {Array.from(new Set([...reportAssigneeEmailOptions, reportEditForm.assigneeEmail].filter(Boolean))).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <FormFieldLabel label="Summary" required />
            <textarea className={`${reportFieldClass} h-20 resize-none`} value={reportEditForm.summary} onChange={(e) => setReportEditForm((f) => ({ ...f, summary: e.target.value }))} />
          </div>
          <div>
            <FormFieldLabel label="Remark" required />
            <textarea className={`${reportFieldClass} h-20 resize-none`} value={reportEditForm.remark} onChange={(e) => setReportEditForm((f) => ({ ...f, remark: e.target.value }))} />
          </div>
          <div className="md:col-span-3">
            <FormFieldLabel label="Add attachments" />
            <input
              ref={reportEditFileInputRef}
              type="file"
              className="sr-only"
              multiple
              disabled={reportEditBusy}
              onChange={(e) => {
                if (e.target.files?.length) addEditReportFilesFromList(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="enj-add-project-attachments mt-1 rounded-lg border border-[#ADACB4] bg-white p-4">
              {reportEditExistingFiles.length === 0 && reportEditAttachmentFiles.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">There is nothing attached.</p>
                  <button
                    type="button"
                    onClick={() => reportEditFileInputRef.current?.click()}
                    disabled={reportEditBusy}
                    className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    style={{ color: '#A08149' }}
                  >
                    <Paperclip size={16} />
                    Attach file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportEditExistingFiles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Existing attachments</p>
                      <ul className="space-y-1">
                        {reportEditExistingFiles.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{file.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#A08149] hover:opacity-80"
                                title="Download"
                              >
                                <Download size={16} />
                              </a>
                              <button
                                type="button"
                                className="text-rose-600 hover:opacity-80"
                                disabled={reportEditBusy}
                                onClick={() => setReportEditExistingFiles((prev) => prev.filter((x) => x.id !== file.id))}
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reportEditAttachmentFiles.length > 0 && (
                    <div className={reportEditExistingFiles.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Files to upload</p>
                      <ul className="space-y-1">
                        {reportEditAttachmentFiles.map((f) => (
                          <li key={f.name} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                            <span className="truncate">{f.name}</span>
                            <button
                              type="button"
                              className="text-rose-600 shrink-0 hover:opacity-80"
                              disabled={reportEditBusy}
                              onClick={() => setReportEditAttachmentFiles((prev) => prev.filter((x) => x.name !== f.name))}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className={reportEditExistingFiles.length > 0 || reportEditAttachmentFiles.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                    <button
                      type="button"
                      onClick={() => reportEditFileInputRef.current?.click()}
                      disabled={reportEditBusy}
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
        {reportEditError && <p className="mt-2 text-xs text-rose-600">{reportEditError}</p>}
        <FormPageActions
          onCancel={closeEditReport}
          onSave={() => void saveEditedReport()}
          busy={reportEditBusy}
          saveLabel="Save"
        />
      </FormPageShell>
    );
  }

  const reportViewAllTotalPages = Math.max(1, Math.ceil(filteredReportTableRows.length / REPORT_VIEW_ALL_PAGE_SIZE));
  const pagedReportViewAllRows = filteredReportTableRows.slice(
    (reportViewAllPage - 1) * REPORT_VIEW_ALL_PAGE_SIZE,
    reportViewAllPage * REPORT_VIEW_ALL_PAGE_SIZE,
  );

  const reportTableRow = (row: (typeof filteredReportTableRows)[0], idx: number) => (
    <tr key={`${row.reportTitle}-${idx}`} className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
      <td className={`${TABLE_STYLES.dataCell} rounded-l-[11.9px]`}>{row.reportTitle}</td>
      <td className={TABLE_STYLES.dataCell}>{row.projectName}</td>
      <td className={TABLE_STYLES.dataCell}>{row.reportType}</td>
      <td className={TABLE_STYLES.dataCell}>{row.sector}</td>
      <td className={TABLE_STYLES.dataCell}>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-normal text-gray-500">Start Date</p>
            <p className="flex items-center gap-1 text-[10px] font-medium text-gray-900">
              <Calendar size={12} className="text-gray-400" />
              {safeDateLabel(row.start)}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-[10px] font-normal text-gray-500">End Date</p>
            <p className="flex items-center gap-1 text-[10px] font-medium text-gray-900">
              <Calendar size={12} className="text-gray-400" />
              {safeDateLabel(row.end)}
            </p>
          </div>
        </div>
      </td>
      <td className={TABLE_STYLES.dataCell}>
        <div className="w-[150px]">
          <p className="mb-1 text-right text-[11px] text-gray-600">{row.progress}%</p>
          <div className="enj-table-progress-track w-full max-w-[150px]">
            <div className="enj-table-progress-fill" style={{ width: `${row.progress}%` }} />
          </div>
        </div>
      </td>
      <td className={TABLE_STYLES.dataCell}>
        <span className={`inline-block min-w-[90px] text-center text-[11px] ${reportStatusBadge(String(row.status))}`}>
          {row.status}
        </span>
      </td>
      {showTableEdit && (
        <td className={`${TABLE_STYLES.dataCell} sticky right-0 z-10 w-[1%] min-w-[3rem] whitespace-nowrap rounded-r-[11.9px]`}>
          <button
            type="button"
            className={TABLE_STYLES.actionButton}
            onClick={() => void openEditReport(row)}
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
      <tr style={{ backgroundColor: '#E1E3EC' }}>
        <th style={reportHeaderStyle}>Report Title</th>
        <th style={reportHeaderStyle}>Project Name</th>
        <th style={reportHeaderStyle}>Report Type</th>
        <th style={reportHeaderStyle}>Sector</th>
        <th style={reportHeaderStyle}>Schedule</th>
        <th style={reportHeaderStyle}>Progress Level</th>
        <th style={reportHeaderStyle}>Status</th>
        {showTableEdit && (
          <th style={reportHeaderStyle} className="sticky right-0 z-20 w-[1%] min-w-[3rem] whitespace-nowrap" />
        )}
      </tr>
    </thead>
  );


  if (showReportViewAll) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-transparent px-0 py-3">
          <button
            type="button"
            onClick={() => { setShowReportViewAll(false); setReportViewAllPage(1); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-bold text-[rgba(35,35,96,1)] truncate">Project Reports – All Records</h1>
        </div>
        <div className="overflow-x-auto bg-transparent">
          <table className={`${enj.table} min-w-[920px] w-full bg-transparent border-separate`}>
            {reportTableHead}
            <tbody>
              {pagedReportViewAllRows.length === 0 ? (
                <tr className="text-xs text-gray-500 bg-transparent">
                  <td className="px-3 py-3 bg-transparent" colSpan={showTableEdit ? 8 : 7}>
                    No report rows for selected filters.
                  </td>
                </tr>
              ) : (
                pagedReportViewAllRows.map((row, idx) => reportTableRow(row, idx))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-0 py-3">
          <PagerBar
            page={reportViewAllPage}
            pageSize={REPORT_VIEW_ALL_PAGE_SIZE}
            total={filteredReportTableRows.length}
            onPrev={() => setReportViewAllPage((p) => Math.max(1, p - 1))}
            onNext={() => setReportViewAllPage((p) => Math.min(reportViewAllTotalPages, p + 1))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-4">
      <section className={enj.screenToolbar}>
        <h2 className="enj-screen-header">Reports</h2>
        <div className={enj.screenToolbarActions}>
          {showTableEdit && (
            <>
              <button
                type="button"
                className={`${enj.btn} ${enj.btnDefault} px-3`}
                onClick={() => {
                  setReportSectorFilter('All');
                  setReportProgramFilter('All');
                  setReportProjectFilter('All');
                  setReportKpiFilter('All');
                  setReportTypeFilter('All');
                  setReportBudgetFilter('All');
                  setReportPmFilter('All');
                  setReportProjectMgrFilter('All');
                  setReportStatusFilter('All');
                  setReportDurationFilter('All Dates');
                  void loadReportData();
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className={enj.btnPrimary}
                onClick={() => setShowAddReportForm(true)}
              >
                Create a Report
              </button>
            </>
          )}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
        {(
          [
            { label: 'Sector', value: reportSectorFilter, onChange: setReportSectorFilter, options: reportFilterOptions.sectors },
            { label: 'Program', value: reportProgramFilter, onChange: setReportProgramFilter, options: reportFilterOptions.programs },
            { label: 'Project', value: reportProjectFilter, onChange: setReportProjectFilter, options: reportFilterOptions.projects },
            { label: 'KPI', value: reportKpiFilter, onChange: setReportKpiFilter, options: reportFilterOptions.kpis },
            { label: 'Type', value: reportTypeFilter, onChange: setReportTypeFilter, options: reportFilterOptions.types },
            { label: 'Budget', value: reportBudgetFilter, onChange: setReportBudgetFilter, options: reportFilterOptions.budgets },
            {
              label: 'Program Manager',
              value: reportPmFilter,
              onChange: setReportPmFilter,
              options: reportFilterOptions.programManagers,
            },
            {
              label: 'Project Manager',
              value: reportProjectMgrFilter,
              onChange: setReportProjectMgrFilter,
              options: reportFilterOptions.projectManagers,
            },
            {
              label: 'Duration',
              value: reportDurationFilter,
              onChange: setReportDurationFilter,
              options: ['All Dates', 'This Month', 'This Quarter', 'This Year'],
            },
            { label: 'Status', value: reportStatusFilter, onChange: setReportStatusFilter, options: reportFilterOptions.statuses },
          ] as const
        ).map(({ label, value, onChange, options }) => (
          <div key={label} className="min-w-0">
            <p className="mb-1 text-[10px] font-normal text-gray-500">{label}</p>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`${enj.control} !h-8 !min-h-8 !max-h-8 !bg-white !px-2 !text-[10px] !text-gray-600`}
            >
              {options.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <section className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {reportDashboardStats.cards.map((card) => (
          <ReportStatCard key={card.label} label={card.label} value={card.value} color={card.color} />
        ))}
      </section>

      <section className="grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="chart-card flex h-full min-h-[248px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="shrink-0 text-sm font-semibold text-gray-800">Project category</h3>
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center overflow-visible">
              <DonutChart
                className="chart-svg h-44 w-44 shrink-0"
                showOuterLabels
                ringWidth={40}
                slices={reportDashboardStats.categorySlices}
                centerText={String(reportDashboardStats.filterMeta.projectCount)}
                centerSubtext={reportDashboardStats.filterMeta.projectCount === 1 ? 'project' : 'projects'}
                labelColor="#64748b"
                fontScale={0.82}
              />
          </div>
        </div>
        <div className="chart-card flex h-full min-h-[248px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="shrink-0 text-sm font-semibold text-gray-800">Project type</h3>
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center min-w-0">
            <svg viewBox="0 0 260 200" className="chart-svg h-full min-h-[200px] w-full max-h-[220px]" role="img" aria-label="Project type counts">
              {(() => {
                const labelFs = 9;
                const bars: Array<[string, number]> =
                  reportDashboardStats.typeBars.length > 0
                    ? reportDashboardStats.typeBars
                    : [['No data', 0]];
                const isEmpty =
                  reportDashboardStats.filterMeta.projectCount === 0 || reportDashboardStats.typeBars.length === 0;
                const max = isEmpty ? 1 : Math.max(1, ...bars.map(([, v]) => v));
                const total = bars.filter(([n]) => n !== 'No data').reduce((s, [, v]) => s + v, 0) || 0;
                const y0 = 168;
                const hMax = 128;
                const x0 = 40;
                const plotRight = 240;
                const n = bars.length;
                const innerW = plotRight - x0 - 16;
                const gap = Math.min(24, n > 1 ? innerW / (n * 4) : 0);
                const barW = Math.max(16, Math.min(28, (innerW - gap * (n - 1)) / Math.max(1, n)));
                const tickVals = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));
                return (
                  <>
                    {tickVals.map((tv, i) => (
                      <g key={`g-${i}`}>
                        <line
                          x1={x0}
                          x2={plotRight}
                          y1={y0 - (i / 4) * hMax}
                          y2={y0 - (i / 4) * hMax}
                          stroke="#f1f5f9"
                        />
                        <text
                          x="28"
                          y={4 + y0 - (i / 4) * hMax}
                          fontSize={labelFs}
                          fontWeight="600"
                          textAnchor="end"
                          fill="#374151"
                        >
                          {tv}
                        </text>
                      </g>
                    ))}
                    {bars.map(([name, v], i) => {
                      const nh = isEmpty || name === 'No data' ? 0 : (v / max) * hMax;
                      const bx = x0 + 8 + i * (barW + gap);
                      const slotW = barW + (i < n - 1 ? gap * 0.85 : 0);
                      const pct = !isEmpty && total > 0 && name !== 'No data' ? Math.round((v / total) * 100) : 0;
                      const displayName = truncateChartLabel(name, slotW, labelFs);
                      const tooltip =
                        isEmpty || name === 'No data'
                          ? 'No data'
                          : `${name}: ${formatListNumber(v)} (${pct}% of total)`;
                      return (
                        <g key={`${name}-${i}`} className="cursor-default">
                          <title>{tooltip}</title>
                          <rect
                            x={bx}
                            y={y0 - nh}
                            width={barW}
                            height={Math.max(0, nh)}
                            rx="3"
                            className="chart-bar"
                            fill={['#59628a', '#d4a759', '#b28a44', '#60a5fa', '#d65257'][i % 5]}
                          />
                          {nh > 0 && (
                            <text
                              x={bx + barW / 2}
                              y={y0 - nh - 5}
                              textAnchor="middle"
                              fontSize={labelFs}
                              fontWeight="600"
                              fill="#1f2937"
                              pointerEvents="none"
                            >
                              {v}
                            </text>
                          )}
                          <text
                            x={bx + barW / 2}
                            y={y0 + 20}
                            textAnchor="middle"
                            fontSize={labelFs}
                            fontWeight="600"
                            fill="#374151"
                            pointerEvents="none"
                          >
                            {displayName}
                          </text>
                          <rect
                            x={bx - 2}
                            y={y0 - nh}
                            width={barW + 4}
                            height={Math.max(nh, 0) + 32}
                            fill="transparent"
                            pointerEvents="all"
                          />
                        </g>
                      );
                    })}
                    <text x="130" y="16" textAnchor="middle" fontSize={labelFs} fontWeight="600" fill="#374151">
                      Count (max {formatListNumber(max)})
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
        <div className="chart-card flex h-full min-h-[248px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="shrink-0 text-sm font-semibold text-gray-800">Budget by sector</h3>
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center overflow-visible">
              <DonutChart
                className="chart-svg h-44 w-44 shrink-0"
                showOuterLabels
                ringWidth={42}
                slices={reportDashboardStats.budgetSlices}
                centerText={
                  reportDashboardStats.filterMeta.totalBudget > 0
                    ? formatListNumber(reportDashboardStats.filterMeta.totalBudget)
                    : '—'
                }
                centerSubtext="total (sum)"
                labelColor="#64748b"
                fontScale={0.82}
              />
          </div>
        </div>
        <div className="chart-card flex h-full min-h-[248px] flex-col rounded-xl bg-white p-3 shadow-sm">
          <h3 className="shrink-0 text-sm font-semibold text-gray-800">Projects by progress</h3>
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <DonutChart
                className="chart-svg h-44 w-44 shrink-0"
                showOuterLabels
                ringWidth={42}
                slices={reportDashboardStats.progressSlices}
                labelColor="#64748b"
                fontScale={0.82}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="shrink-0 bg-transparent pt-1">
        <div className={`${enj.sectionToolbar} px-0 pb-2 pt-3`}>
          <h3 className={enj.sectionTitle}>Project Reports</h3>
          {filteredReportTableRows.length > 0 && (
            <button
              type="button"
              onClick={() => { setShowReportViewAll(true); setReportViewAllPage(1); }}
              className={enj.sectionTextAction}
            >
              View All
            </button>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className={`${enj.table} min-w-[920px] bg-transparent border-separate`}>
            {reportTableHead}
            <tbody>
              {reportsLoading && (
                <tr className="text-xs text-gray-500 bg-transparent">
                  <td className="px-3 py-3 bg-transparent" colSpan={showTableEdit ? 8 : 7}>Loading reports...</td>
                </tr>
              )}
              {!reportsLoading && filteredReportTableRows.length === 0 && (
                <tr className="text-xs text-gray-500 bg-transparent">
                  <td className="px-3 py-3 bg-transparent" colSpan={showTableEdit ? 8 : 7}>No report rows for selected filters.</td>
                </tr>
              )}
              {!reportsLoading && filteredReportTableRows.slice(0, 10).map((row, idx) => reportTableRow(row, idx))}
            </tbody>
          </table>
        </div>
        <div className="px-0 py-2 text-right text-[10px] text-gray-400">Showing {Math.min(10, filteredReportTableRows.length)} of {filteredReportTableRows.length} rows</div>
      </section>
    </div>
  );
}

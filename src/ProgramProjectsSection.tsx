import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Coins, Paperclip, SquareArrowUpRight, Users, X } from 'lucide-react';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsService } from './generated/services/New_projectsService';
import {
  New_projectsnew_projectpriority,
  New_projectsnew_projecttype,
  New_projectsnew_strategicgoal,
  New_projectsnew_projectstatus,
} from './generated/models/New_projectsModel';
import { New_vendorsService } from './generated/services/New_vendorsService';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import { SponsorsService, type SponsorRow } from './services/SponsorsService';
import { DatePickerField } from './EnjDatePicker';
import { type ToastType } from './NotificationToast';
import { sendEmailNotification, generateEmailTemplate } from './services/PMTMailNotificationService';
import { AllocateTeamMemberModal } from './AllocateTeamMemberModal';
import { AgileSprintPanel } from './AgileSprintPanel';
import { WaterfallSprintPanel } from './WaterfallSprintPanel';
import { fetchAttachments, uploadAttachments, downloadFile, type AttachmentFile } from './services/attachmentService';
import { ProjectEditFormPanel, createEmptyEditProjectForm, type EditProjectFormState } from './ProjectEditFormPanel';
import { enj } from './ui/enjForm';
import { PagerBar } from './PagerBar';

const projectBoardColumns = [
  { title: 'To Start', color: '#f6be00' },
  { title: 'On Track', color: '#10b981' },
  { title: 'Delayed', color: '#ef4444' },
  { title: 'Completed', color: '#2563eb' },
];
const MASTER_CATEGORY_CODES = {
  KPI: [100000001],
  /**
   * Master data choice values can drift across environments.
   * Keep both observed sets to avoid dropping valid rows.
   */
  SECTOR: [100000004, 100000010],
  MILESTONE: [100000003, 100000005],
  METHODOLOGY: [100000017, 100000019],
} as const;

const categoryFromMaster = (row: EnjazMasterDataRow): string => {
  const typed = String(row.new_categorytype ?? '').trim();
  if (typed) return typed;
  const named = String(row.new_categoryname ?? '').trim();
  if (named) return named;
  const valueMap = new Map<number, string>([
    [100000000, 'Program Code'], [100000001, 'KPI'], [100000002, 'Benefits'],
    [100000003, 'Milestone'], [100000004, 'Project Code'], [100000005, 'Stage'],
    [100000006, 'Report Type'], [100000007, 'Specialization'], [100000008, 'Meeting Category'],
    [100000009, 'Deliverables'], [100000010, 'Industry'], [100000011, 'Country'],
    [100000012, 'Region'], [100000013, 'Currency'], [100000014, 'Time'],
    [100000015, 'Shift'], [100000016, 'Holiday'], [100000017, 'Methodology'],
  ]);
  const raw = row.new_category;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isNaN(num) && valueMap.has(num)) return valueMap.get(num) ?? '';
  return String(raw ?? '');
};

const isMasterActive = (row: EnjazMasterDataRow) => {
  // Primary condition requested: new_status = Active (100000000)
  const appStatus = Number(row.new_status ?? NaN);
  if (Number.isFinite(appStatus)) return appStatus === 100000000;

  // Fallback only when new_status is unavailable in the row shape.
  const stateCode = Number(row.statecode ?? NaN);
  if (Number.isFinite(stateCode) && stateCode === 1) return false;
  const statusCode = Number(row.statuscode ?? NaN);
  if (Number.isFinite(statusCode) && statusCode === 2) return false;
  const raw = String(row.new_statusname ?? row.new_status ?? '').toLowerCase();
  return !raw.includes('inactive');
};

const normalizeCategory = (value: string) => value.toLowerCase().replace(/[\s_&-]+/g, '');

/** Add-project form labels â€” 13px normal (no ReqField wrapper). */
function AddProjectFieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1 block text-[13px] font-normal leading-normal text-gray-600">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

const optionsFromMetadataAttribute = (attrs: Array<Record<string, unknown>>, logicalName: string) => {
  const attr = attrs.find((a) => String(a.LogicalName ?? a.logicalName ?? '').toLowerCase() === logicalName.toLowerCase());
  const optionListRaw =
    (attr?.OptionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
    ?? (attr?.OptionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
    ?? (attr?.optionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
    ?? (attr?.optionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
    ?? [];
  return optionListRaw
    .map((o) => {
      const value = Number(o.Value ?? o.value ?? NaN);
      const label =
        String(
          (o.Label as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
          ?? (o.Label as { LocalizedLabels?: Array<{ Label?: string }> } | undefined)?.LocalizedLabels?.[0]?.Label
          ?? (o.label as string | undefined)
          ?? '',
        ).trim();
      if (Number.isNaN(value) || !label) return null;
      return { value, label };
    })
    .filter((o): o is { label: string; value: number } => Boolean(o));
};

const attrTypeName = (attr?: Record<string, unknown>): string =>
  String(
    (attr?.AttributeTypeName as { Value?: string } | undefined)?.Value
    ?? attr?.AttributeType
    ?? attr?.attributeType
    ?? '',
  ).toLowerCase();

const pickLogicalByContains = (names: string[], include: string[], exclude: string[] = []) =>
  names.find((n) => {
    const lower = n.toLowerCase();
    return include.every((i) => lower.includes(i.toLowerCase())) && !exclude.some((e) => lower.includes(e.toLowerCase()));
  });
const readAttrLabel = (attr: Record<string, unknown>) =>
  String(
    (attr.DisplayName as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
    ?? (attr.displayName as { userLocalizedLabel?: { label?: string } } | undefined)?.userLocalizedLabel?.label
    ?? '',
  ).trim();
const normalizeAttrKey = (value: string) => value.toLowerCase().replace(/[\s_\-]+/g, '');
const pickLogicalByDisplayLabel = (attrs: Array<Record<string, unknown>>, label: string) => {
  const target = normalizeAttrKey(label);
  const match = attrs.find((a) => normalizeAttrKey(readAttrLabel(a)) === target);
  const logical = String(match?.LogicalName ?? match?.logicalName ?? '').trim();
  return logical || undefined;
};
const pickLogicalFromAttrs = (
  attrs: Array<Record<string, unknown>>,
  includeNameParts: string[],
  includeLabelParts: string[] = includeNameParts,
  excludeNameParts: string[] = [],
) =>
  attrs.find((a) => {
    const logical = String(a.LogicalName ?? a.logicalName ?? '').toLowerCase();
    const label = readAttrLabel(a).toLowerCase();
    const byName = includeNameParts.every((p) => logical.includes(p.toLowerCase())) && !excludeNameParts.some((p) => logical.includes(p.toLowerCase()));
    const byLabel = includeLabelParts.every((p) => label.includes(p.toLowerCase()));
    return byName || byLabel;
  });

const readFirstString = (row: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const value = row[k];
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const distinctSortedValues = (values: string[]) =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

/** Map stored project text to the master-data display string (exact / case / normalized spacing). */
function canonicalMasterOptionLabel(stored: string, options: string[]): string | undefined {
  const t = stored.trim();
  if (!t || options.length === 0) return undefined;
  if (options.includes(t)) return t;
  const byCi = options.find((o) => o.toLowerCase() === t.toLowerCase());
  if (byCi) return byCi;
  const nk = normalizeCategory(t);
  return options.find((o) => normalizeCategory(o) === nk);
}

const PROGRAM_BUDGET_EXCEEDED_MSG = 'Given Budget is more than the Program Budget';

function readNumericBudget(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeProgramKey(name: string): string {
  return name.trim().toLowerCase();
}

function readProgramNameFromProject(row: Record<string, unknown>): string {
  return String(row.crcf8_programname ?? row.new_programname ?? '').trim();
}

function readProjectBudget(row: Record<string, unknown>): number {
  return readNumericBudget(row.new_budget ?? row.crcf8_budget);
}

function sumProjectBudgetsForProgram(
  rows: Array<Record<string, unknown>>,
  programName: string,
  excludeProjectId?: string,
): number {
  const key = normalizeProgramKey(programName);
  if (!key) return 0;
  return rows.reduce((sum, row) => {
    if (excludeProjectId && String(row.new_projectid ?? '').trim() === excludeProjectId) return sum;
    if (normalizeProgramKey(readProgramNameFromProject(row)) !== key) return sum;
    return sum + readProjectBudget(row);
  }, 0);
}

function validateProjectBudgetAgainstProgram(args: {
  programName: string;
  proposedBudget: string;
  programBudgetByName: Map<string, number>;
  projectRows: Array<Record<string, unknown>>;
  excludeProjectId?: string;
}): string | undefined {
  const { programName, proposedBudget, programBudgetByName, projectRows, excludeProjectId } = args;
  if (!programName.trim()) return undefined;
  if (!/^\d+(\.\d+)?$/.test(proposedBudget.trim())) return undefined;

  const proposed = Number(proposedBudget.trim());
  const programBudget = programBudgetByName.get(normalizeProgramKey(programName));
  if (programBudget === undefined || !Number.isFinite(programBudget)) return undefined;

  const usedByOthers = sumProjectBudgetsForProgram(projectRows, programName, excludeProjectId);
  const remaining = programBudget - usedByOthers;
  if (proposed > remaining + 1e-9) return PROGRAM_BUDGET_EXCEEDED_MSG;
  return undefined;
}

function formatProjectDisplayDate(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return 'â€”';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return s.slice(0, 10);
}

/** `YYYY-MM-DD` for date inputs (edit project modal). */
function toYmdForInput(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

function computeNextProjectId(rows: Array<Record<string, unknown>>): string {
  let max = 0;
  rows.forEach((row) => {
    const raw = String(row.new_projectid ?? '').trim();
    const m = raw.match(/^PRJ(\d+)$/i);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `PRJ${max + 1}`;
}

function readProjectRowProgress(row: Record<string, unknown>): number {
  const raw = row.new_progress ?? row.crcf8_progress ?? row.crcf8_cprogress;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.min(100, Math.round(n));
}

/** Avatar initials from manager / owner / project name */
function projectCardInitials(row: Record<string, unknown>): string {
  const name = readFirstString(row, [
    'new_programmanagername',
    'owneridname',
    'createdbyname',
    'new_projectname',
    'new_name',
  ]);
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'PR';
}

function formatProjectBudgetShort(row: Record<string, unknown>): string {
  const raw = row.new_budget ?? row.crcf8_budget;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(Math.round(n));
  }
  const s = String(raw ?? '').trim();
  return s || 'â€”';
}

function isAgileProject(row: Record<string, unknown>): boolean {
  const methodologyName = String(row.new_methodologyname ?? '').toLowerCase().trim();
  if (methodologyName.includes('agile')) return true;
  const methodologyRaw = String(row.new_methodology ?? '').toLowerCase().trim();
  if (methodologyRaw === '100000000') return true;
  if (methodologyRaw.includes('agile')) return true;
  return false;
}

export function ProgramProjectsSection({
  todayIso,
  onToast,
  externalProjectRows,
  onExternalDataInvalidate,
  hideNewProject,
  hideSprintAndMembers,
  hideEdit,
}: {
  todayIso: string;
  onToast: (p: { type: ToastType; message: string }) => void;
  /** When set, the board uses these rows and does not load all projects (e.g. Team: participation filter). */
  externalProjectRows?: { rows: Array<Record<string, unknown>>; loading: boolean };
  /** Call after side effects that should refresh `externalProjectRows` from the parent. */
  onExternalDataInvalidate?: () => void;
  /** Team workspace: same board UI without "New Project". */
  hideNewProject?: boolean;
  /** Team workspace: hide Sprint and Members actions on project cards. */
  hideSprintAndMembers?: boolean;
  /** Team workspace: disable project edit (title click opens edit form). */
  hideEdit?: boolean;
}) {
  const isExternal = externalProjectRows !== undefined;
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [allocateMemberCtx, setAllocateMemberCtx] = useState<{ projectId: string; projectName: string } | null>(null);
  const [agileSprintProject, setAgileSprintProject] = useState<Record<string, unknown> | null>(null);
  const [waterfallSprintProject, setWaterfallSprintProject] = useState<Record<string, unknown> | null>(null);
  const [projectFormBusy, setProjectFormBusy] = useState(false);
  const [projectFormErrors, setProjectFormErrors] = useState<Record<string, string>>({});
  const [projectMetaLoading, setProjectMetaLoading] = useState(false);
  const [projectFilesModal, setProjectFilesModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [projectFilesRows, setProjectFilesRows] = useState<AttachmentFile[]>([]);
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);
  const [editProjectRow, setEditProjectRow] = useState<Record<string, unknown> | null>(null);
  const [editProjectForm, setEditProjectForm] = useState<EditProjectFormState>(createEmptyEditProjectForm);
  const [editProjectBusy, setEditProjectBusy] = useState(false);
  const [editProjectErrors, setEditProjectErrors] = useState<Record<string, string>>({});
  /** Row to populate into the quick-edit form once `loadProjectFormData` has committed (see useEffect). */
  const [editProjectPopulateFrom, setEditProjectPopulateFrom] = useState<Record<string, unknown> | null>(null);
  const [editMilestoneMenuOpen, setEditMilestoneMenuOpen] = useState(false);
  const [viewAllStatus, setViewAllStatus] = useState<string | null>(null);
  const [viewAllPage, setViewAllPage] = useState(1);
  const VIEW_ALL_PAGE_SIZE = 6;
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    programName: '',
    vendorName: '',
    projectPriority: '',
    projectCategory: '',
    projectType: '',
    strategicGoal: '',
    budget: '',
    assignToProjectManager: '',
    risks: '',
    kpi: '',
    methodology: '',
    startDate: todayIso,
    endDate: todayIso,
    department: '',
    projectStatus: '',
    milestone: [] as string[],
    projectSponsor: '',
    note: '',
    attachments: [] as File[],
  });
  const projectFormFileInputRef = useRef<HTMLInputElement>(null);
  const editProjectFileInputRef = useRef<HTMLInputElement>(null);
  const [milestoneMenuOpen, setMilestoneMenuOpen] = useState(false);
  const [projectChoiceOptions, setProjectChoiceOptions] = useState<{
    projectPriority: Array<{ label: string; value: number }>;
    projectType: Array<{ label: string; value: number }>;
    strategicGoal: Array<{ label: string; value: number }>;
    projectStatus: Array<{ label: string; value: number }>;
    projectCategory: Array<{ label: string; value: number }>;
    methodology: Array<{ label: string; value: number }>;
    projectSponsor: Array<{ label: string; value: number }>;
  }>({
    projectPriority: [],
    projectType: [],
    strategicGoal: [],
    projectStatus: [],
    projectCategory: [],
    methodology: [],
    projectSponsor: [],
  });
  const [projectTextColumns, setProjectTextColumns] = useState<{
    projectName: string;
    program: string;
    projectCategory: string;
    vendor: string;
    budget: string;
    risks: string;
    kpi: string;
    methodology: string;
    department: string;
    milestone: string;
    assignPm: string;
    note: string;
    sponsor: string;
    startDate: string;
    endDate: string;
  }>({
    projectName: 'new_projectname',
    program: 'new_programid',
    projectCategory: 'new_projectcategory',
    vendor: 'new_clientname',
    budget: 'new_budget',
    risks: 'new_risks',
    kpi: 'new_kpi',
    methodology: 'new_methodology',
    department: 'new_sector',
    milestone: 'new_milestone',
    assignPm: 'new_programmanager',
    note: 'new_note',
    sponsor: 'new_projectsponsor',
    startDate: 'new_startdate',
    endDate: 'new_enddate',
  });
  const [projectChoiceColumns, setProjectChoiceColumns] = useState<{
    projectPriority: string;
    projectType: string;
    strategicGoal: string;
    projectStatus: string;
    projectCategory: string;
    methodology: string;
  }>({
    projectPriority: 'new_projectpriority',
    projectType: 'new_projecttype',
    strategicGoal: 'new_strategicgoal',
    projectStatus: 'new_projectstatus',
    projectCategory: 'new_projectcategory',
    methodology: 'new_methodology',
  });
  const [projectMasterOptions, setProjectMasterOptions] = useState<{
    program: string[];
    projectCategory: string[];
    kpi: string[];
    methodology: string[];
    milestone: string[];
    sector: string[];
  }>({
    program: [],
    projectCategory: [],
    kpi: [],
    methodology: [],
    milestone: [],
    sector: [],
  });
  const [projectManagerEmails, setProjectManagerEmails] = useState<string[]>([]);
  /** From `new_sponsor`: label = name (email), value = email for `crcf8_projectsponsor`. Fallback: active user emails. */
  const [projectSponsorOptions, setProjectSponsorOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [vendorOptions, setVendorOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [projectFieldOptionMap, setProjectFieldOptionMap] = useState<Record<string, Array<{ label: string; value: number }>>>({});
  const [projectFieldTypeMap, setProjectFieldTypeMap] = useState<Record<string, string>>({});
  const [projectAvailableColumns, setProjectAvailableColumns] = useState<string[]>([]);
  const [projectRows, setProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [projectRowsLoading, setProjectRowsLoading] = useState(false);
  /** Program name (normalized) â†’ total program budget for project budget cap validation. */
  const [programBudgetByName, setProgramBudgetByName] = useState<Map<string, number>>(() => new Map());

  const createProjectBudgetProgramError = useMemo(
    () =>
      validateProjectBudgetAgainstProgram({
        programName: projectForm.programName,
        proposedBudget: projectForm.budget,
        programBudgetByName,
        projectRows,
      }),
    [projectForm.programName, projectForm.budget, programBudgetByName, projectRows],
  );

  const editProjectBudgetProgramError = useMemo(
    () =>
      validateProjectBudgetAgainstProgram({
        programName: editProjectForm.programName,
        proposedBudget: editProjectForm.budget,
        programBudgetByName,
        projectRows,
        excludeProjectId: editProjectRow ? String(editProjectRow.new_projectid ?? '').trim() : undefined,
      }),
    [editProjectForm.programName, editProjectForm.budget, programBudgetByName, projectRows, editProjectRow],
  );

  useEffect(() => {
    if (Object.keys(projectFormErrors).length === 0) return;
    setProjectFormErrors((prev) => {
      const next = { ...prev };
      if (next.projectName && projectForm.projectName.trim()) delete next.projectName;
      if (next.programName && projectForm.programName) delete next.programName;
      if (next.vendorName && projectForm.vendorName.trim()) delete next.vendorName;
      if (next.projectPriority && projectForm.projectPriority) delete next.projectPriority;
      if (next.projectCategory && projectForm.projectCategory) delete next.projectCategory;
      if (next.projectType && projectForm.projectType) delete next.projectType;
      if (next.strategicGoal && projectForm.strategicGoal) delete next.strategicGoal;
      if (next.assignToProjectManager && projectForm.assignToProjectManager) delete next.assignToProjectManager;
      if (next.risks && projectForm.risks.trim()) delete next.risks;
      if (next.methodology && projectForm.methodology) delete next.methodology;
      if (next.department && projectForm.department) delete next.department;
      if (next.projectStatus && projectForm.projectStatus) delete next.projectStatus;
      if (next.milestone && projectForm.milestone.length > 0) delete next.milestone;
      if (next.projectSponsor && projectForm.projectSponsor) delete next.projectSponsor;
      if (next.budget && /^\d+(\.\d+)?$/.test(projectForm.budget.trim())) delete next.budget;
      if (next.startDate && projectForm.startDate && projectForm.startDate >= todayIso) delete next.startDate;
      if (
        next.endDate
        && projectForm.endDate
        && projectForm.endDate >= todayIso
        && (!projectForm.startDate || projectForm.endDate >= projectForm.startDate)
      ) delete next.endDate;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [projectForm, projectFormErrors, todayIso]);

  /** Edit: include active master milestones plus any values saved on the project (e.g. inactive master or label drift). */
  const editMilestoneSelectOptions = useMemo(
    () => distinctSortedValues([...projectMasterOptions.milestone, ...editProjectForm.milestone]),
    [projectMasterOptions.milestone, editProjectForm.milestone],
  );

  const loadProjectFormData = async () => {
    setProjectMetaLoading(true);
    try {
      const [projectMetaRes, masterRes, usersRes, programsRes, vendorsRes, sponsorsRes] = await Promise.all([
        New_projectsService.getMetadata(),
        EnjazMasterDataService.getAll({ top: 1000, orderBy: ['new_code asc'] }),
        NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        New_programsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        New_vendorsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        SponsorsService.getAll({ top: 500, orderBy: ['new_sponsorname asc'] }),
      ]);
      const attrs = ((projectMetaRes as { data?: { Attributes?: Array<Record<string, unknown>> } })?.data?.Attributes ?? []);
      const attrByLogical = new Map(
        attrs.map((a) => [String(a.LogicalName ?? a.logicalName ?? '').toLowerCase(), a] as const),
      );
      const logicalNames = attrs
        .map((a) => String(a.LogicalName ?? a.logicalName ?? '').trim())
        .filter(Boolean);
      setProjectAvailableColumns(logicalNames.map((n) => n.toLowerCase()));
      const detectedMilestone =
        String(pickLogicalFromAttrs(attrs, ['milestone'], ['milestone'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['milestone'], ['milestone'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['milestone'], ['name', 'id'])
        || 'new_milestone';
      const detectedSector =
        String(pickLogicalFromAttrs(attrs, ['sector'], ['sector', 'department'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['sector'], ['sector', 'department'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['sector'], ['name', 'id'])
        || 'new_sector';
      const detectedProjectStatus =
        String(pickLogicalFromAttrs(attrs, ['project', 'status'], ['project', 'status'], ['program', 'statecode', 'statuscode'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['project', 'status'], ['project', 'status'], ['program', 'statecode', 'statuscode'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['project', 'status'], ['program', 'statecode', 'statuscode'])
        || logicalNames.find((n) => n.toLowerCase() === 'new_status')
        || logicalNames.find((n) => n.toLowerCase() === 'new_projectstatus')
        || 'new_projectstatus';
      const detectedProjectCategory =
        String(pickLogicalFromAttrs(attrs, ['project', 'category'], ['project', 'category'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['project', 'category'], ['project', 'category'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['project', 'category'], ['name', 'id'])
        || 'new_projectcategory';
      const detectedMethodology =
        String(pickLogicalFromAttrs(attrs, ['methodology'], ['methodology'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['methodology'], ['methodology'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['methodology'], ['name', 'id'])
        || 'new_methodology';
      const detectedProgram =
        String(pickLogicalFromAttrs(attrs, ['program'], ['program name', 'program'], ['manager', 'status', 'priority', 'type', 'category'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['program'], ['program name', 'program'], ['manager', 'status', 'priority', 'type', 'category'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['program'], ['manager', 'status', 'priority', 'type', 'category'])
        || 'new_programid';
      const detectedKpi =
        String(pickLogicalFromAttrs(attrs, ['kpi'], ['kpi'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['kpi'], ['kpi'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['kpi'], ['name', 'id'])
        || 'new_kpi';
      const detectedRisks =
        String(pickLogicalFromAttrs(attrs, ['risk'], ['risk'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['risk'], ['risk'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['risk'])
        || 'new_risks';
      const detectedManager =
        String(pickLogicalFromAttrs(attrs, ['manager'], ['project manager', 'manager'], ['name'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['manager'], ['project manager', 'manager'], ['name'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['manager'], ['name'])
        || 'new_programmanager';
      const detectedSponsor =
        String(pickLogicalFromAttrs(attrs, ['sponsor'], ['project sponsor', 'sponsor'], ['name'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['sponsor'], ['project sponsor', 'sponsor'], ['name'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['sponsor'], ['name'])
        || 'new_projectsponsor';
      const detectedProgramText = pickLogicalByDisplayLabel(attrs, 'Program Name') ?? detectedProgram;
      const detectedProjectCategoryText = pickLogicalByDisplayLabel(attrs, 'Project Category') ?? detectedProjectCategory;
      const detectedManagerText = pickLogicalByDisplayLabel(attrs, 'Project Manager') ?? detectedManager;
      const detectedRisksText = pickLogicalByDisplayLabel(attrs, 'Risks') ?? detectedRisks;
      const detectedKpiText = pickLogicalByDisplayLabel(attrs, 'KPI') ?? detectedKpi;
      const detectedMethodologyText = pickLogicalByDisplayLabel(attrs, 'Methodology') ?? detectedMethodology;
      const detectedSectorText = pickLogicalByDisplayLabel(attrs, 'Sector') ?? detectedSector;
      const detectedMilestoneText = pickLogicalByDisplayLabel(attrs, 'Mile Stone') ?? pickLogicalByDisplayLabel(attrs, 'Milestone') ?? detectedMilestone;
      const detectedSponsorText = pickLogicalByDisplayLabel(attrs, 'Project Sponsor') ?? detectedSponsor;
      setProjectChoiceColumns((prev) => ({
        ...prev,
        projectStatus: detectedProjectStatus,
        projectCategory: detectedProjectCategory,
        methodology: detectedMethodology,
      }));
      setProjectTextColumns((prev) => ({
        ...prev,
        program: detectedProgramText,
        projectCategory: detectedProjectCategoryText,
        kpi: detectedKpiText,
        risks: detectedRisksText,
        methodology: detectedMethodologyText,
        assignPm: detectedManagerText,
        sponsor: detectedSponsorText,
        milestone: detectedMilestoneText,
        department: detectedSectorText,
      }));
      const fallbackProjectPriority = Object.entries(New_projectsnew_projectpriority).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackProjectType = Object.entries(New_projectsnew_projecttype).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackStrategicGoal = Object.entries(New_projectsnew_strategicgoal).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackProjectStatus = Object.entries(New_projectsnew_projectstatus).map(([value, label]) => ({ value: Number(value), label }));
      const metaProjectPriority = optionsFromMetadataAttribute(attrs, 'new_projectpriority');
      const metaProjectType = optionsFromMetadataAttribute(attrs, 'new_projecttype');
      const metaStrategicGoal = optionsFromMetadataAttribute(attrs, 'new_strategicgoal');
      const metaProjectStatus = optionsFromMetadataAttribute(attrs, detectedProjectStatus);
      const metaMethodology = optionsFromMetadataAttribute(attrs, detectedMethodology);
      const metaProjectCategory = optionsFromMetadataAttribute(attrs, detectedProjectCategory);
      const metaMilestone = optionsFromMetadataAttribute(attrs, detectedMilestone);
      const metaSector = optionsFromMetadataAttribute(attrs, detectedSector);
      const metaProjectSponsor = optionsFromMetadataAttribute(attrs, 'new_projectsponsor');
      const fallbackMethodology = [
        { value: 100000000, label: 'Agile' },
        { value: 100000001, label: 'Waterfall' },
      ];
      setProjectFieldOptionMap({
        new_projectpriority: metaProjectPriority.length > 0 ? metaProjectPriority : fallbackProjectPriority,
        new_projecttype: metaProjectType.length > 0 ? metaProjectType : fallbackProjectType,
        new_strategicgoal: metaStrategicGoal.length > 0 ? metaStrategicGoal : fallbackStrategicGoal,
        [detectedProjectStatus]: metaProjectStatus.length > 0 ? metaProjectStatus : fallbackProjectStatus,
        [detectedProjectCategory]: metaProjectCategory,
        [detectedMethodology]: metaMethodology.length > 0 ? metaMethodology : fallbackMethodology,
        [detectedMilestone]: metaMilestone,
        [detectedSector]: metaSector,
        new_projectsponsor: metaProjectSponsor,
      });
      setProjectFieldTypeMap({
        new_projectpriority: attrTypeName(attrByLogical.get('new_projectpriority')),
        new_projecttype: attrTypeName(attrByLogical.get('new_projecttype')),
        new_strategicgoal: attrTypeName(attrByLogical.get('new_strategicgoal')),
        [detectedProjectStatus]: attrTypeName(attrByLogical.get(detectedProjectStatus.toLowerCase())),
        [detectedProjectCategory]: attrTypeName(attrByLogical.get(detectedProjectCategory.toLowerCase())),
        [detectedMethodology]: attrTypeName(attrByLogical.get(detectedMethodology.toLowerCase())),
        [detectedMilestone]: attrTypeName(attrByLogical.get(detectedMilestone.toLowerCase())),
        [detectedSector]: attrTypeName(attrByLogical.get(detectedSector.toLowerCase())),
        new_projectsponsor: attrTypeName(attrByLogical.get('new_projectsponsor')),
      });
      setProjectChoiceOptions({
        projectPriority: metaProjectPriority.length > 0 ? metaProjectPriority : fallbackProjectPriority,
        projectType: metaProjectType.length > 0 ? metaProjectType : fallbackProjectType,
        strategicGoal: metaStrategicGoal.length > 0 ? metaStrategicGoal : fallbackStrategicGoal,
        projectStatus: metaProjectStatus.length > 0 ? metaProjectStatus : fallbackProjectStatus,
        projectCategory: metaProjectCategory,
        methodology: metaMethodology.length > 0 ? metaMethodology : fallbackMethodology,
        projectSponsor: metaProjectSponsor,
      });

      if (!masterRes.success) throw new Error(masterRes.error?.message ?? 'Failed to load master data');
      const masterRows = (masterRes.data ?? []).filter((r) => isMasterActive(r));
      const getByCategory = (
        categoryCandidates: string[],
        categoryCodes: readonly number[] = [],
        allowPrefixFallback = false,
      ) => {
        const targetCats = categoryCandidates.map((c) => normalizeCategory(c));
        console.log(`ðŸ” getByCategory called with: ${categoryCandidates.join(', ')} â†’ normalized: ${targetCats.join(', ')}`);
        const typedRows = masterRows.filter((r) => {
          const explicitType = String(r.new_categorytype ?? '').trim();
          if (!explicitType) return false;
          const matches = targetCats.includes(normalizeCategory(explicitType));
          if (matches) console.log(`âœ… Matched row: ${explicitType} â†’ ${r.new_enjazmasterdata1}`);
          return matches;
        });
        console.log(`ðŸ“Š Found ${typedRows.length} typed rows for ${categoryCandidates.join(', ')}`);
        if (typedRows.length > 0) {
          const result = distinctSortedValues(typedRows.map((r) => String(r.new_enjazmasterdata1 ?? '').trim()));
          console.log(`âœ… Returning from typed rows: ${result.join(', ')}`);
          return result;
        }

        return distinctSortedValues(
          masterRows
            .filter((r) => {
              const rawCode = typeof r.new_category === 'number' ? r.new_category : Number(r.new_category ?? NaN);
              const hasCode = Number.isFinite(rawCode);
              const byCategoryCode = hasCode && categoryCodes.length > 0 && categoryCodes.includes(rawCode);
              const byCategoryName = (() => {
                const named = String(r.new_categoryname ?? '').trim();
                if (named) return targetCats.includes(normalizeCategory(named));
                const mapped = normalizeCategory(categoryFromMaster(r));
                return targetCats.includes(mapped);
              })();
              const code = String(r.new_uniqueid ?? '').trim();
              const byCodePrefix = allowPrefixFallback
                && (
                  (targetCats.includes(normalizeCategory('projectcategory')) && /^P\d+$/i.test(code))
                  || (targetCats.includes(normalizeCategory('sector')) && /^S\d+$/i.test(code))
                );

              // Prefer exact new_category code match when present.
              if (hasCode && categoryCodes.length > 0) return byCategoryCode;
              return byCategoryName || byCodePrefix;
            })
            .map((r) => String(r.new_enjazmasterdata1 ?? '').trim()),
        );
      };
      const programRows = programsRes.success ? (programsRes.data ?? []) : [];
      const budgetByProgram = new Map<string, number>();
      programRows.forEach((p) => {
        const name = String(p.new_name ?? '').trim();
        if (!name) return;
        budgetByProgram.set(
          normalizeProgramKey(name),
          readNumericBudget(p.crcf8_budget ?? (p as unknown as Record<string, unknown>).new_budget),
        );
      });
      setProgramBudgetByName(budgetByProgram);
      setProjectMasterOptions({
        program: programsRes.success
          ? distinctSortedValues(
            programRows
              .filter((p) => {
                const stateCode = Number(p.statecode ?? NaN);
                if (Number.isFinite(stateCode) && stateCode === 1) return false;
                const statusCode = Number(p.statuscode ?? NaN);
                if (Number.isFinite(statusCode) && statusCode === 2) return false;
                const statusText = String(p.new_statusname ?? '').toLowerCase();
                return !statusText.includes('inactive') && statusText !== 'completed';
              })
              .map((p) => String(p.new_name ?? '').trim()),
          )
          : [],
        projectCategory: distinctSortedValues([
          ...getByCategory(['projectcategory', 'project category'], [], true),
        ]),
        kpi: getByCategory(['kpi'], MASTER_CATEGORY_CODES.KPI),
        methodology: distinctSortedValues([
          ...getByCategory(['methodology', 'methodologymaster'], MASTER_CATEGORY_CODES.METHODOLOGY),
        ]),
        milestone: distinctSortedValues([
          ...getByCategory(['milestone'], MASTER_CATEGORY_CODES.MILESTONE),
        ]),
        sector: distinctSortedValues([
          ...getByCategory(['Sector'], MASTER_CATEGORY_CODES.SECTOR),
        ]),
      });

      const userRows = usersRes.success ? (usersRes.data ?? []) : [];
      const projectRoleUsers = userRows.filter((u) => String(u.new_role ?? '') === '100000003' || String(u.new_rolename ?? '').toLowerCase() === 'project');
      setProjectManagerEmails(
        Array.from(new Set(projectRoleUsers.map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim()).filter(Boolean))),
      );
      const activeUsers = userRows.filter((u) => String(u.new_status ?? '') === '100000000' || String(u.new_statusname ?? '').toLowerCase() === 'active');
      const sponsorRows = sponsorsRes.success ? ((sponsorsRes.data ?? []) as SponsorRow[]) : [];
      const sponsorActive = sponsorRows.filter((s) => {
        const n = Number(s.statecode);
        if (n === 1) return false;
        const name = String(s.statecodename ?? '').toLowerCase();
        if (name === 'inactive') return false;
        return true;
      });
      const fromSponsorTable = sponsorActive
        .map((s) => {
          const email = String(s.new_sponsormailid ?? '').trim();
          const name = String(s.new_sponsorname ?? '').trim();
          if (!email) return null;
          return { value: email, label: name ? `${name} (${email})` : email };
        })
        .filter((x): x is { label: string; value: string } => Boolean(x));
      const byEmail = new Map<string, { label: string; value: string }>();
      fromSponsorTable.forEach((o) => {
        if (!byEmail.has(o.value)) byEmail.set(o.value, o);
      });
      const sponsorOptionsList = Array.from(byEmail.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
      if (sponsorOptionsList.length > 0) {
        setProjectSponsorOptions(sponsorOptionsList);
      } else {
        setProjectSponsorOptions(
          Array.from(new Set(activeUsers.map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim()).filter(Boolean))).map((e) => ({
            value: e,
            label: e,
          })),
        );
      }
      const vendorRows = vendorsRes.success ? ((vendorsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [];
      const activeVendors = vendorRows.filter((v) => {
        const statusName = readFirstString(v, ['new_statusname', 'statusname', 'Status']).toLowerCase();
        const statusCode = readFirstString(v, ['new_status', 'status', 'StatusCode']);
        const appStatus = readFirstString(v, ['new_appstatus', 'appstatus', 'AppStatus']).toLowerCase();
        const stateCode = readFirstString(v, ['statecode', 'StateCode']);
        return statusName === 'active' || statusCode === '100000000' || appStatus === 'active' || stateCode === '0';
      });
      const byName = new Map<string, { label: string; value: string }>();
      activeVendors.forEach((v) => {
        const label = readFirstString(v, ['new_vendorname', 'vendorname', 'VendorName', 'Vendor Name']);
        const value = readFirstString(v, ['new_vendoremail', 'vendoremail', 'VendorEmail', 'Vendor Email']);
        if (!label || !value || byName.has(label)) return;
        byName.set(label, { label, value });
      });
      if (byName.size === 0) {
        vendorRows.forEach((v) => {
          const label = readFirstString(v, ['new_vendorname', 'vendorname', 'VendorName', 'Vendor Name']);
          const value = readFirstString(v, ['new_vendoremail', 'vendoremail', 'VendorEmail', 'Vendor Email']);
          if (!label || !value || byName.has(label)) return;
          byName.set(label, { label, value });
        });
      }
      setVendorOptions(Array.from(byName.values()));
    } catch (error) {
      onToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load project form data' });
    } finally {
      setProjectMetaLoading(false);
    }
  };

  const clearProjectForm = () => {
    setProjectForm({
      projectName: '',
      programName: '',
      vendorName: '',
      projectPriority: '',
      projectCategory: '',
      projectType: '',
      strategicGoal: '',
      budget: '',
      assignToProjectManager: '',
      risks: '',
      kpi: '',
      methodology: '',
      startDate: todayIso,
      endDate: todayIso,
      department: '',
      projectStatus: '',
      milestone: [],
      projectSponsor: '',
      note: '',
      attachments: [],
    });
    setProjectFormErrors({});
  };

  const openProjectFilesModal = async (row: Record<string, unknown>) => {
    const attachmentId = String(row.crcf8_attachmentid ?? '').trim();
    const projectName = String(row.new_projectname ?? row.new_name ?? 'Project').trim() || 'Project';

    setProjectFilesModal({ projectId: attachmentId || 'none', projectName });
    setProjectFilesRows([]);
    setProjectFilesLoading(true);

    try {
      if (!attachmentId) {
        setProjectFilesRows([]);
        return;
      }

      const files = await fetchAttachments(attachmentId);
      setProjectFilesRows(files);
    } catch (error) {
      onToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load project files' });
      setProjectFilesRows([]);
    } finally {
      setProjectFilesLoading(false);
    }
  };

  useEffect(() => {
    if (projectForm.milestone.length === 0) return;
    const allowed = new Set(projectMasterOptions.milestone);
    const filtered = projectForm.milestone.filter((m) => allowed.has(m));
    if (filtered.length !== projectForm.milestone.length) {
      setProjectForm((f) => ({ ...f, milestone: filtered }));
    }
  }, [projectForm.milestone, projectMasterOptions.milestone]);

  const loadProjectRows = async () => {
    if (isExternal) return;
    setProjectRowsLoading(true);
    try {
      const res = await New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load projects');
      setProjectRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
    } catch (error) {
      onToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load projects' });
    } finally {
      setProjectRowsLoading(false);
    }
  };

  useEffect(() => {
    if (externalProjectRows === undefined) return;
    setProjectRows(externalProjectRows.rows);
    setProjectRowsLoading(!!externalProjectRows.loading);
  }, [externalProjectRows?.rows, externalProjectRows?.loading]);

  const saveProject = async () => {
    const req: Record<string, string> = {};
    if (!projectForm.projectName.trim()) req.projectName = 'Project Name is required';
    if (!projectForm.programName) req.programName = 'Program Name is required';
    if (!projectForm.vendorName.trim()) req.vendorName = 'Vendor Name is required';
    if (!projectForm.projectPriority) req.projectPriority = 'Project Priority is required';
    if (!projectForm.projectCategory) req.projectCategory = 'Project Category is required';
    if (!projectForm.projectType) req.projectType = 'Project Type is required';
    if (!projectForm.strategicGoal) req.strategicGoal = 'Strategic Goal is required';
    if (!projectForm.budget.trim()) req.budget = 'Budget is required';
    else if (!/^\d+(\.\d+)?$/.test(projectForm.budget.trim())) req.budget = 'Budget must be numbers only';
    if (!projectForm.assignToProjectManager) req.assignToProjectManager = 'Project Manager is required';
    if (!projectForm.risks.trim()) req.risks = 'Risks is required';
    if (!projectForm.methodology) req.methodology = 'Methodology is required';
    if (!projectForm.startDate) req.startDate = 'Start Date is required';
    if (!projectForm.endDate) req.endDate = 'End Date is required';
    if (projectForm.startDate && projectForm.startDate < todayIso) req.startDate = 'Start Date cannot be in the past';
    if (projectForm.endDate && projectForm.endDate < todayIso) req.endDate = 'End Date cannot be in the past';
    if (projectForm.startDate && projectForm.endDate && projectForm.endDate < projectForm.startDate) req.endDate = 'End Date should be after Start Date';
    if (!projectForm.department) req.department = 'Department is required';
    if (!projectForm.projectStatus) req.projectStatus = 'Project Status is required';
    if (projectForm.milestone.length === 0) req.milestone = 'Milestone is required';
    if (!projectForm.projectSponsor) req.projectSponsor = 'Project Sponsor is required';
    setProjectFormErrors(req);
    if (Object.keys(req).length > 0) return;

    const latestProjectsRes = await New_projectsService.getAll({ top: 5000, orderBy: ['createdon desc'] });
    const latestRows = latestProjectsRes.success
      ? ((latestProjectsRes.data ?? []) as unknown as Array<Record<string, unknown>>)
      : projectRows;

    const budgetProgramErr = validateProjectBudgetAgainstProgram({
      programName: projectForm.programName,
      proposedBudget: projectForm.budget,
      programBudgetByName,
      projectRows: latestRows,
    });
    if (budgetProgramErr) {
      setProjectFormErrors({ budget: budgetProgramErr });
      return;
    }

    const normalizeChoiceLabel = (value: string) => value.toLowerCase().replace(/[\s_\-]+/g, '');
    const toChoice = (options: Array<{ label: string; value: number }>, label: string) =>
      options.find((o) => normalizeChoiceLabel(o.label) === normalizeChoiceLabel(label))?.value;

    const coerceByFieldType = (logicalName: string, input: string) => {
      const type = (projectFieldTypeMap[logicalName] ?? '').toLowerCase();
      const options = projectFieldOptionMap[logicalName] ?? [];
      if (type.includes('picklist') || type.includes('integer') || type.includes('int32')) {
        const matched = toChoice(options, input);
        if (matched !== undefined) return matched;
        const numeric = Number(input);
        if (!Number.isNaN(numeric)) return numeric;
      }
      return input;
    };

    const effectiveNote = (projectForm.note || '').trim();

    const generatedProjectId = computeNextProjectId(latestRows);
    const generatedRowGuid = globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;

    const payload: Record<string, unknown> = {
      // Dataverse schema: new_name => "Project ID" (text), new_projectid => "ID" (Guid).
      new_name: generatedProjectId,
      new_projectid: generatedRowGuid,
      crcf8_attachmentid: generatedRowGuid,
      [projectTextColumns.projectName]: projectForm.projectName.trim(),
      [projectTextColumns.vendor]: projectForm.vendorName.trim(),
      [projectTextColumns.budget]: Number(projectForm.budget.trim()),
      crcf8_note: effectiveNote || undefined,
      [projectTextColumns.startDate]: new Date(projectForm.startDate).toISOString(),
      [projectTextColumns.endDate]: new Date(projectForm.endDate).toISOString(),
    };
    const hasColumn = (logicalName: string) => projectAvailableColumns.includes(logicalName.toLowerCase());
    payload.crcf8_programname = projectForm.programName;
    payload.new_projectpriority = Number(projectForm.projectPriority);
    payload.new_projecttype = Number(projectForm.projectType);
    payload.new_strategicgoal = Number(projectForm.strategicGoal);
    payload.crcf8_risks = projectForm.risks.trim();
    payload.crcf8_projectmanager = projectForm.assignToProjectManager;
    payload.new_kpi = projectForm.kpi;
    payload.new_projectcategory = projectForm.projectCategory;
    payload.new_methodology = coerceByFieldType('new_methodology', projectForm.methodology);
    payload.new_sector = projectForm.department;
    payload.crcf8_milestone = projectForm.milestone.join(', ');
    payload.new_projectstatus = Number(projectForm.projectStatus);
    if (!hasColumn(projectTextColumns.projectCategory) && hasColumn(projectChoiceColumns.projectCategory)) payload[projectChoiceColumns.projectCategory] = coerceByFieldType(projectChoiceColumns.projectCategory, projectForm.projectCategory);
    if (!hasColumn(projectTextColumns.methodology) && hasColumn(projectChoiceColumns.methodology)) payload[projectChoiceColumns.methodology] = coerceByFieldType(projectChoiceColumns.methodology, projectForm.methodology);
    payload.crcf8_projectsponsor = projectForm.projectSponsor;

    setProjectFormBusy(true);
    try {
      // Create project with attachment ID
      const res = await New_projectsService.create(payload as Parameters<typeof New_projectsService.create>[0]);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create project');

      // Send email notification for new project
      const projectManagerEmail = projectForm.assignToProjectManager?.trim();
      if (projectManagerEmail && projectManagerEmail.includes('@')) {
        const emailTemplate = generateEmailTemplate(
          'New Project Created',
          'Dear Project Manager,',
          'A new project has been successfully created in the system. Please review the details below and take necessary actions.',
          [
            { label: 'Project Name', value: projectForm.projectName },
            { label: 'Program', value: projectForm.programName },
            { label: 'Status', value: 'Active' },
            { label: 'Start Date', value: projectForm.startDate },
            { label: 'End Date', value: projectForm.endDate },
            { label: 'Budget', value: projectForm.budget || '-' },
            { label: 'Department', value: projectForm.department || '-' },
          ],
        );

        sendEmailNotification({
          toEmail: projectManagerEmail,
          subject: `New Project Created: ${projectForm.projectName}`,
          htmlBody: emailTemplate,
        }).catch((err) => {
          console.error('Failed to send project creation email:', err);
        });
      }

      // Upload attachments if any
      let uploadMessage = '';
      if (projectForm.attachments.length > 0) {
        const uploadRes = await uploadAttachments(generatedRowGuid, projectForm.attachments);

        if (uploadRes.uploaded.length > 0) {
          uploadMessage = `${uploadRes.uploaded.length} file(s) uploaded.`;
        }
        if (uploadRes.errors.length > 0) {
          onToast({
            type: 'info',
            message: `Project saved. ${uploadRes.errors[0] || 'Attachment issue'}`,
          });
        }
      }


      setShowAddProjectForm(false);
      clearProjectForm();
      if (isExternal) onExternalDataInvalidate?.();
      else void loadProjectRows();
      onToast({ type: 'success', message: uploadMessage ? `Project created successfully. ${uploadMessage}` : 'Project created successfully.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create project';
      onToast({ type: 'error', message: msg });
    } finally {
      setProjectFormBusy(false);
    }
  };

  /** Load board data on mount (Program / Project roles). Previously rows only loaded when opening New Project. */
  useEffect(() => {
    if (isExternal) return;
    void loadProjectRows();
  }, [isExternal]);

  useEffect(() => {
    if (showAddProjectForm) {
      void loadProjectFormData();
    }
  }, [showAddProjectForm]);

  /** Lock document scroll â€” only the add/edit project panel scrolls; full-bleed gray canvas. */
  useEffect(() => {
    const fullPageFormOpen = showAddProjectForm || Boolean(editProjectRow);
    if (!fullPageFormOpen) return;
    const html = document.documentElement;
    const { body } = document;
    const main = document.querySelector('main');
    html.classList.add('enj-add-project-active');
    body.classList.add('enj-add-project-active');
    main?.classList.add('enj-add-project-main');
    return () => {
      html.classList.remove('enj-add-project-active');
      body.classList.remove('enj-add-project-active');
      main?.classList.remove('enj-add-project-main');
    };
  }, [showAddProjectForm, editProjectRow]);

  const projectStatusCol = projectChoiceColumns.projectStatus;

  const boardProjectsByStatus = useMemo(() => {
    const acc = projectBoardColumns.reduce<Record<string, Array<Record<string, unknown>>>>((a, column) => {
      a[column.title] = [];
      return a;
    }, {});
    const readProjectStatusLabel = (row: Record<string, unknown>) => {
      const named = String(row.new_projectstatusname ?? row[`${projectStatusCol}name`] ?? '').trim();
      if (named) return named.toLowerCase();
      const raw = Number(row.new_projectstatus ?? row[projectStatusCol] ?? NaN);
      const dynamic = projectChoiceOptions.projectStatus.find((s) => s.value === raw)?.label;
      if (dynamic) return dynamic.toLowerCase();
      const fallback = New_projectsnew_projectstatus[raw as keyof typeof New_projectsnew_projectstatus];
      return String(fallback ?? '').toLowerCase();
    };
    projectRows.forEach((row) => {
      const status = readProjectStatusLabel(row);
      if (status.includes('tostart') || status.includes('to start') || status.includes('planned')) {
        acc['To Start'].push(row);
      } else if (status.includes('ontrack') || status.includes('on track') || status.includes('active')) {
        acc['On Track'].push(row);
      } else if (status.includes('delay')) {
        acc.Delayed.push(row);
      } else if (status.includes('complete')) {
        acc.Completed.push(row);
      } else {
        acc['To Start'].push(row);
      }
    });
    return acc;
  }, [projectRows, projectChoiceOptions.projectStatus, projectStatusCol]);

  const openProjectQuickEdit = async (row: Record<string, unknown>) => {
    const id = String(row.new_projectid ?? '').trim();
    if (!id) {
      onToast({ type: 'error', message: 'Project ID is missing; cannot edit.' });
      return;
    }
    setEditProjectErrors({});
    setEditProjectRow(row);
    setEditProjectPopulateFrom(row);
    try {
      await loadProjectFormData();
    } catch {
      onToast({ type: 'error', message: 'Failed to load form options.' });
      setEditProjectRow(null);
      setEditProjectPopulateFrom(null);
    }
  };

  useEffect(() => {
    if (!editProjectPopulateFrom || projectMetaLoading) return;
    const row = editProjectPopulateFrom;
    const handle = window.setTimeout(() => {
      const pickFromNumericOptionsStrict = (raw: unknown, options: Array<{ label: string; value: number }>) => {
        const n = Number(raw);
        if (!Number.isFinite(n) || options.length === 0) return '';
        return options.some((o) => o.value === n) ? String(n) : '';
      };

      const categoryName = String(row.new_projectcategoryname ?? '').trim();
      const projectCategory =
        projectMasterOptions.projectCategory.length > 0
          ? projectMasterOptions.projectCategory.includes(categoryName)
            ? categoryName
            : (projectMasterOptions.projectCategory[0] ?? '')
          : categoryName;
      const methodologyName = String(row.new_methodologyname ?? '').trim();
      const methodology =
        projectMasterOptions.methodology.length > 0
          ? projectMasterOptions.methodology.includes(methodologyName)
            ? methodologyName
            : (projectMasterOptions.methodology[0] ?? '')
          : methodologyName;
      const statusRaw = Number(row.new_projectstatus ?? row[projectStatusCol] ?? NaN);
      const stOpt = projectChoiceOptions.projectStatus.find((o) => o.value === statusRaw);
      const projectStatus = String(
        stOpt?.value ?? (Number.isFinite(statusRaw) ? statusRaw : 100000000),
      );
      const rawM = String(
        row.crcf8_milestone ?? row.new_milestone ?? row[projectTextColumns.milestone] ?? '',
      )
        .trim();
      const milestoneParts = rawM
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const opts = projectMasterOptions.milestone;
      const milestone =
        opts.length > 0
          ? distinctSortedValues(
            milestoneParts.map((m) => canonicalMasterOptionLabel(m, opts) ?? m),
          )
          : milestoneParts;

      const programNameRaw = String(row.crcf8_programname ?? row.new_programname ?? '').trim();
      const programName = (() => {
        if (!programNameRaw) return '';
        if (projectMasterOptions.program.length === 0) return programNameRaw;
        if (projectMasterOptions.program.includes(programNameRaw)) return programNameRaw;
        return projectMasterOptions.program[0] ?? programNameRaw;
      })();

      const fromRowVendor = String(row.new_clientname ?? '').trim();
      const vendorName =
        vendorOptions.find((o) => o.value === fromRowVendor)?.value
        ?? vendorOptions.find((o) => o.label === fromRowVendor)?.value
        ?? fromRowVendor;

      const rawBudget = row.new_budget;
      const budget =
        rawBudget != null && String(rawBudget).trim() !== '' && Number.isFinite(Number(rawBudget))
          ? String(Number(rawBudget))
          : '';

      const projectPriority = pickFromNumericOptionsStrict(
        row.new_projectpriority,
        projectChoiceOptions.projectPriority,
      );
      const projectType = pickFromNumericOptionsStrict(
        row.new_projecttype,
        projectChoiceOptions.projectType,
      );
      const strategicGoal = pickFromNumericOptionsStrict(
        row.new_strategicgoal,
        projectChoiceOptions.strategicGoal,
      );

      const risks = String(
        row.crcf8_risks ?? row[projectTextColumns.risks] ?? row.new_risks ?? '',
      ).trim();

      const kpiName = String(row.new_kpi ?? '').trim();
      const kpi = (() => {
        if (!kpiName) return '';
        if (projectMasterOptions.kpi.length === 0) return kpiName;
        return projectMasterOptions.kpi.includes(kpiName) ? kpiName : (projectMasterOptions.kpi[0] ?? kpiName);
      })();

      const pm = String(
        row.crcf8_projectmanager ?? row[projectTextColumns.assignPm] ?? row.new_programmanager ?? '',
      ).trim();
      const assignToProjectManager =
        pm && projectManagerEmails.includes(pm)
          ? pm
          : (projectManagerEmails[0] ?? pm);

      const sectorName = String(row.new_sectorname ?? row.new_sector ?? '').trim();
      const department =
        sectorName && projectMasterOptions.sector.length > 0
          ? projectMasterOptions.sector.includes(sectorName)
            ? sectorName
            : (projectMasterOptions.sector[0] ?? '')
          : sectorName;

      const sp = String(row.crcf8_projectsponsor ?? '').trim();
      const projectSponsor = sp
        ? (projectSponsorOptions.some((o) => o.value === sp) ? sp : sp)
        : '';

      const note = String(row.crcf8_note ?? row.new_note ?? '').trim();

      (async () => {
        let existingAttachments: AttachmentFile[] = [];
        const attachmentId = String(row.crcf8_attachmentid ?? '').trim();
        if (attachmentId) {
          try {
            existingAttachments = await fetchAttachments(attachmentId);
          } catch (error) {
            console.error('Failed to load existing attachments:', error);
          }
        }

        setEditProjectForm({
          projectName: String(row.new_projectname ?? row.new_name ?? '').trim(),
          programName,
          vendorName,
          projectPriority,
          projectType,
          strategicGoal,
          budget,
          assignToProjectManager,
          risks,
          kpi,
          methodology,
          startDate: toYmdForInput(row.new_startdate, todayIso),
          endDate: toYmdForInput(row.new_enddate, todayIso),
          department,
          projectStatus,
          milestone,
          projectSponsor,
          note,
          attachments: [],
          existingAttachments,
          description: String(row.new_description ?? row.crcf8_description ?? '').trim(),
          progress: String(readProjectRowProgress(row)),
          projectCategory,
        });
        setEditProjectPopulateFrom(null);
      })();
    }, 0);
    return () => {
      window.clearTimeout(handle);
    };
  }, [
    editProjectPopulateFrom,
    projectMetaLoading,
    projectMasterOptions,
    projectChoiceOptions,
    projectStatusCol,
    projectTextColumns,
    todayIso,
    vendorOptions,
    projectSponsorOptions,
    projectManagerEmails,
  ]);

  const closeProjectQuickEdit = () => {
    setEditProjectRow(null);
    setEditProjectPopulateFrom(null);
    setEditProjectForm(createEmptyEditProjectForm());
    setEditMilestoneMenuOpen(false);
    setEditProjectErrors({});
  };

  const saveProjectQuickEdit = async () => {
    if (!editProjectRow) return;
    const id = String(editProjectRow.new_projectid ?? '').trim();
    if (!id) {
      onToast({ type: 'error', message: 'Project ID is missing.' });
      return;
    }
    const err: Record<string, string> = {};
    if (!editProjectForm.projectName.trim()) err.projectName = 'Project Name is required';
    if (!editProjectForm.programName) err.programName = 'Program Name is required';
    if (!editProjectForm.vendorName.trim()) err.vendorName = 'Vendor Name is required';
    if (!editProjectForm.projectPriority) err.projectPriority = 'Project Priority is required';
    if (!editProjectForm.projectCategory) err.projectCategory = 'Project Category is required';
    if (!editProjectForm.projectType) err.projectType = 'Project Type is required';
    if (!editProjectForm.strategicGoal) err.strategicGoal = 'Strategic Goal is required';
    if (!editProjectForm.budget.trim()) err.budget = 'Budget is required';
    else if (!/^\d+(\.\d+)?$/.test(editProjectForm.budget.trim())) err.budget = 'Budget must be numbers only';
    if (!editProjectForm.assignToProjectManager) err.assignToProjectManager = 'Project Manager is required';
    if (!editProjectForm.risks.trim()) err.risks = 'Risks is required';
    if (!editProjectForm.methodology) err.methodology = 'Methodology is required';
    if (!editProjectForm.startDate) err.startDate = 'Start Date is required';
    if (!editProjectForm.endDate) err.endDate = 'End Date is required';
    if (editProjectForm.startDate && editProjectForm.endDate && editProjectForm.endDate < editProjectForm.startDate) {
      err.endDate = 'End Date should be on or after Start Date';
    }
    if (!editProjectForm.department) err.department = 'Department is required';
    if (!editProjectForm.projectStatus) err.projectStatus = 'Project Status is required';
    if (editProjectForm.milestone.length === 0) err.milestone = 'Milestone is required';
    if (!editProjectForm.projectSponsor) err.projectSponsor = 'Project Sponsor is required';
    const pNum = Number(editProjectForm.progress);
    if (editProjectForm.progress.trim() === '' || Number.isNaN(pNum)) err.progress = 'Progress (%) is required';
    else if (pNum < 0 || pNum > 100) err.progress = 'Progress must be between 0 and 100';
    setEditProjectErrors(err);
    if (Object.keys(err).length > 0) return;

    const latestProjectsRes = await New_projectsService.getAll({ top: 5000, orderBy: ['createdon desc'] });
    const latestRows = latestProjectsRes.success
      ? ((latestProjectsRes.data ?? []) as unknown as Array<Record<string, unknown>>)
      : projectRows;
    const budgetProgramErr = validateProjectBudgetAgainstProgram({
      programName: editProjectForm.programName,
      proposedBudget: editProjectForm.budget,
      programBudgetByName,
      projectRows: latestRows,
      excludeProjectId: id,
    });
    if (budgetProgramErr) {
      setEditProjectErrors({ budget: budgetProgramErr });
      return;
    }

    const effectiveNote = (editProjectForm.note || '').trim();
    const normalizeChoiceLabel = (value: string) => value.toLowerCase().replace(/[\s_\-]+/g, '');
    const toChoice = (options: Array<{ label: string; value: number }>, label: string) =>
      options.find((o) => normalizeChoiceLabel(o.label) === normalizeChoiceLabel(label))?.value;
    const coerceByFieldType = (logicalName: string, input: string) => {
      const type = (projectFieldTypeMap[logicalName] ?? '').toLowerCase();
      const options = projectFieldOptionMap[logicalName] ?? [];
      if (type.includes('picklist') || type.includes('integer') || type.includes('int32')) {
        const matched = toChoice(options, input);
        if (matched !== undefined) return matched;
        const numeric = Number(input);
        if (!Number.isNaN(numeric)) return numeric;
      }
      return input;
    };
    const hasColumn = (logicalName: string) => projectAvailableColumns.includes(logicalName.toLowerCase());
    const milestoneJoined = editProjectForm.milestone.join(', ');

    const payload: Record<string, unknown> = {
      [projectTextColumns.projectName]: editProjectForm.projectName.trim(),
      [projectTextColumns.vendor]: editProjectForm.vendorName.trim(),
      [projectTextColumns.budget]: Number(editProjectForm.budget.trim()),
      crcf8_note: effectiveNote || undefined,
      [projectTextColumns.startDate]: new Date(editProjectForm.startDate).toISOString(),
      [projectTextColumns.endDate]: new Date(editProjectForm.endDate).toISOString(),
      new_description: editProjectForm.description.trim(),
      new_progress: Math.round(pNum),
    };
    payload.crcf8_programname = editProjectForm.programName;
    payload.new_projectpriority = Number(editProjectForm.projectPriority);
    payload.new_projecttype = Number(editProjectForm.projectType);
    payload.new_strategicgoal = Number(editProjectForm.strategicGoal);
    payload.crcf8_risks = editProjectForm.risks.trim();
    payload.crcf8_projectmanager = editProjectForm.assignToProjectManager;
    payload.new_kpi = editProjectForm.kpi;
    payload.new_projectcategory = editProjectForm.projectCategory;
    payload.new_methodology = coerceByFieldType(projectChoiceColumns.methodology, editProjectForm.methodology);
    payload.new_sector = editProjectForm.department;
    payload.crcf8_milestone = milestoneJoined;
    payload.new_projectstatus = Number(editProjectForm.projectStatus);
    if (!hasColumn(projectTextColumns.projectCategory) && hasColumn(projectChoiceColumns.projectCategory)) {
      payload[projectChoiceColumns.projectCategory] = coerceByFieldType(
        projectChoiceColumns.projectCategory,
        editProjectForm.projectCategory,
      );
    }
    if (!hasColumn(projectTextColumns.methodology) && hasColumn(projectChoiceColumns.methodology)) {
      payload[projectChoiceColumns.methodology] = coerceByFieldType(
        projectChoiceColumns.methodology,
        editProjectForm.methodology,
      );
    }
    payload.crcf8_projectsponsor = editProjectForm.projectSponsor;
    if (hasColumn(String(projectTextColumns.milestone).toLowerCase())) {
      (payload as Record<string, unknown>)[projectTextColumns.milestone] = milestoneJoined;
    }

    setEditProjectBusy(true);
    try {
      const res = await New_projectsService.update(
        id,
        payload as Parameters<typeof New_projectsService.update>[1],
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');

      // Upload attachments if any
      let uploadMessage = '';
      if (editProjectForm.attachments.length > 0) {
        const uploadRes = await uploadAttachments(id, editProjectForm.attachments);

        if (uploadRes.uploaded.length > 0) {
          uploadMessage = `${uploadRes.uploaded.length} file(s) uploaded.`;
        }
        if (uploadRes.errors.length > 0) {
          onToast({
            type: 'info',
            message: `Project saved. ${uploadRes.errors[0] || 'Attachment issue'}`,
          });
        }
      }

      onToast({
        type: 'success',
        message: uploadMessage ? `Project updated. ${uploadMessage}` : 'Project updated.',
      });
      closeProjectQuickEdit();
      if (isExternal) onExternalDataInvalidate?.();
      else void loadProjectRows();
    } catch (e) {
      onToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to update project' });
    } finally {
      setEditProjectBusy(false);
    }
  };

  return (
    <>
  {agileSprintProject ? (
    <AgileSprintPanel
      project={agileSprintProject}
      onBack={() => setAgileSprintProject(null)}
      onNotify={onToast}
    />
  ) : waterfallSprintProject ? (
    <WaterfallSprintPanel
      project={waterfallSprintProject}
      onBack={() => setWaterfallSprintProject(null)}
      onNotify={onToast}
    />
  ) : editProjectRow ? (
    <ProjectEditFormPanel
      form={editProjectForm}
      setForm={setEditProjectForm}
      errors={editProjectErrors}
      budgetProgramError={editProjectBudgetProgramError}
      metaLoading={projectMetaLoading}
      busy={editProjectBusy}
      onCancel={closeProjectQuickEdit}
      onSave={() => void saveProjectQuickEdit()}
      milestoneOpen={editMilestoneMenuOpen}
      setMilestoneOpen={setEditMilestoneMenuOpen}
      milestoneOptions={editMilestoneSelectOptions}
      programOptions={projectMasterOptions.program}
      vendorOptions={vendorOptions}
      projectPriorityOptions={projectChoiceOptions.projectPriority}
      projectCategoryOptions={projectMasterOptions.projectCategory}
      projectTypeOptions={projectChoiceOptions.projectType}
      strategicGoalOptions={projectChoiceOptions.strategicGoal}
      projectStatusOptions={projectChoiceOptions.projectStatus}
      kpiOptions={projectMasterOptions.kpi}
      methodologyOptions={projectMasterOptions.methodology}
      departmentOptions={projectMasterOptions.sector}
      projectManagerEmails={projectManagerEmails}
      projectSponsorOptions={projectSponsorOptions}
      fileInputRef={editProjectFileInputRef}
    />
  ) : showAddProjectForm ? (
    <div className="enj-add-project-root">
      <div className="enj-add-project-scroll">
        <div className="enj-add-project-shell">
          <section className="enj-add-project-card">
      <p className="enj-add-project-breadcrumb">
        <button type="button" onClick={() => setShowAddProjectForm(false)}>Projects</button>
        {' > '}Add New Project
      </p>
      {projectMetaLoading && <p className="enj-add-project-muted mb-3">Loading dropdown values...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <AddProjectFieldLabel label="Project Name" required />
          <input className={`enj-add-project-field mt-1 ${enj.control}`} placeholder="Enter Project Name" value={projectForm.projectName} onChange={(e) => setProjectForm((f) => ({ ...f, projectName: e.target.value }))} />
          {projectFormErrors.projectName && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectName}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Program Name" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.programName} onChange={(e) => setProjectForm((f) => ({ ...f, programName: e.target.value }))}>
            <option value="">Select Program Name</option>
            {projectMasterOptions.program.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {projectFormErrors.programName && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.programName}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Vendor Name" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.vendorName} onChange={(e) => setProjectForm((f) => ({ ...f, vendorName: e.target.value }))}>
            <option value="">Select Vendor Name</option>
            {vendorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {projectFormErrors.vendorName && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.vendorName}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Project Priority" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.projectPriority} onChange={(e) => setProjectForm((f) => ({ ...f, projectPriority: e.target.value }))}>
            <option value="">Select Project Priority</option>
            {projectChoiceOptions.projectPriority.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
          </select>
          {projectFormErrors.projectPriority && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectPriority}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Project Category" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.projectCategory} onChange={(e) => setProjectForm((f) => ({ ...f, projectCategory: e.target.value }))}>
            <option value="">Select Project Category</option>
            {projectMasterOptions.projectCategory.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {projectFormErrors.projectCategory && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectCategory}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Project Type" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.projectType} onChange={(e) => setProjectForm((f) => ({ ...f, projectType: e.target.value }))}>
            <option value="">Select Project Type</option>
            {projectChoiceOptions.projectType.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
          </select>
          {projectFormErrors.projectType && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectType}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Strategic Goal" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.strategicGoal} onChange={(e) => setProjectForm((f) => ({ ...f, strategicGoal: e.target.value }))}>
            <option value="">Select Strategic Goal</option>
            {projectChoiceOptions.strategicGoal.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
          </select>
          {projectFormErrors.strategicGoal && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.strategicGoal}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Budget" required />
          <div className="enj-add-project-budget-wrap mt-1 flex h-9 overflow-hidden rounded-md border border-[#ADACB4] bg-white">
            <input className="enj-add-project-budget-input h-full min-h-0 flex-1 border-0 bg-transparent px-3 outline-none focus:outline-none focus:ring-0" placeholder="Enter Budget" value={projectForm.budget} inputMode="decimal" onChange={(e) => {
              const next = e.target.value;
              if (/^\d*\.?\d*$/.test(next)) setProjectForm((f) => ({ ...f, budget: next }));
            }} />
            <span className="enj-add-project-muted w-12 border-l border-[#ADACB4] flex items-center justify-center">AED</span>
          </div>
          {(projectFormErrors.budget || createProjectBudgetProgramError) && (
            <p className={`mt-1 ${enj.fieldError}`}>
              {projectFormErrors.budget || createProjectBudgetProgramError}
            </p>
          )}
        </div>
        <div>
          <AddProjectFieldLabel label="Assign to Project Manager" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.assignToProjectManager} onChange={(e) => setProjectForm((f) => ({ ...f, assignToProjectManager: e.target.value }))}>
            <option value="">Select Project Manager</option>
            {projectManagerEmails.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {projectFormErrors.assignToProjectManager && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.assignToProjectManager}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Risks" required />
          <input className={`enj-add-project-field mt-1 ${enj.control}`} placeholder="Enter Risks" value={projectForm.risks} onChange={(e) => setProjectForm((f) => ({ ...f, risks: e.target.value }))} />
          {projectFormErrors.risks && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.risks}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="KPI" />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.kpi} onChange={(e) => setProjectForm((f) => ({ ...f, kpi: e.target.value }))}>
            <option value="">Select KPI</option>
            {projectMasterOptions.kpi.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <AddProjectFieldLabel label="Methodology" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.methodology} onChange={(e) => setProjectForm((f) => ({ ...f, methodology: e.target.value }))}>
            <option value="">Select Methodology</option>
            {projectMasterOptions.methodology.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {projectFormErrors.methodology && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.methodology}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Start Date" required />
          <DatePickerField min={todayIso} className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.startDate} onChange={(v) => setProjectForm((f) => ({ ...f, startDate: v }))} />
          {projectFormErrors.startDate && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.startDate}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="End Date" required />
          <DatePickerField min={projectForm.startDate || todayIso} className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.endDate} onChange={(v) => setProjectForm((f) => ({ ...f, endDate: v }))} />
          {projectFormErrors.endDate && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.endDate}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Department" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.department} onChange={(e) => setProjectForm((f) => ({ ...f, department: e.target.value }))}>
            <option value="">Select Department</option>
            {projectMasterOptions.sector.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {projectFormErrors.department && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.department}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Project Status" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.projectStatus} onChange={(e) => setProjectForm((f) => ({ ...f, projectStatus: e.target.value }))}>
            <option value="">Select Project Status</option>
            {projectChoiceOptions.projectStatus.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
          </select>
          {projectFormErrors.projectStatus && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectStatus}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Milestone" required />
          <div className="mt-1 relative">
            <button
              type="button"
              className={`enj-add-project-combo ${enj.btn} ${enj.btnDefault} w-full max-w-full justify-start text-left font-normal ${projectForm.milestone.length === 0 ? 'enj-add-project-combo--empty' : ''}`}
              onClick={() => setMilestoneMenuOpen((v) => !v)}
            >
              {projectForm.milestone.length > 0 ? projectForm.milestone.join(', ') : 'Select Milestone(s)'}
            </button>
            {milestoneMenuOpen && (
              <div className="enj-add-project-milestone-menu absolute z-20 mt-1 w-full max-h-44 overflow-auto rounded-md p-2">
                {projectMasterOptions.milestone.length === 0 ? (
                  <p className="enj-add-project-muted px-1 py-1">No milestones available.</p>
                ) : (
                  projectMasterOptions.milestone.map((opt) => {
                    const checked = projectForm.milestone.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 py-1 font-normal text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setProjectForm((f) => ({
                              ...f,
                              milestone: checked ? f.milestone.filter((m) => m !== opt) : [...f.milestone, opt],
                            }));
                            setMilestoneMenuOpen(false);
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {projectFormErrors.milestone && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.milestone}</p>}
        </div>
        <div>
          <AddProjectFieldLabel label="Project Sponsor" required />
          <select className={`enj-add-project-field mt-1 ${enj.control}`} value={projectForm.projectSponsor} onChange={(e) => setProjectForm((f) => ({ ...f, projectSponsor: e.target.value }))}>
            <option value="">Select Project Sponsor</option>
            {projectSponsorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {projectFormErrors.projectSponsor && <p className={`mt-1 ${enj.fieldError}`}>{projectFormErrors.projectSponsor}</p>}
        </div>
        <div className="md:col-span-2">
          <AddProjectFieldLabel label="Attachments" />
          <input
            ref={projectFormFileInputRef}
            type="file"
            className="sr-only"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                const newFiles = Array.from(files);
                setProjectForm((f) => ({ ...f, attachments: [...f.attachments, ...newFiles] }));
                e.target.value = '';
              }
            }}
          />
          <div className="enj-add-project-attachments rounded-lg border border-[#ADACB4] bg-white p-4">
            {projectForm.attachments.length === 0 ? (
              <div className="text-center">
                <p className="enj-add-project-muted mb-3">There is nothing attached.</p>
                <button
                  type="button"
                  onClick={() => projectFormFileInputRef.current?.click()}
                  disabled={projectFormBusy}
                  className="inline-flex items-center gap-2 font-normal hover:opacity-80 disabled:opacity-50"
                  style={{ color: '#A08149' }}
                >
                  <Paperclip size={16} />
                  Attach file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="enj-add-project-muted mb-2 font-normal text-gray-600">Files to upload</p>
                  <ul className="space-y-1">
                    {projectForm.attachments.map((file) => (
                      <li key={file.name} className="flex items-center justify-between gap-2 font-normal text-gray-700">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="enj-add-project-muted shrink-0 hover:underline text-rose-600"
                          disabled={projectFormBusy}
                          onClick={() => setProjectForm((f) => ({ ...f, attachments: f.attachments.filter((x) => x.name !== file.name) }))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => projectFormFileInputRef.current?.click()}
                    disabled={projectFormBusy}
                    className="inline-flex items-center gap-2 font-normal hover:opacity-80 disabled:opacity-50"
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

      <div className="mt-4">
        <AddProjectFieldLabel label="Note / Remark" />
        <textarea className={`enj-add-project-field ${enj.textarea} mt-1 h-24 min-h-24 resize-y font-normal`} placeholder="Enter Note / Remark" value={projectForm.note} onChange={(e) => setProjectForm((f) => ({ ...f, note: e.target.value }))} />
      </div>

      <div className="enj-add-project-actions mt-5 flex items-center justify-end gap-3">
        <button type="button" className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`} onClick={() => setShowAddProjectForm(false)}>Cancel</button>
        <button type="button" className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`} onClick={clearProjectForm}>Clear</button>
        <button type="button" className={`${enj.btn} ${enj.btnPrimary} px-8 font-semibold disabled:opacity-50`} disabled={projectFormBusy || projectMetaLoading} onClick={() => void saveProject()}>
          {projectFormBusy ? 'Saving...' : '+ Save'}
        </button>
      </div>
          </section>
        </div>
      </div>
    </div>
  ) : viewAllStatus ? (
    <section className="flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl bg-[#f5f6fb] p-0">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          onClick={() => setViewAllStatus(null)}
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold text-[rgba(35,35,96,1)] truncate">All Projects - {viewAllStatus}</h1>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          <div className="grid w-full grid-cols-1 gap-[10.4px] sm:grid-cols-2 xl:grid-cols-4 items-start content-start pb-2">
            {(() => {
              const allRows = boardProjectsByStatus[viewAllStatus] ?? [];
              const totalPages = Math.max(1, Math.ceil(allRows.length / VIEW_ALL_PAGE_SIZE));
              const pageSafe = Math.min(Math.max(1, viewAllPage), totalPages);
              const pageRows = allRows.slice((pageSafe - 1) * VIEW_ALL_PAGE_SIZE, pageSafe * VIEW_ALL_PAGE_SIZE);
              const column = projectBoardColumns.find(c => c.title === viewAllStatus);

              return pageRows.map((row, idx) => {
                const title = String(row.new_projectname ?? row.new_name ?? 'Project Name');
                const desc = String(row.new_description ?? row.crcf8_description ?? '').trim() || 'No description';
                const progress = readProjectRowProgress(row);
                const sponsor = String(row.crcf8_projectsponsor ?? row.new_projectsponsorname ?? row.new_projectsponsor ?? 'â€”');
                const category = String(row.new_projectcategoryname ?? row.new_projectcategory ?? 'â€”');
                const method = String(row.new_methodologyname ?? row.new_methodology ?? 'â€”');
                const initials = projectCardInitials(row);
                const budgetStr = formatProjectBudgetShort(row);

                return (
                  <div
                    key={`${viewAllStatus}-${String(row.new_projectid ?? idx)}`}
                    className="flex min-h-[158px] h-auto w-full self-start shrink-0 flex-col rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm"
                  >
                    <div className="grid min-h-0 grid-cols-[1fr_auto] items-start gap-2">
                      {hideEdit ? (
                        <p
                          className="line-clamp-2 min-w-0 text-left text-[13px] font-bold leading-snug break-words"
                          style={{ color: column?.color || '#000' }}
                          title={title}
                        >
                          {title}
                        </p>
                      ) : (
                        <button
                          type="button"
                          className="line-clamp-2 min-w-0 text-left text-[13px] font-bold leading-snug hover:underline break-words"
                          style={{ color: column?.color || '#000' }}
                          title={title}
                          onClick={() => {
                            void openProjectQuickEdit(row);
                          }}
                        >
                          {title}
                        </button>
                      )}
                      <div className="flex w-12 shrink-0 flex-col items-end">
                        <span className="text-[10px] text-gray-500 tabular-nums leading-none">{progress}%</span>
                        <div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full transition-[width]"
                            style={{ width: `${progress}%`, backgroundColor: column?.color }}
                          />
                        </div>
                      </div>
                    </div>

                    <p
                      className="mt-1 min-h-[1rem] line-clamp-1 text-[9px] font-medium leading-tight text-primary break-words pr-1"
                      title={desc}
                    >
                      {desc}
                    </p>

                    <div className="mt-0.5 flex min-w-0 items-start justify-between gap-1 text-[8px] leading-tight text-primary">
                      <p className="min-w-0 flex-1 break-words line-clamp-2">
                        <span className="font-normal">Sponsor: </span>
                        <span className="font-medium">{sponsor}</span>
                      </p>
                      <div className="flex shrink-0 items-center gap-0.5" title="Budget">
                        <Coins className="h-3 w-3 shrink-0 text-amber-500" strokeWidth={2} />
                        <span className="font-semibold tabular-nums">{budgetStr}</span>
                      </div>
                    </div>

                    <div className="mt-0.5 flex min-w-0 items-start justify-between gap-2 text-[9px] text-primary">
                      <p className="min-w-0 max-w-[48%] break-words line-clamp-2">
                        <span className="font-normal">Category: </span>
                        <span className="font-medium">{category}</span>
                      </p>
                      <p className="min-w-0 max-w-[48%] break-words line-clamp-2 text-right">
                        <span className="font-normal">Approach: </span>
                        <span className="font-medium">{method}</span>
                      </p>
                    </div>

                    <div className="mt-1 grid min-w-0 grid-cols-2 gap-2 text-primary">
                      <div className="flex min-w-0 gap-1">
                        <Calendar className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="text-[8px] font-normal leading-none text-gray-500">Start</p>
                          <p className="text-[9px] font-bold leading-tight">
                            {formatProjectDisplayDate(row.new_startdate)}
                          </p>
                        </div>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[8px] font-normal leading-none text-gray-500">End</p>
                        <p className="text-[9px] font-bold leading-tight">
                          {formatProjectDisplayDate(row.new_enddate)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-1">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd8c2] text-[8px] font-semibold text-[#3d2914] leading-none"
                        aria-hidden
                        title="Owner"
                      >
                        {initials}
                      </div>
                      <div className="flex items-end gap-2 text-primary">
                        <button
                          type="button"
                          className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                          title="Files"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openProjectFilesModal(row);
                          }}
                        >
                          <Paperclip className="h-3 w-3 text-gray-600" strokeWidth={2} />
                          <span className="text-[8px] font-medium leading-tight text-primary underline decoration-primary/50 underline-offset-1 break-words text-center">
                            View Files
                          </span>
                        </button>
                        {!hideSprintAndMembers && (
                          <>
                            <button
                              type="button"
                              className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                              title="Sprint"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isAgileProject(row)) setAgileSprintProject(row);
                                else setWaterfallSprintProject(row);
                              }}
                            >
                              <SquareArrowUpRight className="h-3 w-3 text-gray-600" strokeWidth={2} />
                              <span className="text-[8px] font-medium leading-tight">Sprint</span>
                            </button>
                            <button
                              type="button"
                              className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                              title="Members"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAllocateMemberCtx({
                                  projectName: title,
                                  projectId: String(row.new_projectid ?? '').trim(),
                                });
                              }}
                            >
                              <Users className="h-3 w-3 text-gray-600" strokeWidth={2} />
                              <span className="text-[8px] font-medium leading-tight">Members</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        {(() => {
          const allRows = boardProjectsByStatus[viewAllStatus] ?? [];
          return (
            <PagerBar
              className="shrink-0 border-t border-gray-100 pt-3"
              page={viewAllPage}
              pageSize={VIEW_ALL_PAGE_SIZE}
              total={allRows.length}
              onPrev={() => setViewAllPage((p) => Math.max(1, p - 1))}
              onNext={() => setViewAllPage((p) => Math.min(Math.ceil(allRows.length / VIEW_ALL_PAGE_SIZE), p + 1))}
            />
          );
        })()}
      </div>
    </section>
  ) : (
    <section className="flex flex-1 min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl bg-[#f5f6fb] p-0">
      <div className={`${enj.screenToolbar} mb-4`}>
        <h2 className="enj-screen-header">Projects</h2>
        {!hideNewProject && (
          <button
            type="button"
            className={enj.btnPrimary}
            onClick={() => {
              clearProjectForm();
              setShowAddProjectForm(true);
            }}
          >
            + New Project
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {projectBoardColumns.map((column) => {
          const rows = boardProjectsByStatus[column.title] ?? [];
          return (
            <div key={column.title} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className={`${enj.sectionToolbar} shrink-0 rounded-lg border border-gray-100 bg-white px-4 py-2.5`}>
                <p className="text-xs font-semibold" style={{ color: column.color }}>{column.title}</p>
                <button
                  type="button"
                  className="text-[10px] font-semibold px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: column.color }}
                  onClick={() => {
                    setViewAllStatus(column.title);
                    setViewAllPage(1);
                  }}
                >
                  View All ({rows.length})
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-[10.4px] overflow-y-auto overflow-x-hidden pr-0.5 pb-2">
                {projectRowsLoading ? (
                  <p className="text-xs text-gray-500 px-1">Loading projects...</p>
                ) : rows.length === 0 ? (
                  <p className="text-xs text-gray-400 px-1">No projects in this status.</p>
                ) : (
                  rows.map((row, rowIdx) => {
                    const title = String(row.new_projectname ?? row.new_name ?? 'Project Name');
                    const desc = String(row.new_description ?? row.crcf8_description ?? '').trim() || 'No description';
                    const progress = readProjectRowProgress(row);
                    const sponsor = String(row.crcf8_projectsponsor ?? row.new_projectsponsorname ?? row.new_projectsponsor ?? 'â€”');
                    const category = String(row.new_projectcategoryname ?? row.new_projectcategory ?? 'â€”');
                    const method = String(row.new_methodologyname ?? row.new_methodology ?? 'â€”');
                    const initials = projectCardInitials(row);
                    const budgetStr = formatProjectBudgetShort(row);
                    return (
                      <div
                        key={`${column.title}-${String(row.new_projectid ?? rowIdx)}`}
                        className="flex min-h-[158px] w-full shrink-0 flex-col rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm"
                      >
                        <div className="grid min-h-0 grid-cols-[1fr_auto] items-start gap-2">
                          {hideEdit ? (
                            <p
                              className="line-clamp-2 min-w-0 text-left text-[13px] font-bold leading-snug break-words"
                              style={{ color: column.color }}
                              title={title}
                            >
                              {title}
                            </p>
                          ) : (
                            <button
                              type="button"
                              className="line-clamp-2 min-w-0 text-left text-[13px] font-bold leading-snug hover:underline break-words"
                              style={{ color: column.color }}
                              title={title}
                              onClick={() => {
                                void openProjectQuickEdit(row);
                              }}
                            >
                              {title}
                            </button>
                          )}
                          <div className="flex w-12 shrink-0 flex-col items-end">
                            <span className="text-[10px] text-gray-500 tabular-nums leading-none">{progress}%</span>
                            <div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full transition-[width]"
                                style={{ width: `${progress}%`, backgroundColor: column.color }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 min-h-[1rem] line-clamp-1 text-[9px] font-medium leading-tight text-primary break-words pr-1" title={desc}>
                          {desc}
                        </p>

                        <div className="mt-0.5 flex min-w-0 items-start justify-between gap-1 text-[8px] leading-tight text-primary">
                          <p className="min-w-0 flex-1 break-words line-clamp-2">
                            <span className="font-normal">Sponsor: </span>
                            <span className="font-medium">{sponsor}</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5" title="Budget">
                            <Coins className="h-3 w-3 shrink-0 text-amber-500" strokeWidth={2} />
                            <span className="font-semibold tabular-nums">{budgetStr}</span>
                          </div>
                        </div>

                        <div className="mt-0.5 flex min-w-0 items-start justify-between gap-2 text-[9px] text-primary">
                          <p className="min-w-0 max-w-[48%] break-words line-clamp-2">
                            <span className="font-normal">Category: </span>
                            <span className="font-medium">{category}</span>
                          </p>
                          <p className="min-w-0 max-w-[48%] break-words line-clamp-2 text-right">
                            <span className="font-normal">Approach: </span>
                            <span className="font-medium">{method}</span>
                          </p>
                        </div>

                        <div className="mt-1 grid min-w-0 grid-cols-2 gap-2 text-primary">
                          <div className="flex min-w-0 gap-1">
                            <Calendar className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" strokeWidth={1.75} />
                            <div className="min-w-0">
                              <p className="text-[8px] font-normal leading-none text-gray-500">Start</p>
                              <p className="text-[9px] font-bold leading-tight">{formatProjectDisplayDate(row.new_startdate)}</p>
                            </div>
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="text-[8px] font-normal leading-none text-gray-500">End</p>
                            <p className="text-[9px] font-bold leading-tight">{formatProjectDisplayDate(row.new_enddate)}</p>
                          </div>
                        </div>

                        <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-1">
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd8c2] text-[8px] font-semibold text-[#3d2914] leading-none"
                            aria-hidden
                            title="Owner"
                          >
                            {initials}
                          </div>
                          <div className="flex items-end gap-2 text-primary">
                            <button
                              type="button"
                              className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                              title="Files"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openProjectFilesModal(row);
                              }}
                            >
                              <Paperclip className="h-3 w-3 text-gray-600" strokeWidth={2} />
                              <span className="text-[8px] font-medium leading-tight text-primary underline decoration-primary/50 underline-offset-1 break-words text-center">
                                View Files
                              </span>
                            </button>
                            {!hideSprintAndMembers && (
                              <>
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                                  title="Sprint"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAgileProject(row)) setAgileSprintProject(row);
                                    else setWaterfallSprintProject(row);
                                  }}
                                >
                                  <SquareArrowUpRight className="h-3 w-3 text-gray-600" strokeWidth={2} />
                                  <span className="text-[8px] font-medium leading-tight">Sprint</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-col items-center gap-0 rounded p-0 hover:bg-gray-50"
                                  title="Members"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAllocateMemberCtx({
                                      projectName: title,
                                      projectId: String(row.new_projectid ?? '').trim(),
                                    });
                                  }}
                                >
                                  <Users className="h-3 w-3 text-gray-600" strokeWidth={2} />
                                  <span className="text-[8px] font-medium leading-tight">Members</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  )}
  {allocateMemberCtx && (
    <AllocateTeamMemberModal
      open
      onClose={() => setAllocateMemberCtx(null)}
      projectName={allocateMemberCtx.projectName}
      projectId={allocateMemberCtx.projectId}
      onNotify={onToast}
      onSaved={() => {
        onExternalDataInvalidate?.();
        if (!isExternal) void loadProjectRows();
      }}
    />
  )}
  {projectFilesModal && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-primary">Project Files</h3>
            <p className="text-xs text-gray-500">{projectFilesModal.projectName}</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            onClick={() => setProjectFilesModal(null)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 max-h-80 overflow-y-auto">
          {projectFilesLoading ? (
            <p className="text-sm text-gray-500">Loading files...</p>
          ) : projectFilesRows.length === 0 ? (
            <p className="text-sm text-gray-500">No files uploaded for this project yet.</p>
          ) : (
            <ul className="space-y-3">
              {projectFilesRows.map((file) => (
                <li key={file.id} className="flex items-center justify-between rounded-md border border-gray-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{file.name}</p>
                    <p className={enj.label}>{file.modified || 'â€”'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadFile(file);
                      } catch (error) {
                        onToast({ type: 'error', message: 'Failed to download file' });
                      }
                    }}
                    className={`${enj.btnOutline} !h-auto py-1 px-3 text-xs`}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )}

  </>
  );
}

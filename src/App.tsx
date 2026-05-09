/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertCircle, Briefcase, Calendar, CheckSquare,
  ChevronDown, Clock, FileText, FolderOpen, HelpCircle, Inbox, LayoutGrid, ListTree, Pencil, RefreshCw,
  LogOut, MessageSquare, ShieldCheck, Trash2, TrendingUp, UserCircle, Users,
} from 'lucide-react';
import BusinessFeedbackList from './BusinessFeedbackList';
import BusinessPipelineScreen from './BusinessPipelineScreen';
import { newPipelineToTableRow, type BusinessPipelineTableRow } from './pipelineMappers';
import type { New_clients } from './generated/models/New_clientsModel';
import type { New_pipelines } from './generated/models/New_pipelinesModel';
import { New_clientsService } from './generated/services/New_clientsService';
import { New_pipelinesService } from './generated/services/New_pipelinesService';
import AdminDashboard from './AdminDashboard';
import { ActivityHistoryModal } from './ActivityHistoryModal';
import { UserProfileModal } from './UserProfileModal';
import { DonutChart } from './DonutChart';
import { DonutChartCard } from './DonutChartCard';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsService } from './generated/services/New_projectsService';
import { buildProgramIdToNameMap, normalizeDataverseId, resolveProjectProgramName } from './programNameResolve';
import { New_projectsnew_projecttype } from './generated/models/New_projectsModel';
import { New_deliverablesService } from './generated/services/New_deliverablesService';
import { New_issuesService } from './generated/services/New_issuesService';
import { New_issuesnew_issueseverity, New_issuesnew_issuestatus } from './generated/models/New_issuesModel';
import { New_tasksService } from './generated/services/New_tasksService';
import { New_meetingdetailsService } from './generated/services/New_meetingdetailsService';
import { New_subissuesService } from './generated/services/New_subissuesService';
import { New_teammembersService } from './generated/services/New_teammembersService';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { ProgramProjectsSection } from './ProgramProjectsSection';
import { DeliverablesListPanel } from './DeliverablesListPanel';
import { AddNewTaskFormPanel } from './AddNewTaskFormPanel';
import { ProjectTaskDetailView } from './ProjectTaskDetailView';
import { TasksScreenBoard, taskStatusBucket } from './TasksScreenBoard';
import { AddIssueFormPanel } from './AddIssueFormPanel';
import { TeamSubIssueFormPanel } from './TeamSubIssueFormPanel';
import { TeamIssueDetailPanel } from './TeamIssueDetailPanel';
import { TeamTaskDetailPanel } from './TeamTaskDetailPanel';
import { TeamSubTaskFormPanel } from './TeamSubTaskFormPanel';
import { ScreenLoader } from './ScreenLoader';
import { ProgramReportsPanel } from './ProgramReportsPanel';
import { AddMeetingFormPanel } from './AddMeetingFormPanel';
import { sendEmailNotification, generateEmailTemplate } from './services/PMTMailNotificationService';
import { fetchSessionUserProfileFromUsers, getSessionUserEmail, type SessionUserProfile } from './sessionUser';
import { buildInboxNotifications, NotificationBell } from './NotificationInbox';
import { ThemeModeToggle } from './themeMode';
import saudiHeroImage from '../refImages/Loginbackground.jpg?inline';
import { LogoMark } from './LogoMark';
import { enj } from './ui/enjForm';
import { PagerBar } from './PagerBar';
import {
  TableBudgetDisplay,
  portfolioProjectStatusBadgeClass,
  programTableStatusBadgeClass,
} from './tableDesign';

/** Application roles — pick at sign-in to route the correct workspace. */
export type AppRole = 'admin' | 'business' | 'program' | 'project' | 'team';

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  business: 'Business',
  program: 'Program',
  project: 'Project',
  team: 'Team',
};

/** Dataverse-agnostic: calendar day in local time for timeline labels and bar math. */
function parseTimelineDate(rawValue: unknown): Date | null {
  if (rawValue == null || rawValue === '') return null;
  if (rawValue instanceof Date) {
    if (Number.isNaN(rawValue.getTime())) return null;
    return new Date(rawValue.getFullYear(), rawValue.getMonth(), rawValue.getDate(), 0, 0, 0, 0);
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    const d = new Date(rawValue);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  const raw = String(rawValue).trim();
  if (!raw) return null;
  // YYYY-MM-DD (any ISO that starts with a date) — do not use Date.parse to avoid UTC day shifts.
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]);
    const d = Number(dateOnlyMatch[3]);
    const localDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  // .NET: /Date(1198908717056)/
  const msJson = raw.match(/\/Date\((-?\d+)\)\//);
  if (msJson) {
    const ms = Number(msJson[1]);
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

/**
 * Inclusive end date from the API = calendar day; bars use [start, end) in time, so the visual
 * block must extend through that whole day = exclusive instant at local midnight the next day.
 */
function exclusiveEndAfterInclusiveDate(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateOnlyFromTimeMs(t: number): Date {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** One calendar year, weeks as the base column count; Q / month bands = consecutive week spans. */
type WeekHeaderBand = { text: string; span: number };
function businessYearWeekTimelineModel(year: number) {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  const dayCount = Math.round((endExclusive.getTime() - start.getTime()) / 86400000);
  const weeksInYear = Math.max(1, Math.ceil(dayCount / 7));
  const weekMonth: number[] = [];
  const weekQuarter: number[] = [];
  for (let w = 0; w < weeksInYear; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7);
    weekMonth.push(d.getMonth());
    weekQuarter.push(Math.floor(d.getMonth() / 3));
  }
  const bands = (getKey: (i: number) => number, getLabel: (i: number) => string): WeekHeaderBand[] => {
    const out: WeekHeaderBand[] = [];
    let i = 0;
    while (i < weeksInYear) {
      const j = (() => {
        let n = i + 1;
        while (n < weeksInYear && getKey(n) === getKey(i)) n++;
        return n;
      })();
      out.push({ text: getLabel(i), span: j - i });
      i = j;
    }
    return out;
  };
  const monthWeekBands = bands(
    (i) => weekMonth[i],
    (i) => new Date(year, weekMonth[i], 1).toLocaleDateString(undefined, { month: 'short' }),
  );
  const quarterWeekBands = bands(
    (i) => weekQuarter[i],
    (i) => `Q${weekQuarter[i] + 1}`,
  );
  const bottomLabels = Array.from({ length: weeksInYear }, (_, i) => `W${i + 1}`);
  return {
    start,
    endExclusive,
    yearLabel: String(year),
    bottomLabels,
    quarterWeekBands,
    monthWeekBands,
  };
}

function formatTimelineDateLabel(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Best-effort Created By email from a Dataverse project row (matches Filter Project by creator). */
function getProjectRowCreatedByEmail(row: Record<string, unknown>): string {
  const c = row.createdby;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const a = o.internalemailaddress ?? o.emailaddress1 ?? o.primaryemail;
    if (typeof a === 'string' && a.includes('@')) return a.trim();
  }
  const name = row.createdbyname;
  if (typeof name === 'string' && name.includes('@')) return name.trim();
  return '';
}

function distinctSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

/** Power Apps: Filter(Users, Department = "Project") — map to role Project + optional Department field. */
function isUserProjectDepartment(u: Record<string, unknown>): boolean {
  if (String(u.new_rolename ?? '') === 'Project' || String(u.new_rolename ?? '').toLowerCase() === 'project') return true;
  if (String(u.new_role ?? '') === '100000003') return true;
  const dep = u.new_department ?? u.crcf8_department ?? u.new_departmentname;
  if (dep !== undefined && dep !== null && String(dep).trim() !== '' && String(dep).toLowerCase() === 'project') return true;
  return false;
}

// --- Business dashboard: derive charts from project rows (Dataverse) ---
const BUDGET_DONUT_COLORS = [
  '#1667de', '#f6be00', '#3b3a80', '#d3525a', '#64748b', '#16a34a', '#8b5cf6',
] as const;
const PROJECT_CATEGORY_DONUT_COLORS = [
  '#2563eb', '#f59e0b', '#4f46e5', '#60a5fa', '#10b981', '#d3525a',
] as const;
const COUNTS_BAR_COLORS = ['#4f46e5', '#d4a759', '#8b5e34', '#60a5fa', '#dc2626'] as const;



function formatAEDShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e6) return `AED ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `AED ${(n / 1e3).toFixed(0)}K`;
  return `AED ${n.toFixed(0)}`;
}
const PS_ONTRACK = 100000001;
const PS_DELAYED = 100000002;
const PS_COMPLETED = 100000003;

type BusinessStatusBucket = 'toStart' | 'onTrack' | 'delayed' | 'completed';

function businessProjectStatusBucket(row: Record<string, unknown>): BusinessStatusBucket {
  const n = Number(row.new_projectstatus);
  const name = String(row.new_projectstatusname ?? '').toLowerCase();
  if (n === PS_COMPLETED || name.includes('complet')) return 'completed';
  if (n === PS_DELAYED || name.includes('delay')) return 'delayed';
  if (n === PS_ONTRACK || (name.includes('on') && name.includes('track'))) return 'onTrack';
  return 'toStart';
}

function businessDashboardModel(
  rows: Array<Record<string, unknown>>,
  programIdToName?: ReadonlyMap<string, string> | null,
  masterRows?: Array<Record<string, unknown>>,
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const statusCounts = { completed: 0, onTrack: 0, delayed: 0, toStart: 0 };
  const totalProjects = rows.length;
  let sumProgress = 0;
  let nProgress = 0;
  let sumBudget = 0;
  let sumActual = 0;
  const sectorBudget = new Map<string, { planned: number; actual: number }>();
  const programCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  for (const r of rows) {
    const b = businessProjectStatusBucket(r);
    statusCounts[b] += 1;
    const p = Number(r.new_progress);
    if (Number.isFinite(p)) {
      sumProgress += p;
      nProgress += 1;
    }
    const bu = Number(r.new_budget);
    const act = Number(r.new_actualamount);
    if (Number.isFinite(bu) && bu > 0) sumBudget += bu;
    if (Number.isFinite(act) && act > 0) sumActual += act;
    const sec = String(r.new_sectorname ?? r.new_sector ?? 'Other').trim() || 'Other';
    if (!sectorBudget.has(sec)) sectorBudget.set(sec, { planned: 0, actual: 0 });
    const s = sectorBudget.get(sec)!;
    if (Number.isFinite(bu) && bu > 0) s.planned += bu;
    if (Number.isFinite(act) && act > 0) s.actual += act;
    const prog = resolveProjectProgramName(r, programIdToName) || 'Unassigned';
    programCount.set(prog, (programCount.get(prog) ?? 0) + 1);
    const cat = String(r.new_projectcategoryname ?? r.new_projectcategory ?? 'Uncategorized').trim() || 'Uncategorized';
    categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }
  const completedPct = totalProjects > 0 ? (statusCounts.completed / totalProjects) * 100 : 0;
  const onTimePct = totalProjects > 0 ? (statusCounts.onTrack / totalProjects) * 100 : 0;
  const delayedPct = totalProjects > 0 ? (statusCounts.delayed / totalProjects) * 100 : 0;
  const avgProgress = nProgress > 0 ? sumProgress / nProgress : 0;
  // Any valid start date on projects? (drives "Project timeline" chart)
  const hasStartDate = rows.some((r) => {
    const t = r.new_startdate;
    if (t === undefined || t === null) return false;
    const st = new Date(t as string | number);
    return !Number.isNaN(st.getTime());
  });
  // Years: last 12 years (same point count as original dashboard timeline)
  const yearSpan = 12;
  const years: number[] = [];
  for (let y = currentYear - yearSpan + 1; y <= currentYear; y++) years.push(y);
  const byYear: Array<{ y: number; completed: number; onTrack: number; delayed: number; toStart: number }> = years.map((y) => ({
    y,
    completed: 0,
    onTrack: 0,
    delayed: 0,
    toStart: 0,
  }));
  const yearIndex = new Map(years.map((y, i) => [y, i] as const));
  for (const r of rows) {
    const start = parseTimelineDate(r.new_startdate);
    const end = parseTimelineDate(r.new_enddate) ?? start;
    if (!start || !end) continue;
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const b = businessProjectStatusBucket(r);
    for (let y = startYear; y <= endYear; y += 1) {
      const idx = yearIndex.get(y);
      if (idx === undefined) continue;
      if (b === 'completed') byYear[idx].completed += 1;
      else if (b === 'onTrack') byYear[idx].onTrack += 1;
      else if (b === 'delayed') byYear[idx].delayed += 1;
      else byYear[idx].toStart += 1;
    }
  }
  const ytotals = byYear.map((b) => b.completed + b.onTrack + b.delayed + b.toStart);
  const maxY = Math.max(1, ...ytotals);
  // Original line chart used ~0–50 vertical scale; keep comparable scale for smooth lines
  const completedH = byYear.map((b) => Math.round((b.completed / maxY) * 50));
  const onTrackH = byYear.map((b) => Math.round((b.onTrack / maxY) * 50));
  const delayedH = byYear.map((b) => Math.round((b.delayed / maxY) * 50));
  /** Last few years only (matches “2025 / 2026” style mock). */
  const focusYears = 3;
  const narrowFrom = Math.max(0, years.length - focusYears);
  const yearsNarrow = years.slice(narrowFrom);
  const maxYNarrow = Math.max(
    1,
    ...years.map((_, i) => {
      if (i < narrowFrom) return 0;
      const b = byYear[i];
      return b.completed + b.onTrack + b.delayed + b.toStart;
    }),
  );
  const projectTimelineNarrow = {
    years: yearsNarrow.map(String),
    completed: yearsNarrow.map((_, j) => {
      const b = byYear[narrowFrom + j];
      return Math.round((b.completed / maxYNarrow) * 50);
    }),
    onTrack: yearsNarrow.map((_, j) => {
      const b = byYear[narrowFrom + j];
      return Math.round((b.onTrack / maxYNarrow) * 50);
    }),
    delayed: yearsNarrow.map((_, j) => {
      const b = byYear[narrowFrom + j];
      return Math.round((b.delayed / maxYNarrow) * 50);
    }),
  };
  // Budget donut: top sectors by planned budget
  const segArr = Array.from(sectorBudget.entries())
    .map(([name, v]) => ({ name, planned: v.planned, actual: v.actual }))
    .filter((s) => s.planned > 0 || s.actual > 0)
    .sort((a, b) => b.planned - a.planned);
  const top = segArr.slice(0, 6);
  const rest = segArr.slice(6);
  const restPlanned = rest.reduce((s, x) => s + x.planned, 0);
  const budgetSegments: { name: string; value: number; color: string }[] = [
    ...top.map((s, i) => ({
      name: s.name,
      value: s.actual > 0 ? s.actual : s.planned,
      color: BUDGET_DONUT_COLORS[i % BUDGET_DONUT_COLORS.length],
    })),
  ];
  const restActual = rest.reduce((s, x) => s + x.actual, 0);
  if (restPlanned > 0 || restActual > 0) {
    budgetSegments.push({ name: 'Other', value: restActual > 0 ? restActual : restPlanned, color: 'var(--secondary-gray3)' });
  }
  const budgetPlannedTotal = top.reduce((s, x) => s + x.planned, 0) + restPlanned;
  const budgetBySectorLegend = top.map((s) => {
    const pct = budgetPlannedTotal > 0 ? (s.planned / budgetPlannedTotal) * 100 : 0;
    return {
      label: s.name,
      value: s.actual > 0 ? s.actual : s.planned,
      valueLabel: `${formatAEDShort(s.actual)} / ${formatAEDShort(s.planned)}`,
      sub: `Actual / Planned • Share ${pct.toFixed(0)}%`,
    };
  });
  if (restPlanned > 0) {
    const pct = budgetPlannedTotal > 0 ? (restPlanned / budgetPlannedTotal) * 100 : 0;
    budgetBySectorLegend.push({
      label: 'Other',
      value: restActual > 0 ? restActual : restPlanned,
      valueLabel: `${formatAEDShort(restActual)} / ${formatAEDShort(restPlanned)}`,
      sub: `Actual / Planned • Share ${pct.toFixed(0)}%`,
    });
  }
  const hasBudgetData = sumBudget > 0 && segArr.some((s) => s.planned > 0);
  // 12 months current year: planned vs actual
  const budgetMonthPlanned: number[] = Array(12).fill(0);
  const budgetMonthActual: number[] = Array(12).fill(0);
  for (const r of rows) {
    const t = r.new_startdate;
    if (t === undefined || t === null) continue;
    const st = new Date(t as string | number);
    if (Number.isNaN(st.getTime()) || st.getFullYear() !== currentYear) continue;
    const m = st.getMonth();
    const bu = Number(r.new_budget);
    const act = Number(r.new_actualamount);
    if (Number.isFinite(bu) && bu > 0) budgetMonthPlanned[m] += bu;
    if (Number.isFinite(act) && act > 0) budgetMonthActual[m] += act;
  }
  const bmax = Math.max(1, ...budgetMonthPlanned, ...budgetMonthActual);
  const hasAnyBudgetMonth = budgetMonthPlanned.some((v) => v > 0) || budgetMonthActual.some((v) => v > 0);
  // Match original /5 height formula: scale to same numeric ballpark (0–~600) as the mock
  const toDemoScale = (v: number) => (v / bmax) * 600;
  const barPlanned = budgetMonthPlanned.map((v) => toDemoScale(v));
  const barActual = budgetMonthActual.map((v) => toDemoScale(v));
  /** Per-sector bars (mock uses sector names on X, not months). */
  const sectorBudgetList = Array.from(sectorBudget.entries())
    .map(([name, v]) => ({ name, planned: v.planned, actual: v.actual }))
    .filter((s) => s.planned > 0 || s.actual > 0)
    .sort((a, b) => Math.max(b.planned, b.actual) - Math.max(a.planned, a.actual))
    .slice(0, 14);
  const smax = Math.max(1, ...sectorBudgetList.map((s) => Math.max(s.planned, s.actual)));
  const budgetingSectors = sectorBudgetList.map((s) => {
    const dev = s.planned > 0 ? ((s.actual - s.planned) / s.planned) * 100 : s.actual > 0 ? 100 : 0;
    return {
      label: s.name.length > 11 ? `${s.name.slice(0, 10)}…` : s.name,
      fullName: s.name,
      plannedH: (s.planned / smax) * 120,
      actualH: (s.actual / smax) * 120,
      deviation: Math.max(-100, Math.min(100, dev)),
    };
  });
  // Category & program for bars
  const hasCategory = rows.some((r) => String(r.new_projectcategoryname ?? r.new_projectcategory ?? '').trim() !== '');
  const catTop = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const catMax = Math.max(1, ...catTop.map(([, c]) => c));
  const projectCategoryBars = catTop.map(([label, count], i) => {
    const s = String(label).trim();
    const short = s.length > 14 ? `${s.slice(0, 13)}…` : s;
    return {
      label: short,
      name: s,
      value: count,
      color: PROJECT_CATEGORY_DONUT_COLORS[i % PROJECT_CATEGORY_DONUT_COLORS.length] ?? 'var(--primary-greenish)',
    };
  });
  const hasProgram = rows.some((r) => {
    const n = resolveProjectProgramName(r, programIdToName).trim();
    return n !== '' && n !== 'Unassigned';
  });
  const projTop = Array.from(programCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const projMax = Math.max(1, ...projTop.map(([, c]) => c));
  const programBars = projTop.map(([name, c], i) => {
    const s = String(name).trim() || 'Unassigned';
    const short = s.length > 10 ? `${s.slice(0, 9)}…` : s;
    return { label: short, name: s, value: c, color: COUNTS_BAR_COLORS[i % COUNTS_BAR_COLORS.length] };
  });
  // Progress donut: To start green, Completed red, On Track blue, Delayed amber (stakeholder mock)
  const progressData = [
    { label: 'To start', value: statusCounts.toStart, color: '#10B981' },
    { label: 'Completed', value: statusCounts.completed, color: '#EF4444' },
    { label: 'On Track', value: statusCounts.onTrack, color: '#3B82F6' },
    { label: 'Delayed', value: statusCounts.delayed, color: '#F59E0B' },
  ];
  const kpiColorByLabel: Record<string, string> = {
    pinnacle: '#d4a759',
    quality: '#b58a3a',
    risk: '#e1c179',
    efficiency: '#8b6a2d',
  };
  const parseKpiValue = (row: Record<string, unknown>): number | null => {
    const candidates = [
      row.new_code,
      row.new_value,
      row.new_score,
      row.new_target,
      row.new_amount,
      row.new_weightage,
      row.new_kpi,
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    }
    return null;
  };
  const kpiRows = (masterRows ?? []).filter((r) => {
    const cat = String(r.new_categorytype ?? r.new_categoryname ?? '').toLowerCase();
    const label = String(r.new_enjazmasterdata1 ?? r.new_name ?? '').toLowerCase();
    return cat.includes('kpi') || label.includes('kpi') || label.includes('pinnacle') || label.includes('quality') || label.includes('risk') || label.includes('efficiency');
  });
  const kpiByLabel = new Map<string, number>();
  for (const r of kpiRows) {
    const labelRaw = String(r.new_enjazmasterdata1 ?? r.new_name ?? '').trim();
    if (!labelRaw) continue;
    const val = parseKpiValue(r);
    if (val == null) continue;
    const norm = labelRaw.toLowerCase();
    if (norm.includes('pinnacle')) kpiByLabel.set('Pinnacle', val);
    else if (norm.includes('quality')) kpiByLabel.set('Quality', val);
    else if (norm.includes('risk')) kpiByLabel.set('Risk', val);
    else if (norm.includes('efficiency')) kpiByLabel.set('Efficiency', val);
  }
  const kpiPinnacle = ['Pinnacle', 'Quality', 'Risk', 'Efficiency'].map((label) => {
    const fallback =
      label === 'Pinnacle' ? Math.min(100, Math.round(avgProgress * 10) / 10)
      : label === 'Quality' ? Math.min(100, Math.round(completedPct * 10) / 10)
      : label === 'Risk' ? Math.min(100, Math.round(delayedPct * 10) / 10)
      : Math.min(100, Math.round(onTimePct * 10) / 10);
    return {
      label,
      value: kpiByLabel.get(label) ?? fallback,
      color: kpiColorByLabel[label.toLowerCase()] ?? '#b58a3a',
    };
  });
  const budgetByMonth = monthAbbr.map((m, i) => ({
    month: m,
    actual: barActual[i] ?? 0,
    planned: barPlanned[i] ?? 0,
  }));
  const budgetDeviation = monthAbbr.map((m, i) => {
    const p = budgetMonthPlanned[i];
    const a = budgetMonthActual[i];
    const val = p > 0 ? ((a - p) / p) * 100 : a > 0 ? 30 : 0;
    return { month: m, val: Math.max(-30, Math.min(30, val)) };
  });

  const skipReasons: string[] = [];
  if (totalProjects > 0) {
    if (!hasStartDate) {
      skipReasons.push('Project timeline — needs a valid new_startdate on at least one project to plot by year and status');
    }
    if (!hasBudgetData) {
      skipReasons.push('Budget (donut) — needs new_budget and sector text (e.g. new_sectorname) on projects');
    }
    if (!hasCategory) {
      skipReasons.push('Projects category — needs new_projectcategoryname (or category choice) to group by category');
    }
    if (!hasProgram) {
      skipReasons.push(
        'Projects count — needs a program link on projects (lookup to Program) with Program.new_name, or new_programname on the project',
      );
    }
    if (budgetingSectors.length === 0 && !hasAnyBudgetMonth) {
      skipReasons.push(
        `Budgeting (actual vs planned + deviation) — needs project rows with new_budget and/or new_actualamount, and sector (new_sectorname) to chart by area`,
      );
    }
  }

  return {
    totalProjectCount: totalProjects,
    summary3: [
      { title: 'Completed Projects', value: String(statusCounts.completed), color: '#3B82F6', icon: 'completed', trend: [2, 2, 3, 3, 4, 4, 4] },
      { title: 'On Track Project', value: String(statusCounts.onTrack), color: '#10B981', icon: 'ontrack', trend: [8, 8, 9, 9, 9, 9, 9] },
      { title: 'Delayed Project', value: String(statusCounts.delayed), color: '#EF4444', icon: 'delayed', trend: [1, 1, 1, 1, 1, 1, 1] },
    ],
    projectTimeline: {
      years: years.map(String),
      delayed: delayedH,
      onTrack: onTrackH,
      completed: completedH,
    },
    projectTimelineNarrow,
    budgetData: { segments: budgetSegments, totalValue: sumBudget, legend: budgetBySectorLegend },
    kpiPinnacle,
    projectCategory: projectCategoryBars,
    projectCounts: programBars,
    projectCategoryMax: catMax,
    projectCountMax: projMax,
    progressData,
    categoryData: projectCategoryBars.map((c) => ({ label: c.label, name: c.name, value: c.value, color: c.color })),
    budgetVsPlanned: budgetByMonth,
    budgetDeviation,
    budgetingSectors,
    isEmpty: totalProjects === 0,
    skipReasons,
    has: {
      timeline: hasStartDate,
      budget: hasBudgetData,
      category: hasCategory,
      program: hasProgram,
      budgeting: budgetingSectors.length > 0 || hasAnyBudgetMonth,
    },
  };
}

function generatePeriodTimeline(
  rows: Array<Record<string, unknown>>,
  period: 'weekly' | 'monthly' | 'yearly',
): { labels: string[]; completed: number[]; onTrack: number[]; delayed: number[] } {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (period === 'yearly') {
    // Last 3 years
    const yearSpan = 3;
    const years: number[] = [];
    for (let y = currentYear - yearSpan + 1; y <= currentYear; y++) years.push(y);

    const byYear: Array<{ completed: number; onTrack: number; delayed: number }> = years.map(() => ({
      completed: 0,
      onTrack: 0,
      delayed: 0,
    }));

    const yearIndex = new Map(years.map((y, i) => [y, i] as const));

    for (const r of rows) {
      const start = parseTimelineDate(r.new_startdate);
      const end = parseTimelineDate(r.new_enddate) ?? start;
      if (!start || !end) continue;

      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      const b = businessProjectStatusBucket(r);

      for (let y = startYear; y <= endYear; y += 1) {
        const idx = yearIndex.get(y);
        if (idx === undefined) continue;
        if (b === 'completed') byYear[idx].completed += 1;
        else if (b === 'onTrack') byYear[idx].onTrack += 1;
        else if (b === 'delayed') byYear[idx].delayed += 1;
      }
    }

    const totals = byYear.map((b) => b.completed + b.onTrack + b.delayed);
    const maxY = Math.max(1, ...totals);

    return {
      labels: years.map(String),
      completed: byYear.map((b) => Math.round((b.completed / maxY) * 50)),
      onTrack: byYear.map((b) => Math.round((b.onTrack / maxY) * 50)),
      delayed: byYear.map((b) => Math.round((b.delayed / maxY) * 50)),
    };
  }

  if (period === 'monthly') {
    // 12 months of current year
    const months: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth: Array<{ completed: number; onTrack: number; delayed: number }> = months.map(() => ({
      completed: 0,
      onTrack: 0,
      delayed: 0,
    }));

    for (const r of rows) {
      const start = parseTimelineDate(r.new_startdate);
      if (!start || start.getFullYear() !== currentYear) continue;

      const b = businessProjectStatusBucket(r);
      const m = start.getMonth();

      if (b === 'completed') byMonth[m].completed += 1;
      else if (b === 'onTrack') byMonth[m].onTrack += 1;
      else if (b === 'delayed') byMonth[m].delayed += 1;
    }

    const totals = byMonth.map((b) => b.completed + b.onTrack + b.delayed);
    const maxY = Math.max(1, ...totals);

    return {
      labels: months,
      completed: byMonth.map((b) => Math.round((b.completed / maxY) * 50)),
      onTrack: byMonth.map((b) => Math.round((b.onTrack / maxY) * 50)),
      delayed: byMonth.map((b) => Math.round((b.delayed / maxY) * 50)),
    };
  }

  // weekly - show current week ± 5 weeks (10 weeks total)
  const yearStart = new Date(currentYear, 0, 1);
  const dayOfYearNow = Math.floor((now.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
  const currentWeek = Math.min(51, Math.floor(dayOfYearNow / 7));

  const weekSpan = 5;
  const weekStart = Math.max(0, currentWeek - weekSpan);
  const weekEnd = Math.min(51, currentWeek + weekSpan);
  const weekRange: number[] = [];
  for (let w = weekStart; w <= weekEnd; w++) weekRange.push(w);

  const allByWeek: Array<{ completed: number; onTrack: number; delayed: number }> = Array(52)
    .fill(null)
    .map(() => ({ completed: 0, onTrack: 0, delayed: 0 }));

  for (const r of rows) {
    const start = parseTimelineDate(r.new_startdate);
    if (!start || start.getFullYear() !== currentYear) continue;

    const b = businessProjectStatusBucket(r);
    // Calculate week number (0-51) by counting days from Jan 1
    const dayOfYear = Math.floor((start.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.max(0, Math.min(51, Math.floor(dayOfYear / 7)));

    if (b === 'completed') allByWeek[weekNum].completed += 1;
    else if (b === 'onTrack') allByWeek[weekNum].onTrack += 1;
    else if (b === 'delayed') allByWeek[weekNum].delayed += 1;
  }

  const byWeek = weekRange.map((w) => allByWeek[w]);
  const weekLabels = weekRange.map((w) => `W${w + 1}`);

  const totals = byWeek.map((b) => b.completed + b.onTrack + b.delayed);
  const maxY = Math.max(1, ...totals);

  return {
    labels: weekLabels,
    completed: byWeek.map((b) => Math.round((b.completed / maxY) * 50)),
    onTrack: byWeek.map((b) => Math.round((b.onTrack / maxY) * 50)),
    delayed: byWeek.map((b) => Math.round((b.delayed / maxY) * 50)),
  };
}

const PROJECT_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = Object.entries(New_projectsnew_projecttype).map(
  ([value, label]) => ({ value, label: String(label).replace(/_/g, ' ') }),
);

const DELIVERABLE_STATUS_OPTIONS = ['Delivered', 'To Be Delivered', 'Delayed'] as const;

/** `new_status` option set (matches Dataverse) */
const DELIVERABLE_STATUS_LABEL_TO_CHOICE: Record<(typeof DELIVERABLE_STATUS_OPTIONS)[number], number> = {
  Delivered: 100000000,
  'To Be Delivered': 100000001,
  Delayed: 100000002,
};

/** `new_thedeliverablesinclude` text: checked rows’ `new_enjazmasterdata1` only. */
function buildDeliverableIncludeString(
  rows: EnjazMasterDataRow[],
  includeByRowId: Record<string, boolean>,
): string {
  const labels: string[] = [];
  rows.forEach((row) => {
    const id = String(row.new_enjazmasterdataid ?? '');
    if (!id || !includeByRowId[id]) return;
    const v = String(row.new_enjazmasterdata1 ?? '').trim();
    if (v) labels.push(v);
  });
  return labels.join(', ');
}

type AddDeliverableFormPanelProps = {
  onClose: () => void;
  sectionClassName?: string;
  onNotify?: (type: ToastType, message: string) => void;
  /** Call after a successful save so list views can refetch. */
  onSaved?: () => void;
};

/** New Deliverables — front fields: project names (my projects), PMs (Project dept), goal, category, master checkboxes. */
function AddDeliverableFormPanel({
  onClose,
  sectionClassName = 'bg-white rounded-xl p-6 shadow-sm max-w-4xl mx-auto w-full',
  onNotify,
  onSaved,
}: AddDeliverableFormPanelProps) {
  const [projectName, setProjectName] = useState('');
  const [projectManager, setProjectManager] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [projectCategory, setProjectCategory] = useState('');
  const [deliverableStatus, setDeliverableStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [includeByRowId, setIncludeByRowId] = useState<Record<string, boolean>>({});

  const [projectNameOptions, setProjectNameOptions] = useState<string[]>([]);
  const [pmOptions, setPmOptions] = useState<string[]>([]);
  const [deliverableMasterRows, setDeliverableMasterRows] = useState<EnjazMasterDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [projectsRes, usersRes, deliverableMasterRes] = await Promise.all([
          New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          EnjazMasterDataService.getActiveDeliverableMasterRows(),
        ]);
        if (cancelled) return;

        const sessionEmail = getSessionUserEmail()?.toLowerCase();
        const projectRows = (projectsRes.success ? projectsRes.data : []) as unknown as Array<Record<string, unknown>>;
        const mine = sessionEmail
          ? projectRows.filter((row) => {
              const em = getProjectRowCreatedByEmail(row).toLowerCase();
              return em && em === sessionEmail;
            })
          : projectRows;
        let names = distinctSortedStrings(
          mine.map((row) => String(row.new_projectname ?? row.new_name ?? '').trim()).filter(Boolean),
        );
        if (names.length === 0 && projectRows.length > 0) {
          names = distinctSortedStrings(
            projectRows.map((row) => String(row.new_projectname ?? row.new_name ?? '').trim()).filter(Boolean),
          );
        }

        const userRows = (usersRes.success ? usersRes.data : []) as Array<Record<string, unknown>>;
        const pms = distinctSortedStrings(
          userRows
            .filter(isUserProjectDepartment)
            .map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim())
            .filter(Boolean),
        );

        const deliverableRows = deliverableMasterRes.success ? (deliverableMasterRes.data ?? []) : [];
        if (!deliverableMasterRes.success) {
          const err = deliverableMasterRes as { error?: { message?: string } };
          setLoadError(err.error?.message ?? 'Could not load new_enjazmasterdata (category Deliverables, status Active).');
        }

        setProjectNameOptions(names);
        setPmOptions(pms);
        setDeliverableMasterRows(deliverableRows);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleInclude = (id: string) => {
    setIncludeByRowId((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…');

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!projectName.trim()) nextErrors.projectName = 'Project Name is required';
    if (!projectCategory) nextErrors.projectCategory = 'Project Category is required';
    if (!deliverableStatus || !DELIVERABLE_STATUS_LABEL_TO_CHOICE[deliverableStatus as (typeof DELIVERABLE_STATUS_OPTIONS)[number]]) {
      nextErrors.deliverableStatus = 'Deliverable Status is required';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.('error', 'Please fill all required fields.');
      return;
    }
    setErrors({});
    const statusValue = DELIVERABLE_STATUS_LABEL_TO_CHOICE[deliverableStatus as (typeof DELIVERABLE_STATUS_OPTIONS)[number]];
    const categoryLabel =
      PROJECT_CATEGORY_OPTIONS.find((o) => o.value === projectCategory)?.label?.replace(/_/g, ' ') ?? projectCategory;
    const includeText = buildDeliverableIncludeString(deliverableMasterRows, includeByRowId);
    const businessId = (globalThis.crypto?.randomUUID?.() ?? `DLV-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 100);

    setSaveBusy(true);
    try {
      const payload: Record<string, unknown> = {
        new_deliverablesid: businessId,
        new_projectname: clip(projectName.trim(), 850),
        new_projectcategory: clip(String(categoryLabel), 100),
        new_status: statusValue,
        statecode: 0,
      };
      const pm = String(projectManager ?? '').trim();
      if (pm) payload.new_projectmanager = clip(pm, 100);
      const goal = projectGoal.trim();
      if (goal) payload.new_projectgoal = goal;
      if (includeText.trim()) payload.new_thedeliverablesinclude = includeText;
      const note = notes.trim();
      if (note) payload.new_notes = note;

      const res = await New_deliverablesService.create(
        payload as unknown as Parameters<typeof New_deliverablesService.create>[0],
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to save deliverable');
      onNotify?.('success', 'Deliverable saved successfully.');
      onSaved?.();
      onClose();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save deliverable');
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <section className={sectionClassName}>
      <p className="text-[16px] font-bold text-primary mb-5">
        <button type="button" className="underline text-primary font-bold" onClick={onClose}>
          Deliverables
        </button>
        {' > '}Add New Deliverables
      </p>
      {loadError && <p className="text-sm text-rose-600 mb-3">{loadError}</p>}
      {loading && <p className="text-sm text-gray-500 mb-3">Loading options…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 max-w-3xl">
        <label>
          <span className="text-[11px] text-gray-500">Project Name *</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setErrors((prev) => ({ ...prev, projectName: '' }));
            }}
            disabled={loading || saveBusy}
          >
            <option value="">Select project name</option>
            {projectNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.projectName && <p className="mt-1 text-[11px] text-rose-600">{errors.projectName}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project category *</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectCategory}
            onChange={(e) => {
              setProjectCategory(e.target.value);
              setErrors((prev) => ({ ...prev, projectCategory: '' }));
            }}
            disabled={loading || saveBusy}
          >
            <option value="">Select project category</option>
            {PROJECT_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.projectCategory && <p className="mt-1 text-[11px] text-rose-600">{errors.projectCategory}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project Manager</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectManager}
            onChange={(e) => setProjectManager(e.target.value)}
            disabled={loading || saveBusy}
          >
            <option value="">Select project manager</option>
            {pmOptions.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project Goal</span>
          <input
            className={`${enj.control} mt-1`}
            placeholder="Enter project goal"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
            disabled={loading || saveBusy}
          />
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Deliverable Status *</span>
          <select
            className={`${enj.control} mt-1`}
            value={deliverableStatus}
            onChange={(e) => {
              setDeliverableStatus(e.target.value);
              setErrors((prev) => ({ ...prev, deliverableStatus: '' }));
            }}
            disabled={loading || saveBusy}
          >
            <option value="">Select deliverable status</option>
            {DELIVERABLE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.deliverableStatus && <p className="mt-1 text-[11px] text-rose-600">{errors.deliverableStatus}</p>}
        </label>
        <div className="hidden md:block" aria-hidden="true" />
      </div>

      <p className="text-[12px] font-semibold text-gray-700 mt-5 mb-3">Deliverables Include</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[11px] text-gray-600 max-h-64 overflow-y-auto pr-1">
        {deliverableMasterRows.length === 0 && !loading ? (
          <p className="text-gray-500 text-xs md:col-span-2">No active deliverable rows in Enjaz Master Data (category Deliverables, status Active).</p>
        ) : (
          deliverableMasterRows.map((row) => {
            const id = String(row.new_enjazmasterdataid ?? '');
            const label = String(row.new_enjazmasterdata1 ?? '').trim();
            if (!id || !label) return null;
            return (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-secondary rounded"
                  checked={includeByRowId[id] ?? false}
                  disabled={loading || saveBusy}
                  onChange={() => toggleInclude(id)}
                />
                {label}
              </label>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <label className="text-[11px] text-gray-500">Notes</label>
        <textarea
          className="mt-1 w-full h-24 rounded-md border border-gray-200 px-3 py-2 text-sm resize-none"
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading || saveBusy}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          className={enj.btnOutline}
          onClick={onClose}
          disabled={saveBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={enj.btnPrimary}
          onClick={() => void handleSave()}
          disabled={loading || saveBusy}
        >
          {saveBusy ? 'Saving…' : '+ Save'}
        </button>
      </div>
    </section>
  );
}

// ─── Edit Deliverable Form ────────────────────────────────────────────────────
type EditDeliverableFormPanelProps = {
  row: import('./generated/models/New_deliverablesModel').New_deliverables;
  onClose: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onSaved?: () => void;
};

function EditDeliverableFormPanel({ row, onClose, onNotify, onSaved }: EditDeliverableFormPanelProps) {
  const rowId = String(
    (row as unknown as Record<string, unknown>).new_deliverableid ??
    (row as unknown as Record<string, unknown>).new_deliverablesid ?? '',
  );

  const [projectName, setProjectName] = useState(String(row.new_projectname ?? ''));
  const [projectManager, setProjectManager] = useState(String(row.new_projectmanager ?? ''));
  const [projectGoal, setProjectGoal] = useState(String(row.new_projectgoal ?? ''));
  const [projectCategory, setProjectCategory] = useState('');
  const [deliverableStatus, setDeliverableStatus] = useState('');
  const [notes, setNotes] = useState(String(row.new_notes ?? ''));
  const [includeByRowId, setIncludeByRowId] = useState<Record<string, boolean>>({});

  const [projectNameOptions, setProjectNameOptions] = useState<string[]>([]);
  const [pmOptions, setPmOptions] = useState<string[]>([]);
  const [deliverableMasterRows, setDeliverableMasterRows] = useState<EnjazMasterDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [projectsRes, usersRes, masterRes] = await Promise.all([
          New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          EnjazMasterDataService.getActiveDeliverableMasterRows(),
        ]);
        if (cancelled) return;

        const projectRows = (projectsRes.success ? projectsRes.data : []) as unknown as Array<Record<string, unknown>>;
        const names = distinctSortedStrings(
          projectRows.map((r) => String(r.new_projectname ?? r.new_name ?? '').trim()).filter(Boolean),
        );
        const userRows = (usersRes.success ? usersRes.data : []) as Array<Record<string, unknown>>;
        const pms = distinctSortedStrings(
          userRows.filter(isUserProjectDepartment).map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim()).filter(Boolean),
        );
        const masterRows = masterRes.success ? (masterRes.data ?? []) : [];

        // Pre-select category: match stored string against enum options
        const existingCat = String(row.new_projectcategory ?? '').trim();
        const matchedCat = PROJECT_CATEGORY_OPTIONS.find(
          (o) => o.label.toLowerCase() === existingCat.toLowerCase() || o.value === existingCat,
        );
        setProjectCategory(matchedCat?.value ?? existingCat);

        // Pre-select status label
        const existingStatusCode = row.new_status as number | undefined;
        const matchedStatus = DELIVERABLE_STATUS_OPTIONS.find(
          (s) => DELIVERABLE_STATUS_LABEL_TO_CHOICE[s] === existingStatusCode,
        );
        setDeliverableStatus(matchedStatus ?? DELIVERABLE_STATUS_OPTIONS[1]);

        // Pre-check checkboxes: match stored comma-separated labels against master data
        const existingLabels = new Set(
          String(row.new_thedeliverablesinclude ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        );
        const checked: Record<string, boolean> = {};
        masterRows.forEach((mr) => {
          const id = String(mr.new_enjazmasterdataid ?? '');
          const label = String(mr.new_enjazmasterdata1 ?? '').trim().toLowerCase();
          if (id && label && existingLabels.has(label)) checked[id] = true;
        });

        setProjectNameOptions(names);
        setPmOptions(pms);
        setDeliverableMasterRows(masterRows);
        setIncludeByRowId(checked);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row]);

  const toggleInclude = (id: string) => setIncludeByRowId((prev) => ({ ...prev, [id]: !prev[id] }));
  const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…');

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!projectName.trim()) nextErrors.projectName = 'Project Name is required';
    if (!projectCategory) nextErrors.projectCategory = 'Project Category is required';
    if (!deliverableStatus || !DELIVERABLE_STATUS_LABEL_TO_CHOICE[deliverableStatus as (typeof DELIVERABLE_STATUS_OPTIONS)[number]]) {
      nextErrors.deliverableStatus = 'Deliverable Status is required';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.('error', 'Please fill all required fields.');
      return;
    }
    if (!rowId) { onNotify?.('error', 'Cannot identify record to update.'); return; }
    setErrors({});
    setSaveBusy(true);
    try {
      const statusValue = DELIVERABLE_STATUS_LABEL_TO_CHOICE[deliverableStatus as (typeof DELIVERABLE_STATUS_OPTIONS)[number]];
      const categoryLabel = PROJECT_CATEGORY_OPTIONS.find((o) => o.value === projectCategory)?.label?.replace(/_/g, ' ') ?? projectCategory;
      const includeText = buildDeliverableIncludeString(deliverableMasterRows, includeByRowId);
      const payload: Record<string, unknown> = {
        new_projectname: clip(projectName.trim(), 850),
        new_projectcategory: clip(String(categoryLabel), 100),
        new_status: statusValue,
      };
      const pm = projectManager.trim();
      if (pm) payload.new_projectmanager = clip(pm, 100);
      const goal = projectGoal.trim();
      if (goal) payload.new_projectgoal = goal;
      payload.new_thedeliverablesinclude = includeText.trim() || '';
      const note = notes.trim();
      if (note) payload.new_notes = note;

      const res = await New_deliverablesService.update(rowId, payload as Parameters<typeof New_deliverablesService.update>[1]);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update deliverable');
      onNotify?.('success', 'Deliverable updated successfully.');
      onSaved?.();
      onClose();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to update deliverable');
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-6 shadow-sm max-w-4xl mx-auto w-full">
      <p className="text-[16px] font-bold text-primary mb-5">
        <button type="button" className="underline text-primary font-bold" onClick={onClose}>
          Deliverables
        </button>
        {' > '}Edit Deliverable
      </p>
      {loadError && <p className="text-sm text-rose-600 mb-3">{loadError}</p>}
      {loading && <p className="text-sm text-gray-500 mb-3">Loading options…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 max-w-3xl">
        <label>
          <span className="text-[11px] text-gray-500">Project Name *</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectName}
            onChange={(e) => { setProjectName(e.target.value); setErrors((p) => ({ ...p, projectName: '' })); }}
            disabled={loading || saveBusy}
          >
            <option value="">Select project name</option>
            {projectNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            {projectName && !projectNameOptions.includes(projectName) && (
              <option value={projectName}>{projectName}</option>
            )}
          </select>
          {errors.projectName && <p className="mt-1 text-[11px] text-rose-600">{errors.projectName}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project category *</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectCategory}
            onChange={(e) => { setProjectCategory(e.target.value); setErrors((p) => ({ ...p, projectCategory: '' })); }}
            disabled={loading || saveBusy}
          >
            <option value="">Select project category</option>
            {PROJECT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.projectCategory && <p className="mt-1 text-[11px] text-rose-600">{errors.projectCategory}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project Manager</span>
          <select
            className={`${enj.control} mt-1`}
            value={projectManager}
            onChange={(e) => setProjectManager(e.target.value)}
            disabled={loading || saveBusy}
          >
            <option value="">Select project manager</option>
            {pmOptions.map((e) => <option key={e} value={e}>{e}</option>)}
            {projectManager && !pmOptions.includes(projectManager) && (
              <option value={projectManager}>{projectManager}</option>
            )}
          </select>
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project Goal</span>
          <input
            className={`${enj.control} mt-1`}
            placeholder="Enter project goal"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
            disabled={loading || saveBusy}
          />
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Deliverable Status *</span>
          <select
            className={`${enj.control} mt-1`}
            value={deliverableStatus}
            onChange={(e) => { setDeliverableStatus(e.target.value); setErrors((p) => ({ ...p, deliverableStatus: '' })); }}
            disabled={loading || saveBusy}
          >
            <option value="">Select deliverable status</option>
            {DELIVERABLE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.deliverableStatus && <p className="mt-1 text-[11px] text-rose-600">{errors.deliverableStatus}</p>}
        </label>
        <div className="hidden md:block" aria-hidden="true" />
      </div>

      <p className="text-[12px] font-semibold text-gray-700 mt-5 mb-3">Deliverables Include</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[11px] text-gray-600 max-h-64 overflow-y-auto pr-1">
        {deliverableMasterRows.length === 0 && !loading ? (
          <p className="text-gray-500 text-xs md:col-span-2">No active deliverable rows in Enjaz Master Data.</p>
        ) : (
          deliverableMasterRows.map((mr) => {
            const id = String(mr.new_enjazmasterdataid ?? '');
            const label = String(mr.new_enjazmasterdata1 ?? '').trim();
            if (!id || !label) return null;
            return (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-secondary rounded"
                  checked={includeByRowId[id] ?? false}
                  disabled={loading || saveBusy}
                  onChange={() => toggleInclude(id)}
                />
                {label}
              </label>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <label className="text-[11px] text-gray-500">Notes</label>
        <textarea
          className="mt-1 w-full h-24 rounded-md border border-gray-200 px-3 py-2 text-sm resize-none"
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading || saveBusy}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button type="button" className={enj.btnOutline} onClick={onClose} disabled={saveBusy}>Cancel</button>
        <button type="button" className={enj.btnPrimary} onClick={() => void handleSave()} disabled={loading || saveBusy}>
          {saveBusy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </section>
  );
}

// ─── SVG Chart: Assigned Tasks / Projects ───────────────────────────────────
type AssignedTasksBar = { label: string; value: number; color: string };

function AssignedTasksChart({ bars, maxValue }: { bars: AssignedTasksBar[]; maxValue?: number }) {
  const H = 110;
  const W = 220;
  const PL = 28;
  const barW = 22;
  const gap = 10;
  const m = maxValue ?? Math.max(1, ...bars.map((b) => b.value), 0);
  const step = m <= 10 ? 2 : m <= 30 ? 5 : m <= 50 ? 10 : Math.ceil(m / 5) * 5 / 5;
  const tickMax = Math.max(step * 5, m);
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => Math.round((tickMax * i) / 5));
  if (bars.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center w-full">No project assignments</p>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H + 44}`} className={enj.chartSvg}>
      {ticks.map((v) => {
        const y = H - (v / tickMax) * H;
        return (
          <g key={v}>
            <line x1={PL} x2={W - 4} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="7" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      {bars.map((d, i) => {
        const x = PL + i * (barW + gap);
        const h = (d.value / tickMax) * H;
        return (
          <g key={d.label + i}>
            <rect x={x} y={H - h} width={barW} height={h} fill={d.color} rx="3" />
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fontSize="6" fill="#6b7280">
              {d.label.length > 7 ? `${d.label.slice(0, 6)}…` : d.label}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H + 28} textAnchor="middle" fontSize="7" fill="#9ca3af" fontStyle="italic">Projects</text>
    </svg>
  );
}

// ─── SVG Chart: Tasks ────────────────────────────────────────────────────────
type TasksChartBar = { label: [string, string?]; value: number; color: string };

function TasksChart({ bars }: { bars: TasksChartBar[] }) {
  const H = 110;
  const barW = 26;
  const gap = 8;
  const PL = 6;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const W = Math.max(PL + bars.length * (barW + gap) + 4, 120);
  if (bars.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center w-full">No task data</p>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H + 36}`} className={enj.chartSvg}>
      {bars.map((d, i) => {
        const x = PL + i * (barW + gap);
        const h = (d.value / max) * H;
        return (
          <g key={i}>
            <text x={x + barW / 2} y={H - h - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#374151">{d.value}</text>
            <rect x={x} y={H - h} width={barW} height={h} fill={d.color} rx="4" />
            {d.label.map((word, wi) => (
              <text key={wi} x={x + barW / 2} y={H + 10 + wi * 9} textAnchor="middle" fontSize="5.5" fill="#6b7280">{word}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG Chart: Issues Donut ─────────────────────────────────────────────────
function IssuesDonut({
  open,
  inProgress,
  closed,
  total,
}: {
  open: number;
  inProgress: number;
  closed: number;
  total: number;
}) {
  const slices = [
    { label: 'Open', value: Math.max(0, open), color: '#d3525a' as const },
    { label: 'In Prog', value: Math.max(0, inProgress), color: '#3b3a80' as const },
    { label: 'Resolved', value: Math.max(0, closed), color: '#1667de' as const },
  ];
  const has = slices.some((s) => s.value > 0);
  return (
    <div className="flex items-center gap-2">
      <DonutChart
        className="h-48 w-48 flex-shrink-0 chart-svg"
        ringWidth={38}
        showOuterLabels={false}
        centerText={String(total)}
        centerSubtext="issues"
        slices={has ? slices : [{ label: 'No Data', value: 1, color: '#e5e7eb' }]}
      />
      <div className="space-y-2 text-xs min-w-[100px]">
        {[
          { label: 'Open', val: open, color: '#d3525a' },
          { label: 'In Prog', val: inProgress, color: '#3b3a80' },
          { label: 'Resolved', val: closed, color: '#1667de' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-gray-500 w-12">{item.label}</span>
            <span className="font-semibold text-gray-700">{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Badge helper ─────────────────────────────────────────────────────────────
function Badge({ label }: { label: string }) {
  const map: Record<string, string> = {
    HIGH:        'bg-red-100 text-red-700',
    LOW:         'bg-blue-100 text-blue-700',
    MEDIUM:      'bg-teal-100 text-teal-700',
    BUG:         'bg-red-100 text-red-700',
    'IN PROGRESS': 'bg-yellow-100 text-yellow-700',
    DONE:        'bg-green-100 text-green-700',
    UAT:         'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="enj-table-progress-track w-24 max-w-full">
        <div className="enj-table-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-[#6B7280]">{pct}%</span>
    </div>
  );
}

function ProfileDropdown({ onLogout, roleLabel }: { onLogout: () => void; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState('pms');
  const [profileEmail, setProfileEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const items = [
    { label: 'User Profile', icon: <UserCircle size={14} className="text-[#c7a56a]" /> },
    { label: 'Inbox', icon: <Inbox size={14} className="text-[#c7a56a]" /> },
    { label: 'Activity History', icon: <Activity size={14} className="text-[#c7a56a]" /> },
    { label: 'Help', icon: <HelpCircle size={14} className="text-[#c7a56a]" /> },
  ];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchSessionUserProfileFromUsers({ fallbackToFirstRow: true });
        if (cancelled || !profile) return;
        if (profile.displayName) setDisplayName(profile.displayName);
        if (profile.email) setProfileEmail(profile.email);
      } catch {
        // keep fallback defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((v) => (v + 1) % (items.length + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((v) => (v - 1 + items.length + 1) % (items.length + 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex === items.length) {
        onLogout();
      }
      setOpen(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          aria-label="Profile menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="w-8 h-8 rounded-full bg-[#b28a44] text-white text-[10px] font-semibold flex items-center justify-center" title={profileEmail || displayName}>{initials}</div>
          <ChevronDown size={13} className="text-gray-400" />
        </button>
        {open && (
          <div
            ref={menuRef}
            tabIndex={0}
            onKeyDown={onMenuKeyDown}
            className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-gray-200 bg-white shadow-xl outline-none"
          >
            <div className="px-3 py-3 border-b border-gray-100">
              <p className="enj-screen-subheader">{displayName}</p>
              <p className="text-[10px] text-gray-400">{roleLabel}</p>
            </div>
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (item.label === 'User Profile') {
                      setUserProfileOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Activity History') {
                      setActivityHistoryOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Inbox') {
                      window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
                      setOpen(false);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                    activeIndex === index ? 'bg-gray-50 text-primary' : 'text-gray-500'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-1">
              <button
                type="button"
                onClick={onLogout}
                onMouseEnter={() => setActiveIndex(items.length)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 rounded-lg ${
                  activeIndex === items.length ? 'bg-red-50 text-red-600' : 'text-gray-500'
                }`}
              >
                <LogOut size={14} className={activeIndex === items.length ? 'text-red-500' : 'text-[#c7a56a]'} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      <UserProfileModal open={userProfileOpen} onClose={() => setUserProfileOpen(false)} />
      <ActivityHistoryModal open={activityHistoryOpen} onClose={() => setActivityHistoryOpen(false)} />
    </>
  );
}

// ─── Team Dashboard ───────────────────────────────────────────────────────────
function teamTaskAssigneeMatch(row: Record<string, unknown>, profile: SessionUserProfile | null): boolean {
  if (!profile?.email && !profile?.displayName) return true;
  const email = (profile?.email ?? '').toLowerCase();
  const name = (profile?.displayName ?? '').toLowerCase();
  const local = email.split('@')[0] ?? '';
  const f = String(row.new_assigntoteammember ?? '').toLowerCase();
  if (!f.trim()) return false;
  if (email && f.includes(email)) return true;
  if (local.length > 0 && f.includes(local)) return true;
  if (name && f.includes(name)) return true;
  return name.split(/\s+/).filter((p) => p.length > 1).some((p) => f.includes(p));
}
function teamIssueUserMatch(row: Record<string, unknown>, profile: SessionUserProfile | null): boolean {
  if (!profile?.email && !profile?.displayName) return true;
  const email = (profile?.email ?? '').toLowerCase();
  const name = (profile?.displayName ?? '').toLowerCase();
  const local = email.split('@')[0] ?? '';
  const f = String(row.new_issueowner ?? row.new_assigntoteammember ?? '').toLowerCase();
  if (!f.trim()) return true;
  if (email && f.includes(email)) return true;
  if (local.length > 0 && f.includes(local)) return true;
  if (name && f.includes(name)) return true;
  return name.split(/\s+/).filter((p) => p.length > 1).some((p) => f.includes(p));
}
function teamFormatShortDate(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString();
}
function teamIssueCardDueDate(row: Record<string, unknown>) {
  const v = row.new_issuedate ?? row.modifiedon ?? row.createdon;
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function teamIssueCardPriorityMeta(row: Record<string, unknown>): { p: string; ring: string } {
  const n = Number(row.new_issueseverity ?? NaN);
  if (n === 100000003) return { p: 'P1', ring: 'bg-rose-600' };
  if (n === 100000002) return { p: 'P2', ring: 'bg-amber-500' };
  if (n === 100000001) return { p: 'P3', ring: 'bg-emerald-600' };
  if (n === 100000000) return { p: 'P4', ring: 'bg-emerald-600' };
  return { p: 'P4', ring: 'bg-emerald-600' };
}
function teamTaskIsDelayed(row: Record<string, unknown>) {
  const st = String(row.new_taskstatusname ?? '').toLowerCase();
  const stn = Number(row.new_taskstatus ?? NaN);
  if (st.includes('complet') || stn === 100000002) return false;
  const end = parseTimelineDate(row.new_enddate);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}
function teamTaskIsBug(row: Record<string, unknown>) {
  const t = String(row.new_tasktitle ?? '').toLowerCase();
  const s = String(row.new_taskstatusname ?? '').toLowerCase();
  return t.includes('bug') || s.includes('bug');
}
function teamTaskStatusDisplay(row: Record<string, unknown>) {
  const s = String(row.new_taskstatusname ?? '').toUpperCase();
  if (s) return s.replace(/\s+/g, ' ').slice(0, 18);
  const n = Number(row.new_taskstatus);
  if (n === 100000000) return 'NOT STARTED';
  if (n === 100000001) return 'IN PROGRESS';
  if (n === 100000002) return 'DONE';
  if (n === 100000003) return 'ON HOLD';
  return 'IN PROGRESS';
}
function teamTaskProgressPct(row: Record<string, unknown>) {
  const p = String(row.new_progresslevel ?? row.new_progress ?? '').trim();
  const n = Number(p);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return 0;
}

function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function meetingShortDate(value: unknown): string {
  const d = parseTimelineDate(value);
  return d ? d.toLocaleDateString() : '—';
}

function MeetingsBoardPanel({
  meetings,
  onNewMeeting,
  onNotify,
  loading,
}: {
  meetings: Array<Record<string, unknown>>;
  onNewMeeting: () => void;
  onNotify: (type: ToastType, message: string) => void;
  loading?: boolean;
}) {
  const [showMom, setShowMom] = useState(false);
  const [projectFilter, setProjectFilter] = useState('All');
  const [selectedDateIso, setSelectedDateIso] = useState(() => localIsoDate(new Date()));
  const projectOptions = useMemo(
    () => Array.from(new Set(meetings.map((r) => String(r.new_projectname ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [meetings],
  );
  const filteredMeetings = useMemo(() => {
    let rows = projectFilter === 'All' ? meetings : meetings.filter((r) => String(r.new_projectname ?? '').trim() === projectFilter);
    return rows.filter((r) => {
      const d = parseTimelineDate(r.new_meetingdatetime ?? r.new_meetingdate);
      return d ? localIsoDate(d) === selectedDateIso : false;
    });
  }, [meetings, projectFilter, selectedDateIso]);
  const blocks = useMemo(() => {
    const colors = ['#17c983', '#2563eb', '#f6be00', '#21c784', '#d35b66', '#474d7f'];
    return filteredMeetings.slice(0, 10).map((row, i) => {
      const start = String(row.new_starttime ?? '10:00:00');
      const hr = parseInt(String(start).split(':')[0] ?? '10', 10) || 10;
      const link = String(row.new_meetinglink ?? '').trim();
      return {
        id: String(row.new_meetingdetailid ?? i),
        title: String(row.new_meetingtitle ?? 'Meeting'),
        top: Math.min(340, Math.max(32, 40 + (hr - 8) * 28 + (i % 4) * 6)),
        left: 2 + (i % 6) * 64 + (i % 3) * 18,
        color: colors[i % colors.length]!,
        joinUrl: /^https?:\/\//i.test(link) ? link : undefined,
      };
    });
  }, [filteredMeetings]);
  const categories = useMemo(() => {
    const m = new Map<string, { hrs: number; n: number }>();
    filteredMeetings.forEach((row) => {
      const c = String(row.new_meetingcategory ?? 'Other').trim() || 'Other';
      const h = Number(row.new_durationhours);
      m.set(c, { hrs: (m.get(c)?.hrs ?? 0) + (Number.isFinite(h) ? h : 0), n: (m.get(c)?.n ?? 0) + 1 });
    });
    return Array.from(m.entries()).slice(0, 10).map(([name, v], i) => ({ name, hrs: v.hrs, n: v.n, bg: ['#c9f4e4', '#e9edff', '#f7eed8', '#eef0ff'][i % 4]!, text: ['#138f6f', '#4c64bf', '#b8872e', '#4d5bb7'][i % 4]! }));
  }, [filteredMeetings]);

  return (
    <section className={enj.screenContainer}>
      {loading && <ScreenLoader overlay className="rounded-xl" />}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <h2 className="enj-screen-header">Meetings</h2>
          <div className="flex items-center gap-3 text-xs">
            <label className="text-gray-500 flex items-center gap-2"><span>Project Name</span><select className={`${enj.control} !w-auto max-w-[170px] text-sm text-gray-600`} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="All">All</option>{projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <label className="text-gray-500 flex items-center gap-2"><span>Date</span><input type="date" className={`${enj.control} !w-auto text-sm`} value={selectedDateIso} onChange={(e) => setSelectedDateIso(e.target.value)} /></label>
            <button type="button" onClick={() => { setSelectedDateIso(localIsoDate(new Date())); setShowMom(false); }} className={`${enj.btn} ${enj.btnOutline} rounded-full px-3 text-sm`}>Today</button>
            <button type="button" onClick={() => setShowMom((v) => !v)} className={`${enj.btn} ${enj.btnOutline} text-sm`}>MOM</button>
          </div>
        </div>
        <button type="button" onClick={onNewMeeting} className={`${enj.btn} ${enj.btnPrimary} text-sm font-semibold`}>+ New Meeting</button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
        {showMom ? (
          <section className="bg-white rounded-xl p-3">
            <p className="text-[16px] font-bold text-primary mb-2">Meetings {'>'} MOM</p>
            <table className={`${enj.table} w-full text-[10px]`}><thead><tr><th>Meeting Title</th><th>Category</th><th>Project Name</th><th>Date</th><th className="text-right">Join</th></tr></thead><tbody>{filteredMeetings.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500">No meetings for selected project/date.</td></tr> : filteredMeetings.map((mrow) => { const join = String(mrow.new_meetinglink ?? '').trim(); const canOpen = /^https?:\/\//i.test(join); return <tr key={String(mrow.new_meetingdetailid ?? mrow.createdon)} className="border-b border-gray-100 text-[11px] text-gray-700"><td className="px-3 py-3 font-semibold">{canOpen ? <a href={join} target="_blank" rel="noopener noreferrer" className={enj.tableLink}>{String(mrow.new_meetingtitle ?? '—')}</a> : String(mrow.new_meetingtitle ?? '—')}</td><td className="px-3 py-3">{String(mrow.new_meetingcategory ?? '—')}</td><td className="px-3 py-3">{String(mrow.new_projectname ?? '—')}</td><td className="px-3 py-3 text-gray-500">{meetingShortDate(mrow.new_meetingdate)}</td><td className="px-3 py-3 text-right">{canOpen ? <a href={join} target="_blank" rel="noopener noreferrer" className={`${enj.tableLink} underline`}>Join</a> : <span className="text-gray-300">—</span>}</td></tr>; })}</tbody></table>
          </section>
        ) : (
          <section className="bg-white rounded-xl p-3"><div className="grid grid-cols-[44px_1fr]"><div className="text-[10px] text-gray-300 space-y-8 pt-2">{['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => <p key={time}>{time}</p>)}</div><div className="relative h-[410px] rounded-lg border border-gray-100 bg-[repeating-linear-gradient(to_right,#f6f7fb_0,#f6f7fb_1px,transparent_1px,transparent_16.66%)]">{[15, 73, 139, 205, 271, 337].map((x) => <div key={x} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: x }} />)}{blocks.length === 0 ? <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No meetings for selected day</p> : blocks.map((item) => <button key={item.id} type="button" className="absolute h-8 max-w-[200px] cursor-pointer rounded-full px-3 text-left text-white text-[9px] font-semibold flex items-center truncate shadow-sm" style={{ top: item.top, left: item.left, backgroundColor: item.color }} onClick={() => { if (item.joinUrl) window.open(item.joinUrl, '_blank', 'noopener,noreferrer'); else onNotify('info', 'No Teams join link yet for this meeting.'); }}>{item.title}</button>)}</div></div></section>
        )}
        <section className="bg-white rounded-xl p-3"><p className="text-[9px] text-gray-400 uppercase">Current Day</p><h3 className="text-sm font-semibold text-primary mb-2">Scheduled Meetings</h3><div className="space-y-2">{categories.length === 0 ? <p className="text-xs text-gray-400 py-2">No scheduled meeting categories.</p> : categories.map((row) => <div key={row.name} className="rounded-full px-3 py-1.5 flex items-center justify-between" style={{ backgroundColor: row.bg }}><div><p className="text-[10px] font-semibold" style={{ color: row.text }}>{row.name}</p><p className="text-[9px] text-gray-400">{row.hrs > 0 ? `${row.hrs} HRS` : '—'}</p></div><span className="w-5 h-5 rounded-full bg-white/80 text-[10px] font-semibold flex items-center justify-center" style={{ color: row.text }}>{row.n}</span></div>)}</div></section>
      </div>
    </section>
  );
}

function TeamDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [showCalendarMom, setShowCalendarMom] = useState(false);
  const [showAddCalendarMeetingForm, setShowAddCalendarMeetingForm] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [editingTaskRow, setEditingTaskRow] = useState<Record<string, unknown> | null>(null);
  const [teamTaskDeleteCandidate, setTeamTaskDeleteCandidate] = useState<Record<string, unknown> | null>(null);
  const [deletingTeamTask, setDeletingTeamTask] = useState(false);
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [showTeamSubIssueForm, setShowTeamSubIssueForm] = useState(false);
  /** If true, closing sub-issue form returns to read-only issue detail; if false, returns to the register. */
  const [teamSubIssueFromDetail, setTeamSubIssueFromDetail] = useState(false);
  const [showTeamTaskDetail, setShowTeamTaskDetail] = useState(false);
  const [showTeamSubTaskForm, setShowTeamSubTaskForm] = useState(false);
  /** If true, closing sub-task form returns to task detail; if false, returns to list. */
  const [teamSubTaskFromDetail, setTeamSubTaskFromDetail] = useState(false);
  const [viewingTaskRow, setViewingTaskRow] = useState<Record<string, unknown> | null>(null);
  const [viewingIssueRow, setViewingIssueRow] = useState<Record<string, unknown> | null>(null);
  const [teamSessionProfile, setTeamSessionProfile] = useState<SessionUserProfile | null>(null);
  const [teamWorkspaceLoading, setTeamWorkspaceLoading] = useState(true);
  const [teamAllTasks, setTeamAllTasks] = useState<Array<Record<string, unknown>>>([]);
  const [teamAllIssues, setTeamAllIssues] = useState<Array<Record<string, unknown>>>([]);
  const [teamAllProjects, setTeamAllProjects] = useState<Array<Record<string, unknown>>>([]);
  const [teamAllMeetings, setTeamAllMeetings] = useState<Array<Record<string, unknown>>>([]);
  const [teamAllSubIssues, setTeamAllSubIssues] = useState<Array<Record<string, unknown>>>([]);
  const [teamAllMembers, setTeamAllMembers] = useState<Array<Record<string, unknown>>>([]);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);

  const navItems = [
    { name: 'Dashboard', icon: <LayoutGrid size={16} /> },
    { name: 'Projects',  icon: <FolderOpen size={16} /> },
    { name: 'Timeline',  icon: <Clock size={16} /> },
    { name: 'Tasks',     icon: <CheckSquare size={16} /> },
    { name: 'Issues',    icon: <AlertCircle size={16} /> },
    { name: 'Meetings',  icon: <Calendar size={16} /> },
  ];
  const [teamTaskListRefresh, setTeamTaskListRefresh] = useState(0);
  const [teamProjectToast, setTeamProjectToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [teamIssueToast, setTeamIssueToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [teamTaskToast, setTeamTaskToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [teamTimelineYear, setTeamTimelineYear] = useState(() => new Date().getFullYear());
  const [teamCalendarProjectFilter, setTeamCalendarProjectFilter] = useState('All');
  const [teamCalendarSelectedDateIso, setTeamCalendarSelectedDateIso] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });

  const myTasks = useMemo(
    () => teamAllTasks.filter((r) => teamTaskAssigneeMatch(r, teamSessionProfile)),
    [teamAllTasks, teamSessionProfile],
  );
  const myIssues = useMemo(
    () => teamAllIssues.filter((r) => teamIssueUserMatch(r, teamSessionProfile)),
    [teamAllIssues, teamSessionProfile],
  );
  /** Project names where the current user has at least one task or issue. */
  const myProjectNameSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of myTasks) {
      const n = String(t.new_projectname ?? '').trim();
      if (n) s.add(n);
    }
    for (const r of myIssues) {
      const n = String(r.new_projectname ?? '').trim();
      if (n) s.add(n);
    }
    return s;
  }, [myTasks, myIssues]);
  const uniqueProjectCount = myProjectNameSet.size;
  /** Board + charts: one row per participated project (registry match or minimal row from first task/issue). */
  const myProjectsAug = useMemo(() => {
    if (myProjectNameSet.size === 0) return [];
    const byName = new Map<string, Record<string, unknown>>();
    for (const p of teamAllProjects) {
      const n = String(p.new_projectname ?? p.new_name ?? '').trim();
      if (n && myProjectNameSet.has(n) && !byName.has(n)) byName.set(n, p);
    }
    const names = Array.from(myProjectNameSet).sort((a, b) => a.localeCompare(b));
    return names.map((name) => {
      if (byName.has(name)) return byName.get(name)!;
      const t = myTasks.find((x) => String(x.new_projectname ?? '').trim() === name);
      const i = myIssues.find((x) => String(x.new_projectname ?? '').trim() === name);
      return {
        new_projectname: name,
        new_name: name,
        new_startdate: t?.new_startdate ?? i?.new_issuedate,
        new_strategicgoal: t?.new_strategicgoal ?? t?.new_tasktitle ?? i?.new_issuetitle,
      } as Record<string, unknown>;
    });
  }, [teamAllProjects, myProjectNameSet, myTasks, myIssues]);
  const teamProjectsExternal = useMemo(
    () => ({ rows: myProjectsAug, loading: teamWorkspaceLoading }),
    [myProjectsAug, teamWorkspaceLoading],
  );
  const teamTodayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const projectSponsorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of teamAllProjects) {
      const n = String(p.new_projectname ?? p.new_name ?? '').trim();
      if (n) m.set(n, String(p.crcf8_projectsponsorname ?? p.crcf8_projectsponsor ?? '—').trim() || '—');
    }
    return m;
  }, [teamAllProjects]);
  const myMeetings = useMemo(() => {
    const em = (teamSessionProfile?.email ?? '').toLowerCase();
    if (!em) return teamAllMeetings;
    return teamAllMeetings.filter((row) => {
      const inv = String(row.new_invitememberemails ?? '').toLowerCase();
      if (inv && (inv.includes(em) || inv.includes((em.split('@')[0] ?? '')))) return true;
      const p = String(row.new_projectname ?? '').trim();
      return p.length > 0 && myProjectNameSet.has(p);
    });
  }, [teamAllMeetings, teamSessionProfile, myProjectNameSet]);
  const teamNotifications = useMemo(
    () =>
      buildInboxNotifications('team', {
        teamMembers: teamAllMembers,
        projects: teamAllProjects,
        tasks: myTasks,
        myProjectNameSet,
        sessionEmail: getSessionUserEmail() ?? undefined,
      }),
    [teamAllMembers, teamAllProjects, myTasks, myProjectNameSet],
  );

  const teamCalendarFilteredMeetings = useMemo(() => {
    let rows = myMeetings;
    if (teamCalendarProjectFilter !== 'All') {
      const p = teamCalendarProjectFilter.trim();
      rows = rows.filter((r) => String(r.new_projectname ?? '').trim() === p);
    }
    rows = rows.filter((r) => {
      const d = parseTimelineDate(r.new_meetingdatetime ?? r.new_meetingdate);
      if (!d) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === teamCalendarSelectedDateIso;
    });
    return rows;
  }, [myMeetings, teamCalendarProjectFilter, teamCalendarSelectedDateIso]);

  const teamDashboardAssignedChart = useMemo((): { bars: { label: string; value: number; color: string }[]; max: number } => {
    const byP = new Map<string, number>();
    for (const t of myTasks) {
      const p = String(t.new_projectname ?? 'Unassigned').trim() || 'Unassigned';
      byP.set(p, (byP.get(p) ?? 0) + 1);
    }
    const palette = ['#94a3b8', '#fbbf24', '#a3a36a', '#f87171', '#60a5fa', '#c4b5fd'];
    const top = Array.from(byP.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const bars = top.map(([label, value], i) => ({ label, value, color: palette[i % 6]! }));
    return { bars, max: Math.max(1, ...top.map(([, v]) => v)) };
  }, [myTasks]);
  const teamDashboardTasksChart = useMemo((): { bars: { label: [string, string?]; value: number; color: string }[] } => {
    const c = { not: 0, done: 0, delay: 0, hold: 0, prog: 0 };
    for (const r of myTasks) {
      const s = String(r.new_taskstatusname ?? '').toLowerCase();
      const stn = Number(r.new_taskstatus ?? NaN);
      if (stn === 100000002 || s.includes('complet')) c.done += 1;
      else if (stn === 100000003 || s.includes('hold')) c.hold += 1;
      else if (s.includes('delay') || teamTaskIsDelayed(r)) c.delay += 1;
      else if (stn === 100000001 || s.includes('progress')) c.prog += 1;
      else c.not += 1;
    }
    return {
      bars: [
        { label: ['TO', 'DO'], value: c.not, color: '#60a5fa' },
        { label: ['DONE'], value: c.done, color: '#34d399' },
        { label: ['DELAYED'], value: c.delay, color: '#fb923c' },
        { label: ['ON', 'HOLD'], value: c.hold, color: '#f87171' },
        { label: ['IN', 'PROGRESS'], value: c.prog, color: '#a3e635' },
      ],
    };
  }, [myTasks]);
  const teamIssueDistribution = useMemo(() => {
    let openC = 0;
    let inP = 0;
    let closedC = 0;
    for (const r of myIssues) {
      const s = String(r.new_issuestatusname ?? '').toLowerCase();
      const stn = Number(r.new_issuestatus ?? NaN);
      if (stn === 100000001 || s.includes('progress')) inP += 1;
      else if (stn === 100000002 || stn === 100000003 || s.includes('resolv') || s.includes('closed') || s.includes('solved')) closedC += 1;
      else openC += 1;
    }
    return { open: openC, inProgress: inP, closed: closedC, total: myIssues.length };
  }, [myIssues]);
  const teamSubIssueCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of teamAllSubIssues) {
      const pid = String(s.new_issueid ?? '').trim();
      if (!pid) continue;
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
    return m;
  }, [teamAllSubIssues]);
  const teamIssuesRegister = useMemo(() => {
    const byP = new Map<string, number>();
    for (const r of myIssues) {
      const p = String(r.new_projectname ?? 'Unassigned').trim() || 'Unassigned';
      byP.set(p, (byP.get(p) ?? 0) + 1);
    }
    const top3 = Array.from(byP.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const maxV = Math.max(1, ...top3.map(([, n]) => n));
    const colors = ['#b28a44', '#6ea3ef', '#44527f'] as const;
    const sev = { high: 0, med: 0, low: 0, crit: 0 };
    for (const r of myIssues) {
      const sn = String(r.new_issueseverityname ?? '').toLowerCase();
      const raw = Number(r.new_issueseverity ?? NaN);
      if (sn.includes('critical') || raw === 100000003) sev.crit += 1;
      else if (sn.includes('high') || raw === 100000002) sev.high += 1;
      else if (sn.includes('medium') || raw === 100000001) sev.med += 1;
      else sev.low += 1;
    }
    const st = { open: 0, closed: 0 };
    for (const r of myIssues) {
      const s = String(r.new_issuestatusname ?? '').toLowerCase();
      const stn = Number(r.new_issuestatus ?? NaN);
      if (stn === 100000002 || stn === 100000003 || s.includes('resolv') || s.includes('closed') || s.includes('solved')) st.closed += 1;
      else st.open += 1;
    }
    return { projectBars: top3.map(([name, n], i) => ({ name: name.length > 10 ? `${name.slice(0, 9)}…` : name, n, h: (n / maxV) * 50, color: colors[i % 3]! })), sev, st };
  }, [myIssues]);
  const teamOpenIssues = useMemo(
    () => myIssues.filter((r) => {
      const s = String(r.new_issuestatusname ?? '').toLowerCase();
      const stn = Number(r.new_issuestatus ?? NaN);
      return !(stn === 100000002 || stn === 100000003 || s.includes('resolv') || s.includes('closed') || s.includes('solved'));
    }),
    [myIssues],
  );
  const teamClosedIssues = useMemo(
    () => myIssues.filter((r) => {
      const s = String(r.new_issuestatusname ?? '').toLowerCase();
      const stn = Number(r.new_issuestatus ?? NaN);
      return stn === 100000002 || stn === 100000003 || s.includes('resolv') || s.includes('closed') || s.includes('solved');
    }),
    [myIssues],
  );
  const teamCalendarCategoryRows = useMemo(() => {
    const m = new Map<string, { hrs: number; n: number }>();
    for (const row of teamCalendarFilteredMeetings) {
      const c = String(row.new_meetingcategory ?? 'Other').trim() || 'Other';
      const h = Number(row.new_durationhours);
      m.set(c, { hrs: (m.get(c)?.hrs ?? 0) + (Number.isFinite(h) ? h : 0), n: (m.get(c)?.n ?? 0) + 1 });
    }
    const palette = [
      ['#c9f4e4', '#138f6f'], ['#e9edff', '#4c64bf'], ['#f7eed8', '#b8872e'], ['#eef0ff', '#4d5bb7'], ['#fdf4dd', '#b4882a'],
      ['#ffe6e8', '#cb4e59'], ['#e9e4ff', '#6958bb'], ['#e2f7ef', '#2f9879'], ['#ffe6e6', '#ca5454'], ['#f5eedf', '#9a7a35'],
    ] as [string, string][];
    return Array.from(m.entries())
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 10)
      .map(([name, v], i) => ({
        name,
        hrs: v.hrs,
        n: v.n,
        bg: palette[i % palette.length]![0]!,
        text: palette[i % palette.length]![1]!,
      }));
  }, [teamCalendarFilteredMeetings]);
  const teamCalendarGridBlocks = useMemo(() => {
    const colors = ['#17c983', '#2563eb', '#f6be00', '#21c784', '#d35b66', '#474d7f', '#2f9879', '#b8872e'];
    return teamCalendarFilteredMeetings.slice(0, 10).map((row, i) => {
      const d = parseTimelineDate(row.new_meetingdate);
      const start = String(row.new_starttime ?? '10:00:00');
      const hr = parseInt(String(start).split(':')[0] ?? '10', 10) || 10;
      const top = 40 + (hr - 8) * 28 + (i % 4) * 6;
      const daySlot = d ? d.getDate() % 6 : i % 6;
      const link = String(row.new_meetinglink ?? '').trim();
      return {
        id: String(row.new_meetingdetailid ?? i),
        title: String(row.new_meetingtitle ?? 'Meeting'),
        top: Math.min(340, Math.max(32, top)),
        left: 2 + daySlot * 64 + (i % 3) * 18,
        color: colors[i % colors.length]!,
        joinUrl: link && /^https?:\/\//i.test(link) ? link : undefined,
      };
    });
  }, [teamCalendarFilteredMeetings]);
  const teamDashboardTasksTable = useMemo(
    () => myTasks.map((row) => {
      const pn = String(row.new_projectname ?? '—');
      const PRIORITY_MAP: Record<number, string> = { 100000000: 'Low', 100000001: 'Medium', 100000002: 'High' };
      const priorityRaw = String(row.new_priorityname ?? row.new_priority ?? 'Medium').trim();
      const priority = PRIORITY_MAP[Number(priorityRaw)] ?? priorityRaw;
      return {
        key: String(row.new_taskid ?? row.createdon),
        project: pn,
        task: String(row.new_tasktitle ?? '—'),
        priority,
        status: teamTaskStatusDisplay(row),
        pm: String((row as Record<string, unknown>).crcf8_projectmanagername ?? (row as Record<string, unknown>).crcf8_projectmanager ?? row.new_projectmanager ?? '—'),
        sponsor: projectSponsorByName.get(pn) ?? '—',
        milestone: String(row.new_subtaskname ?? (Number(row.new_subtask) === 100000001 ? 'Yes' : '—')),
        start: teamFormatShortDate(row.new_startdate),
        end: teamFormatShortDate(row.new_enddate),
        pct: teamTaskProgressPct(row),
      };
    }),
    [myTasks, projectSponsorByName],
  );
  const overviewCards = useMemo(
    () => {
      const loading = teamWorkspaceLoading;
      const n = (v: number) => (loading ? '—' : String(v)) as string;
      return [
        { label: 'Projects', value: n(uniqueProjectCount), border: 'border-blue-500' },
        { label: 'Delayed Tasks', value: n(myTasks.filter(teamTaskIsDelayed).length), border: 'border-yellow-400' },
        { label: 'Bugs', value: n(myTasks.filter(teamTaskIsBug).length), border: 'border-red-400' },
        { label: 'Issues', value: n(myIssues.length), border: 'border-amber-500' },
        { label: 'Assigned Tasks', value: n(myTasks.length), border: 'border-green-400' },
        { label: 'Meetings', value: n(myMeetings.length), border: 'border-purple-400' },
      ];
    },
    [teamWorkspaceLoading, uniqueProjectCount, myTasks, myIssues],
  );

  const teamTimelineProjects = useMemo(() => {
    const s = new Set<string>();
    for (const r of myTasks) {
      s.add(String(r.new_projectname ?? 'Unassigned').trim() || 'Unassigned');
    }
    for (const r of myIssues) {
      s.add(String(r.new_projectname ?? 'Unassigned').trim() || 'Unassigned');
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [myTasks, myIssues]);
  const [teamTimelineProjectFilter, setTeamTimelineProjectFilter] = useState('All');
  /** Same week/quarter/month axis model as the Project (role) timeline (`businessYearWeekTimelineModel`). */
  const teamTimelineRange = useMemo(() => businessYearWeekTimelineModel(teamTimelineYear), [teamTimelineYear]);
  const teamTimelineAxisMinWidth = useMemo(() => {
    const n = Math.max(1, teamTimelineRange.bottomLabels.length);
    return Math.max(1200, n * 22);
  }, [teamTimelineRange.bottomLabels.length]);

  const teamTimelineTasks = useMemo(() => {
    const colorForStatus = (name: string) => {
      const v = name.toLowerCase();
      if (v.includes('completed') || v.includes('done')) return '#16a34a';
      if (v.includes('progress')) return '#2563eb';
      if (v.includes('hold') || v.includes('delay')) return '#f59e0b';
      return '#59628a';
    };
    const startMs = teamTimelineRange.start.getTime();
    const endExclusive = teamTimelineRange.endExclusive.getTime();
    const totalMs = Math.max(1, endExclusive - startMs);
    return myTasks
      .filter((r) => teamTimelineProjectFilter === 'All' || (String(r.new_projectname ?? 'Unassigned').trim() || 'Unassigned') === teamTimelineProjectFilter)
      .map((r, idx) => {
        const s = parseTimelineDate(r.new_startdate);
        const e = parseTimelineDate(r.new_enddate) ?? s;
        if (!s || !e) return null;
        const projectEndExcl = exclusiveEndAfterInclusiveDate(e);
        if (projectEndExcl <= s.getTime()) return null;
        const clipS = Math.max(startMs, s.getTime());
        const clipE = Math.min(endExclusive, projectEndExcl);
        if (clipE <= startMs || clipS >= endExclusive) return null;
        const startPct = ((clipS - startMs) / totalMs) * 100;
        const endPct = ((clipE - startMs) / totalMs) * 100;
        const title = String(r.new_tasktitle ?? 'Task').trim() || 'Task';
        const progress = Number(r.new_progresslevel ?? r.new_progress ?? NaN);
        return {
          id: String(r.new_taskid ?? idx),
          project: String(r.new_projectname ?? 'Unassigned').trim() || 'Unassigned',
          title,
          start: s,
          end: e,
          progress: Number.isFinite(progress) ? `${Math.max(0, Math.min(100, progress))}%` : '0%',
          color: colorForStatus(String(r.new_taskstatusname ?? '')),
          left: startPct,
          width: Math.max(2, endPct - startPct),
          row: idx + 1,
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [myTasks, teamTimelineProjectFilter, teamTimelineRange]);

  useEffect(() => {
    if (teamTimelineProjectFilter !== 'All' && !teamTimelineProjects.includes(teamTimelineProjectFilter)) {
      setTeamTimelineProjectFilter('All');
    }
  }, [teamTimelineProjectFilter, teamTimelineProjects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTeamWorkspaceLoading(true);
      try {
        const sp = await fetchSessionUserProfileFromUsers({ fallbackToFirstRow: true });
        if (!cancelled) setTeamSessionProfile(sp);
        const [tRes, iRes, pRes, mRes, sRes, tmRes] = await Promise.all([
          New_tasksService.getAll({ top: 2000, orderBy: ['modifiedon desc'] }),
          New_issuesService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_projectsService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
          New_meetingdetailsService.getAll({ top: 2000, orderBy: ['new_meetingdate desc'] }),
          New_subissuesService.getAll({ top: 5000, orderBy: ['createdon desc'] }),
          New_teammembersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;
        setTeamAllTasks(tRes.success ? ((tRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setTeamAllIssues(iRes.success ? ((iRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setTeamAllProjects(pRes.success ? ((pRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setTeamAllMeetings(mRes.success ? ((mRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setTeamAllSubIssues(sRes.success ? ((sRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setTeamAllMembers(tmRes.success ? ((tmRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
      } catch {
        if (!cancelled) {
          setTeamAllTasks([]);
          setTeamAllIssues([]);
          setTeamAllProjects([]);
          setTeamAllMeetings([]);
          setTeamAllSubIssues([]);
          setTeamAllMembers([]);
        }
      } finally {
        if (!cancelled) setTeamWorkspaceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRefreshKey, teamTaskListRefresh]);

  const confirmDeleteTeamTask = async () => {
    const row = teamTaskDeleteCandidate;
    if (!row) return;
    const id = String(row.new_taskid ?? '').trim();
    if (!id) {
      setTeamTaskDeleteCandidate(null);
      return;
    }
    setDeletingTeamTask(true);
    try {
      await New_tasksService.delete(id);
      setTeamTaskListRefresh((k) => k + 1);
      setWorkspaceRefreshKey((k) => k + 1);
      setTeamTaskDeleteCandidate(null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete task');
    } finally {
      setDeletingTeamTask(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      {/* ── Sidebar ── */}
      <aside className="z-[60] w-52 bg-white border-r border-gray-100 flex min-h-0 flex-col flex-shrink-0 pb-8">
        {/* Logo + wordmark */}
        <div className="h-14 border-b border-gray-100 px-4 flex items-center gap-3">
          <LogoMark />
          <span className="text-base sm:text-lg font-bold tracking-wide text-[#232360]">ENJAZ</span>
        </div>

        {/* Nav items */}
        <nav className="min-h-0 flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              onClick={() => {
                setActiveNav(name);
                if (name !== 'Meetings') {
                  setShowCalendarMom(false);
                  setShowAddCalendarMeetingForm(false);
                }
                if (name !== 'Tasks') {
                  setShowTaskDetails(false);
                  setEditingTaskRow(null);
                  setViewingTaskRow(null);
                }
                if (name !== 'Issues') {
                  setShowIssueDetails(false);
                  setShowTeamSubIssueForm(false);
                  setViewingIssueRow(null);
                }
              }}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name
                  ? 'text-[#A08149] font-semibold'
                  : 'text-[#344054] hover:bg-gray-50 hover:text-[#344054]'
              }`}
            >
              {activeNav === name && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#A08149]" />
              )}
              {icon}
              {name}
            </button>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <ThemeModeToggle />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell items={teamNotifications} />
            <ProfileDropdown onLogout={onLogout} roleLabel="Team" />
          </div>
        </header>

        <main
          className={`flex-1 min-h-0 min-w-0 flex flex-col px-6 pt-6 pb-16 ${
            activeNav === 'Projects' || (activeNav === 'Tasks' && !showTaskDetails && !editingTaskRow)
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          }`}
        >
          <div
            className={
              activeNav === 'Projects' || (activeNav === 'Tasks' && !showTaskDetails && !editingTaskRow)
                ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'
                : 'flex flex-col gap-5 pb-5'
            }
          >
          {activeNav === 'Projects' ? (
            <div className="relative min-h-0 flex min-h-0 flex-1 flex-col overflow-hidden min-w-0">
              {teamProjectToast && (
                <NotificationToast
                  type={teamProjectToast.type}
                  message={teamProjectToast.message}
                  onClose={() => setTeamProjectToast(null)}
                />
              )}
              <ProgramProjectsSection
                todayIso={teamTodayIso}
                onToast={setTeamProjectToast}
                externalProjectRows={teamProjectsExternal}
                onExternalDataInvalidate={() => { setWorkspaceRefreshKey((k) => k + 1); }}
                hideNewProject
                hideSprintAndMembers
                hideEdit
              />
            </div>
          ) : activeNav === 'Timeline' ? (
            <section className={`relative ${enj.screenContainer}`}>
              <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                <h2 className="enj-screen-header">Timeline</h2>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setTeamTaskListRefresh((k) => k + 1);
                      setWorkspaceRefreshKey((k) => k + 1);
                    }}
                    className={`${enj.btn} ${enj.btnOutline} !h-9 !w-9 !min-h-0 !px-0`}
                    title="Refresh timeline"
                    aria-label="Refresh timeline"
                  >
                    <RefreshCw size={14} className={teamWorkspaceLoading ? 'animate-spin' : ''} />
                  </button>
                  <select
                    value={teamTimelineProjectFilter}
                    onChange={(e) => setTeamTimelineProjectFilter(e.target.value)}
                    className={`${enj.control} !w-auto min-w-[10rem] text-sm text-gray-600`}
                  >
                    <option value="All">All Projects</option>
                    {teamTimelineProjects.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamTimelineYear(new Date().getFullYear());
                    }}
                    className={`${enj.btn} ${enj.btnOutline} px-3 text-sm`}
                  >
                    Today
                  </button>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-600 shadow-sm">
                    <button type="button" onClick={() => setTeamTimelineYear((y) => y - 1)}>{'<'}</button>
                    <span className="min-w-[3rem] text-center font-semibold text-primary">{teamTimelineYear}</span>
                    <button type="button" onClick={() => setTeamTimelineYear((y) => y + 1)}>{'>'}</button>
                  </div>
                </div>
              </div>

              <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[280px_1fr]">
                  <aside className="border-r border-gray-100">
                    <div className="h-9 px-3 flex items-center text-[11px] font-semibold text-primary bg-gray-50 border-b border-gray-100">
                      Assigned Tasks
                    </div>
                    <div className="p-2 space-y-2 h-[min(36rem,72vh)] min-h-[16rem] overflow-auto">
                      {teamTimelineTasks.map((task) => (
                        <div key={`left-${task.id}`} className="border border-gray-100 rounded-md p-2">
                          <p className="text-[11px] font-semibold text-primary truncate">{task.title}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{task.project}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatTimelineDateLabel(task.start)} - {formatTimelineDateLabel(task.end)}</p>
                        </div>
                      ))}
                      {!teamWorkspaceLoading && teamTimelineTasks.length === 0 && (
                        <p className="text-[11px] text-gray-400 px-1 py-2">
                          No tasks in selected time window. Change year or project to view bars.
                        </p>
                      )}
                    </div>
                  </aside>

                  <div className="h-[min(36rem,72vh)] min-h-[16rem] w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-contain">
                    <div className="w-full" style={{ minWidth: teamTimelineAxisMinWidth }}>
                      <div className="sticky top-0 z-10 space-y-0.5 border-b border-gray-100 bg-white px-3 py-2 shadow-sm">
                        <p className="text-center text-xs font-bold leading-tight text-primary">
                          {teamTimelineRange.yearLabel}
                        </p>
                        <div
                          className="grid w-full border-b border-slate-100 text-[8px] font-bold text-slate-700"
                          style={{
                            gridTemplateColumns: `repeat(${teamTimelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {teamTimelineRange.quarterWeekBands.map((b, i) => (
                            <div
                              key={`team-qb-${b.text}-${i}`}
                              className="min-w-0 border-l border-slate-100 py-0.5 text-center first:border-l-0"
                              style={{ gridColumn: `span ${b.span}` }}
                            >
                              {b.text}
                            </div>
                          ))}
                        </div>
                        <div
                          className="grid w-full border-b border-indigo-100/80 text-[8px] font-semibold text-indigo-900"
                          style={{
                            gridTemplateColumns: `repeat(${teamTimelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {teamTimelineRange.monthWeekBands.map((b, i) => (
                            <div
                              key={`team-mb-${b.text}-${i}`}
                              className="min-w-0 border-l border-indigo-100 py-0.5 text-center first:border-l-0"
                              style={{ gridColumn: `span ${b.span}` }}
                            >
                              {b.text}
                            </div>
                          ))}
                        </div>
                        <div
                          className="grid w-full text-gray-600"
                          style={{
                            gridTemplateColumns: `repeat(${teamTimelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {teamTimelineRange.bottomLabels.map((w, i) => (
                            <span
                              key={`team-ax-${w}-${i}`}
                              className="min-w-0 border-l border-gray-100 px-px py-0.5 text-center text-[7px] leading-tight tabular-nums first:border-l-0 sm:text-[8px]"
                              title={String(w)}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div
                        className="relative w-full chart-svg"
                        style={{
                          minHeight: Math.max(280, teamTimelineTasks.length * 48 + 72),
                          background: `repeating-linear-gradient(to right, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent ${
                            100 / Math.max(1, teamTimelineRange.bottomLabels.length)
                          }%)`,
                        }}
                      >
                        {teamTimelineTasks.map((task) => (
                          <div
                            key={task.id}
                            className="absolute h-6 rounded-full px-3 text-[9px] font-semibold text-white flex items-center justify-between gap-2 shadow-sm"
                            title={`Project: ${task.project}\nTask: ${task.title}\nProgress: ${task.progress}`}
                            style={{ top: task.row * 48, left: `${task.left}%`, width: `${task.width}%`, backgroundColor: task.color }}
                          >
                            <span className="truncate">{task.title}</span>
                            <span className="bg-white/85 text-gray-700 px-1.5 rounded-full shrink-0 tabular-nums">
                              {task.progress}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              {teamWorkspaceLoading && <ScreenLoader overlay className="rounded-xl" />}
            </section>
          ) : activeNav === 'Tasks' ? (
            <section className={`${enj.screenContainer} min-w-0 flex min-h-0 flex-1 flex-col overflow-y-auto`}>
              {showTeamSubTaskForm && viewingTaskRow ? (
                <TeamSubTaskFormPanel
                  parentTask={viewingTaskRow}
                  onBack={() => {
                    setShowTeamSubTaskForm(false);
                    if (teamSubTaskFromDetail) {
                      setShowTeamTaskDetail(true);
                    } else {
                      setViewingTaskRow(null);
                    }
                    setTeamSubTaskFromDetail(false);
                  }}
                  onRefresh={() => { setWorkspaceRefreshKey((k) => k + 1); }}
                  onNotify={(type, message) => {
                    setTeamTaskToast({ type, message });
                  }}
                  onSaved={() => {
                    setTeamTaskListRefresh((k) => k + 1);
                  }}
                />
              ) : showTeamTaskDetail && viewingTaskRow ? (
                <TeamTaskDetailPanel
                  task={viewingTaskRow}
                  onBack={() => {
                    setShowTeamTaskDetail(false);
                    setViewingTaskRow(null);
                  }}
                  onRefreshWorkspace={() => { setWorkspaceRefreshKey((k) => k + 1); }}
                  onOpenSubTask={() => {
                    setTeamSubTaskFromDetail(true);
                    setShowTeamSubTaskForm(true);
                  }}
                  onNotify={(type, message) => {
                    setTeamTaskToast({ type, message });
                  }}
                  onTaskUpdated={(row) => {
                    setViewingTaskRow(row);
                    setTeamTaskListRefresh((k) => k + 1);
                  }}
                />
              ) : editingTaskRow ? (
                <div className="min-h-0 max-h-[min(calc(100dvh-7rem),48rem)] w-full overflow-y-auto">
                  <AddNewTaskFormPanel
                    editingTask={editingTaskRow}
                    onClose={() => setEditingTaskRow(null)}
                    onNotify={(type, message) => {
                      if (type === 'error') window.alert(message);
                      else window.alert(message);
                    }}
                    onSaved={() => {
                      setTeamTaskListRefresh((k) => k + 1);
                      setWorkspaceRefreshKey((k) => k + 1);
                      setEditingTaskRow(null);
                    }}
                  />
                </div>
              ) : (
                <div className="relative min-w-0 flex w-full flex-col">
                  {teamWorkspaceLoading && <ScreenLoader overlay className="rounded-xl" />}
                  {teamTaskToast && (
                    <NotificationToast
                      type={teamTaskToast.type}
                      message={teamTaskToast.message}
                      onClose={() => setTeamTaskToast(null)}
                    />
                  )}
                  <h2 className="enj-screen-header mb-4 shrink-0">Tasks List</h2>
                  <div className="w-full min-w-0 shrink-0">
                    <TasksScreenBoard
                      variant="team"
                      tasks={myTasks}
                      onTaskEdit={(row) => {
                        setViewingTaskRow(row as Record<string, unknown>);
                        setShowTeamTaskDetail(true);
                      }}
                      onTaskOpen={(row) => {
                        setViewingTaskRow(row as Record<string, unknown>);
                        setShowTeamTaskDetail(true);
                      }}
                    />
                  </div>
                </div>
              )}
            </section>
          ) : activeNav === 'Issues' ? (
            <section className={`relative ${enj.screenContainer}`}>
              {teamIssueToast && (
                <NotificationToast
                  type={teamIssueToast.type}
                  message={teamIssueToast.message}
                  onClose={() => setTeamIssueToast(null)}
                />
              )}
              {teamWorkspaceLoading && <ScreenLoader overlay className="rounded-xl" />}
              {showTeamSubIssueForm && viewingIssueRow ? (
                <TeamSubIssueFormPanel
                  parentIssue={viewingIssueRow}
                  onBack={() => {
                    setShowTeamSubIssueForm(false);
                    if (teamSubIssueFromDetail) {
                      setShowIssueDetails(true);
                    } else {
                      setViewingIssueRow(null);
                    }
                    setTeamSubIssueFromDetail(false);
                  }}
                  onRefresh={() => { setWorkspaceRefreshKey((k) => k + 1); }}
                  onNotify={(type, message) => setTeamIssueToast({ type, message })}
                  onSaved={() => {
                    setWorkspaceRefreshKey((k) => k + 1);
                    /* Keep modal open so the new sub issue appears in the list on the left. */
                  }}
                />
              ) : showIssueDetails && viewingIssueRow ? (
                <TeamIssueDetailPanel
                  issue={viewingIssueRow}
                  onBack={() => { setShowIssueDetails(false); setViewingIssueRow(null); }}
                  onRefreshWorkspace={() => { setWorkspaceRefreshKey((k) => k + 1); }}
                  onOpenSubIssue={() => { setTeamSubIssueFromDetail(true); setShowTeamSubIssueForm(true); }}
                  onNotify={(type, message) => setTeamIssueToast({ type, message })}
                  onIssueUpdated={(row) => {
                    setViewingIssueRow(row);
                    setWorkspaceRefreshKey((k) => k + 1);
                  }}
                />
              ) : (
                <>
              <h2 className="enj-screen-header mb-4">Issue Register</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col">
                  <h3 className="text-sm font-semibold text-primary mb-3">Projects vs Issues</h3>
                  {teamIssuesRegister.projectBars.length === 0 ? (
                    <p className="text-xs text-gray-400 py-8">No issue data by project</p>
                  ) : (
                    <div className="flex-1 flex items-center justify-center min-h-[200px]">
                      <svg viewBox="0 0 220 160" className="w-full h-full max-h-64 chart-svg">
                      {[0, 10, 20, 30, 40, 50].map((v) => (
                        <g key={v}>
                          <line x1="18" x2="210" y1={110 - v * 1.5} y2={110 - v * 1.5} stroke="#eef2f7" />
                          <text x="4" y={113 - v * 1.5} fontSize="7" fill="#9ca3af">{v}</text>
                        </g>
                      ))}
                      {teamIssuesRegister.projectBars.map((b, i) => (
                        <g key={b.name}>
                          <rect x={58 + i * 32} y={110 - b.h * 1.5} width="12" height={b.h * 1.5} rx="2" className="chart-bar" fill={b.color} />
                          <text x={64 + i * 32} y="130" fontSize="7" textAnchor="middle" fill="#9ca3af">{b.name}</text>
                        </g>
                      ))}
                      </svg>
                    </div>
                  )}
                </div>
                <DonutChartCard
                  title="Issue Severity"
                  ringWidth={32}
                  centerText={String(myIssues.length)}
                  centerSubtext="issues"
                  slices={(() => {
                    const { sev } = teamIssuesRegister;
                    const raw = [
                      { label: 'High', value: sev.high, color: '#ea6a6a' },
                      { label: 'Med', value: sev.med, color: '#efb4b8' },
                      { label: 'Low', value: sev.low, color: '#d4a759' },
                      { label: 'Critical', value: sev.crit, color: '#a855f7' },
                    ];
                    return raw.some((x) => x.value > 0) ? raw : [{ label: 'No Data', value: 1, color: '#e5e7eb' }];
                  })()}
                />
                <DonutChartCard
                  title="Issue Status"
                  ringWidth={32}
                  centerText={String(myIssues.length)}
                  centerSubtext="issues"
                  slices={(() => {
                    const { st } = teamIssuesRegister;
                    if (st.open === 0 && st.closed === 0) {
                      return [{ label: 'No Data', value: 1, color: '#e5e7eb' }];
                    }
                    return [
                      { label: 'Open', value: st.open, color: '#dc4f56' },
                      { label: 'Closed', value: st.closed, color: '#1f67e0' },
                    ].filter((x) => x.value > 0);
                  })()}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {(
                  [
                    ['Open', '#ef4444', teamOpenIssues],
                    ['Solved', '#2563eb', teamClosedIssues],
                  ] as [string, string, Array<Record<string, unknown>>][]
                ).map(([title, _accent, list]) => (
                  <div key={String(title)} className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                      <p className="enj-screen-subheader">{title}</p>
                      <span className="text-[10px] text-gray-500">{list.length} items</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 p-4">No {title === 'Open' ? 'open' : 'closed'} issues.</p>
                    ) : list.slice(0, 8).map((row) => {
                      const t = String(row.new_issuetitle ?? 'Issue');
                      const issueId = String(row.new_issueid ?? '');
                      const subN = teamSubIssueCountByParent.get(issueId) ?? 0;
                      const sevName = String(row.new_issueseverityname ?? '—').trim() || '—';
                      const descPreview = (String(row.new_description ?? '').trim() || '—');
                      const pri = teamIssueCardPriorityMeta(row);
                      const projectTag = String(row.new_projectname ?? '—').trim() || '—';
                      return (
                        <div
                          key={String(row.new_issueid ?? t)}
                          className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-4 sm:p-5"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => { setViewingIssueRow(row); setShowIssueDetails(true); }}
                                className="text-sm font-semibold text-[#2563eb] text-left underline underline-offset-2 decoration-[#2563eb]/80 hover:text-[#1d4ed8] block truncate w-full"
                              >
                                {t}
                              </button>
                              <p className="text-[11px] text-gray-500 mt-1.5">
                                Issue Severity : {sevName}
                              </p>
                            </div>
                            <span
                              className="shrink-0 max-w-[9rem] truncate rounded-md bg-amber-100/90 px-2.5 py-1.5 text-center text-[10px] font-medium text-gray-800 border border-amber-200/60"
                              title={projectTag}
                            >
                              {projectTag}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-medium text-primary">
                              <ListTree className="h-3.5 w-3.5 text-[#2563eb] shrink-0" strokeWidth={2} />
                              <span>Sub Issue Count: {subN}</span>
                            </div>
                            <div className="min-w-0 max-w-full sm:max-w-[55%] text-right sm:pl-2">
                              <p className="text-[11px] font-bold text-[#1e3a5f]">Description</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 break-words">{descPreview}</p>
                            </div>
                          </div>
                          <div className="flex items-end justify-between gap-2 pt-1">
                            <div>
                              <p className="text-[11px] text-gray-500">
                                Due Date : {teamIssueCardDueDate(row)}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2.5">
                                <span
                                  className={`inline-flex h-6 min-w-[1.5rem] px-1 rounded-full text-[9px] font-bold text-white items-center justify-center ${pri.ring}`}
                                  title="Priority from severity"
                                >
                                  {pri.p}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingIssueRow(row);
                                    setShowIssueDetails(true);
                                    setShowTeamSubIssueForm(false);
                                    setTeamSubIssueFromDetail(false);
                                  }}
                                  className="p-1 rounded-md text-gray-400 hover:text-secondary hover:bg-amber-50/80"
                                  title="Issue details"
                                >
                                  <Pencil className="h-4 w-4" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
                </>
              )}
            </section>
          ) : activeNav === 'Meetings' ? (
            <section className={enj.screenContainer}>
              {showAddCalendarMeetingForm ? (
                <AddMeetingFormPanel
                  parentLabel="Meetings"
                  onCancel={() => setShowAddCalendarMeetingForm(false)}
                  onCreated={() => setWorkspaceRefreshKey((k) => k + 1)}
                  onNotify={(type, message) => setTeamProjectToast({ type, message })}
                />
              ) : (
                <>
                <div className="relative">
                  {teamWorkspaceLoading && <ScreenLoader overlay className="rounded-xl" />}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-8">
                      <h2 className="enj-screen-header">Calendar</h2>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="text-gray-500 flex items-center gap-2">
                          <span>Project Name</span>
                          <select
                            className={`${enj.control} !w-auto max-w-[160px] text-sm text-gray-600`}
                            value={teamCalendarProjectFilter}
                            onChange={(e) => setTeamCalendarProjectFilter(e.target.value)}
                          >
                            <option value="All">All</option>
                            {Array.from(myProjectNameSet)
                              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                              .map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="text-gray-500 flex items-center gap-2">
                          <span className="shrink-0">Date</span>
                          <input
                            type="date"
                            className={`${enj.control} !w-auto text-sm`}
                            value={teamCalendarSelectedDateIso}
                            onChange={(e) => setTeamCalendarSelectedDateIso(e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const t = new Date();
                            setTeamCalendarSelectedDateIso(
                              `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
                            );
                            setShowCalendarMom(false);
                          }}
                          className={`${enj.btn} ${enj.btnOutline} rounded-full px-3 text-sm`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCalendarMom(true)}
                          className={`${enj.btn} ${enj.btnOutline} text-sm`}
                        >
                          MOM
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowAddCalendarMeetingForm(true)} className={`${enj.btn} ${enj.btnPrimary} text-sm font-semibold`}>+ New Meeting</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
                    {showCalendarMom ? (
                      <section className="bg-transparent rounded-xl p-0">
                        <p className="text-[16px] font-bold text-primary mb-3">Calendar {'>'} MOM</p>
                        <table className={`${enj.table} w-full text-[10px] bg-transparent border-separate`}>
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 bg-gray-50 border-0 rounded-l-[11.9px]">Meeting Title</th>
                              <th className="px-3 py-2 bg-gray-50 border-0">Category</th>
                              <th className="px-3 py-2 bg-gray-50 border-0">Project Name</th>
                              <th className="px-3 py-2 bg-gray-50 border-0">Date</th>
                              <th className="text-right px-3 py-2 bg-gray-50 border-0 rounded-r-[11.9px]">Join</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamCalendarFilteredMeetings.length === 0 ? (
                              <tr className="bg-transparent">
                                <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500 bg-transparent">
                                  No meetings for the selected project and date.
                                </td>
                              </tr>
                            ) : teamCalendarFilteredMeetings.map((mrow) => {
                              const join = String(mrow.new_meetinglink ?? '').trim();
                              const canOpen = /^https?:\/\//i.test(join);
                              return (
                                <tr key={String(mrow.new_meetingdetailid ?? mrow.createdon)} className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0 text-[11px] text-gray-700">
                                  <td className="px-3 py-3 font-semibold bg-white border-0 rounded-l-[11.9px]">
                                    {canOpen ? (
                                      <a
                                        href={join}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={enj.tableLink}
                                      >
                                        {String(mrow.new_meetingtitle ?? '—')}
                                      </a>
                                    ) : (
                                      <span className="text-[#374151]">{String(mrow.new_meetingtitle ?? '—')}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 bg-white border-0">{String(mrow.new_meetingcategory ?? '—')}</td>
                                  <td className="px-3 py-3 bg-white border-0">{String(mrow.new_projectname ?? '—')}</td>
                                  <td className="px-3 py-3 font-medium text-[#111827] bg-white border-0">{teamFormatShortDate(mrow.new_meetingdate)}</td>
                                  <td className="px-3 py-3 text-right text-[10px] bg-white border-0 rounded-r-[11.9px]">
                                    {canOpen ? (
                                      <a
                                        href={join}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${enj.tableLink} font-medium`}
                                      >
                                        Join
                                      </a>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </section>
                    ) : (
                      <section className="bg-white rounded-xl p-3">
                        <div className="grid grid-cols-[44px_1fr]">
                          <div className="text-[10px] text-gray-300 space-y-8 pt-2">
                            {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
                              <p key={time}>{time}</p>
                            ))}
                          </div>
                          <div className="relative h-[410px] rounded-lg border border-gray-100 bg-[repeating-linear-gradient(to_right,#f6f7fb_0,#f6f7fb_1px,transparent_1px,transparent_16.66%)]">
                            {[15, 73, 139, 205, 271, 337].map((x) => (
                              <div key={x} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: x }} />
                            ))}
                            {teamCalendarGridBlocks.length === 0 ? (
                              <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No meetings for the selected day</p>
                            ) : teamCalendarGridBlocks.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="absolute h-8 max-w-[200px] cursor-pointer rounded-full px-3 text-left text-white text-[9px] font-semibold flex items-center truncate shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/80"
                                style={{ top: item.top, left: item.left, backgroundColor: item.color }}
                                title={item.joinUrl ? `${item.title} — open join link` : item.title}
                                onClick={() => {
                                  if (item.joinUrl) {
                                    window.open(item.joinUrl, '_blank', 'noopener,noreferrer');
                                  } else {
                                    setTeamProjectToast({
                                      type: 'info',
                                      message: 'No Teams join link on this meeting yet. After the flow runs, open again.',
                                    });
                                  }
                                }}
                              >
                                {item.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="bg-white rounded-xl p-3">
                  <p className="text-[9px] text-gray-400 uppercase">Current Month</p>
                  <h3 className="text-sm font-semibold text-primary mb-2">Scheduled Meetings</h3>
                  <div className="space-y-2">
                    {teamCalendarCategoryRows.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No scheduled meeting categories this period.</p>
                    ) : teamCalendarCategoryRows.map((row) => (
                      <div key={row.name} className="rounded-full px-3 py-1.5 flex items-center justify-between" style={{ backgroundColor: row.bg }}>
                        <div>
                          <p className="text-[10px] font-semibold" style={{ color: row.text }}>{row.name}</p>
                          <p className="text-[9px] text-gray-400">{row.hrs > 0 ? `${row.hrs} HRS` : '—'}</p>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-white/80 text-[10px] font-semibold flex items-center justify-center" style={{ color: row.text }}>{row.n}</span>
                      </div>
                    ))}
                  </div>
                </section>
                  </div>
                </div>
                </>
              )}
            </section>
          ) : (
            <div className="space-y-4">
              {teamWorkspaceLoading && <ScreenLoader overlay className="rounded-xl" />}

              {/* ── Overview ── */}
              <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h2 className="enj-dashboard-header mb-4">Overview</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {overviewCards.map(card => (
                    <div
                      key={card.label}
                      className={`rounded-xl border-2 ${card.border} bg-white px-4 py-4`}
                    >
                      <p className="text-sm text-gray-400 mb-3 leading-tight">{card.label}</p>
                      <p className="text-3xl font-extrabold text-primary">{card.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Insights ── */}
              <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="enj-dashboard-header">Insights</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-col">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Assigned Tasks / Projects</p>
                    <AssignedTasksChart bars={teamDashboardAssignedChart.bars} maxValue={teamDashboardAssignedChart.max} />
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-col">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Tasks</p>
                    <TasksChart bars={teamDashboardTasksChart.bars} />
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-col">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Issues</p>
                    <IssuesDonut
                      open={teamIssueDistribution.open}
                      inProgress={teamIssueDistribution.inProgress}
                      closed={teamIssueDistribution.closed}
                      total={teamIssueDistribution.total}
                    />
                  </div>
                </div>
              </section>

              {/* ── Tasks table ── */}
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">Tasks</h2>
                  <button
                    type="button"
                    className="bg-transparent p-0 text-xs font-semibold text-[#A08149] hover:underline"
                    onClick={() => { setShowTaskDetails(false); setEditingTaskRow(null); setActiveNav('Tasks'); }}
                  >
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className={`${enj.table} w-full min-w-[860px] bg-transparent border-separate`}>
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0 rounded-l-[11.9px]">Project Name</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Task Name</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Priority</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Status</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Project Manager</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Milestone</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0">Timeline</th>
                        <th className="px-2.5 py-3 text-[11px] font-semibold text-[rgba(118,131,150,1)] bg-[rgba(225,227,236,1)] border-0 rounded-r-[11.9px]">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamWorkspaceLoading && teamDashboardTasksTable.length === 0 ? (
                        <tr className="bg-transparent">
                          <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500 bg-transparent">Loading tasks…</td>
                        </tr>
                      ) : teamDashboardTasksTable.length === 0 ? (
                        <tr className="bg-transparent">
                          <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500 bg-transparent">No tasks assigned to you.</td>
                        </tr>
                      ) : teamDashboardTasksTable.slice(0, 6).map((row) => (
                        <tr key={row.key} className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                          <td className="px-2.5 py-3 text-[11px] text-gray-600 bg-white border-0 rounded-l-[11.9px]">{row.project}</td>
                          <td className="px-2.5 py-3 text-[11px] font-medium text-gray-900 bg-white border-0">{row.task}</td>
                          <td className="px-2.5 py-3 bg-white border-0"><Badge label={row.priority} /></td>
                          <td className="px-2.5 py-3 bg-white border-0"><Badge label={row.status} /></td>
                          <td className="px-2.5 py-3 text-[11px] text-gray-700 bg-white border-0">{row.pm}</td>
                          <td className="px-2.5 py-3 text-[11px] text-gray-600 bg-white border-0">{row.milestone}</td>
                          <td className="px-2.5 py-3 bg-white border-0">
                            <div className="text-[11px] leading-relaxed text-gray-600">
                              <div><span className="text-gray-400">Start:</span> {row.start}</div>
                              <div><span className="text-gray-400">End:</span> {row.end}</div>
                            </div>
                          </td>
                          <td className="px-2.5 py-3 bg-white border-0 rounded-r-[11.9px]"><ProgressBar pct={row.pct} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          </div>
        </main>
      </div>
      {teamTaskDeleteCandidate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="enj-screen-subheader">Delete task?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete
              {' '}
              <span className="font-semibold text-gray-800">
                {String(teamTaskDeleteCandidate.new_tasktitle ?? 'this task').trim() || 'this task'}
              </span>
              ?
            </p>
            <p className="mt-1 text-xs text-rose-600">This action cannot be undone.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 px-4 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setTeamTaskDeleteCandidate(null)}
                disabled={deletingTeamTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-md bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                onClick={() => void confirmDeleteTeamTask()}
                disabled={deletingTeamTask}
              >
                {deletingTeamTask ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Business dashboard (stakeholder / portfolio view) ─────────────────────────
function BusinessDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [businessReportToast, setBusinessReportToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [timelineYear, setTimelineYear] = useState(() => new Date().getFullYear());
  const programPickerRef = useRef<HTMLDivElement>(null);
  const [programMenuOpen, setProgramMenuOpen] = useState(false);
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('All Programs');
  const [timelineProjects, setTimelineProjects] = useState<Array<Record<string, unknown>>>([]);
  const [dashboardMasterRows, setDashboardMasterRows] = useState<Array<Record<string, unknown>>>([]);
  const [programIdToName, setProgramIdToName] = useState<Map<string, string>>(() => new Map());
  const [portfolioPrograms, setPortfolioPrograms] = useState<Array<Record<string, unknown>>>([]);
  const [expandedPortfolioProgramKey, setExpandedPortfolioProgramKey] = useState<string | null>(null);
  const [portfolioPage, setPortfolioPage] = useState(1);
  const [dataRefresh, setDataRefresh] = useState(0);
  const [newPipelines, setNewPipelines] = useState<New_pipelines[]>([]);
  const [newClients, setNewClients] = useState<New_clients[]>([]);
  const [timelinePeriod, setTimelinePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineStatusFilter, setTimelineStatusFilter] = useState<{ completed: boolean; onTrack: boolean; delayed: boolean }>({
    completed: true,
    onTrack: true,
    delayed: true,
  });

  const readTimelineProgramName = useCallback(
    (row: Record<string, unknown>) => resolveProjectProgramName(row, programIdToName),
    [programIdToName],
  );

  const filteredProjectsForDash = useMemo(
    () => timelineProjects.filter((p) => selectedProgramGroup === 'All Programs' || readTimelineProgramName(p) === selectedProgramGroup),
    [timelineProjects, selectedProgramGroup, readTimelineProgramName],
  );

  const businessDash = useMemo(
    () => businessDashboardModel(filteredProjectsForDash, programIdToName, dashboardMasterRows),
    [filteredProjectsForDash, programIdToName, dashboardMasterRows],
  );

  const periodTimeline = useMemo(() => {
    const result = generatePeriodTimeline(filteredProjectsForDash, timelinePeriod);
    return {
      years: result.labels,
      completed: result.completed,
      onTrack: result.onTrack,
      delayed: result.delayed,
    };
  }, [filteredProjectsForDash, timelinePeriod]);

  const programProgressById = useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of timelineProjects) {
      const idRaw = r._new_program_value ?? r.new_programid;
      if (idRaw === undefined || idRaw === null || String(idRaw).trim() === '') continue;
      const id = normalizeDataverseId(String(idRaw));
      const p = Number(r.new_progress);
      if (!Number.isFinite(p)) continue;
      const cur = acc.get(id) ?? { sum: 0, n: 0 };
      cur.sum += p;
      cur.n += 1;
      acc.set(id, cur);
    }
    const out = new Map<string, number>();
    acc.forEach((v, k) => {
      if (v.n > 0) out.set(k, Math.round((v.sum / v.n) * 10) / 10);
    });
    return out;
  }, [timelineProjects]);
  const categoryDonutCenter = useMemo(
    () => businessDash.categoryData.reduce((s, c) => s + c.value, 0),
    [businessDash.categoryData],
  );
  const progressDonutSlices = useMemo(
    () => businessDash.progressData.map((p) => ({ label: p.label, value: p.value, color: p.color, displayName: p.label })),
    [businessDash.progressData],
  );
  const categoryDonutSlices = useMemo(
    () =>
      businessDash.categoryData.map((c) => ({
        label: c.label,
        value: c.value,
        color: c.color,
        displayName: c.name ?? c.label,
      })),
    [businessDash.categoryData],
  );
  // Budget donut for potential future use
  useMemo(
    () =>
      businessDash.budgetData.segments.map((s) => {
        const nm = s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name;
        return {
          label: s.name,
          value: s.value,
          color: s.color,
          displayName: s.name,
          labelLine: `${formatAEDShort(s.value)} ${nm}`,
        };
      }),
    [businessDash.budgetData.segments],
  );

  const latestPortfolio = useMemo(() => portfolioPrograms.slice(0, 5), [portfolioPrograms]);
  const portfolioPageSize = 5;
  const portfolioTotalPages = useMemo(
    () => Math.max(1, Math.ceil(portfolioPrograms.length / portfolioPageSize)),
    [portfolioPrograms.length],
  );
  const pagedPortfolioPrograms = useMemo(() => {
    const start = (portfolioPage - 1) * portfolioPageSize;
    return portfolioPrograms.slice(start, start + portfolioPageSize);
  }, [portfolioPrograms, portfolioPage]);
  const readProgramString = (row: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '—';
  };
  const businessPipelineTableRows = useMemo((): BusinessPipelineTableRow[] => {
    return newPipelines.map((r, i) => newPipelineToTableRow(r, i));
  }, [newPipelines]);
  const portfolioProjectsByProgramKey = useMemo(() => {
    const out = new Map<string, Array<Record<string, unknown>>>();
    for (const project of timelineProjects) {
      const keys: string[] = [];
      const rawId = project._new_program_value ?? project.new_programid;
      if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
        keys.push(`id:${normalizeDataverseId(String(rawId))}`);
      }
      const resolvedProgramName = resolveProjectProgramName(project, programIdToName).trim();
      if (resolvedProgramName) {
        keys.push(`name:${resolvedProgramName.toLowerCase()}`);
      }
      for (const key of keys) {
        const bucket = out.get(key);
        if (bucket) bucket.push(project);
        else out.set(key, [project]);
      }
    }
    return out;
  }, [timelineProjects, programIdToName]);
  const businessClientOptions = useMemo(
    () =>
      newClients
        .map((c) => ({
          id: String(c.new_clientid),
          name: String(c.new_clientname ?? '').trim(),
        }))
        .filter((c) => c.id && c.name),
    [newClients],
  );
  const navItems = [
    { name: 'Dashboard', icon: <LayoutGrid size={16} /> },
    { name: 'Pipeline', icon: <Briefcase size={16} /> },
    { name: 'Reports', icon: <TrendingUp size={16} /> },
    { name: 'Timeline', icon: <Calendar size={16} /> },
    { name: 'Feedback', icon: <MessageSquare size={16} /> },
  ];
  const readTimelineProjectName = (row: Record<string, unknown>) =>
    String(row.new_projectname ?? row.new_name ?? 'Project').trim() || 'Project';
  const readTimelineStart = (row: Record<string, unknown>) => {
    return parseTimelineDate(row.new_startdate);
  };
  const readTimelineEnd = (row: Record<string, unknown>) => {
    return parseTimelineDate(row.new_enddate);
  };
  const readTimelineProgress = (row: Record<string, unknown>) => {
    const n = Number(row.new_progress ?? NaN);
    return Number.isFinite(n) ? `${Math.max(0, Math.min(100, n))}%` : '0%';
  };
  const timelineFilterOptions = useMemo(() => {
    const programs = Array.from(new Set(timelineProjects.map(readTimelineProgramName))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    return ['All Programs', ...programs];
  }, [timelineProjects, readTimelineProgramName]);
  useEffect(() => {
    if (!timelineFilterOptions.includes(selectedProgramGroup)) setSelectedProgramGroup('All Programs');
  }, [timelineFilterOptions, selectedProgramGroup]);

  const timelineRange = useMemo(() => businessYearWeekTimelineModel(timelineYear), [timelineYear]);

  const timelineRows = useMemo(() => {
    const rangeStart = timelineRange.start.getTime();
    const rangeEndExcl = timelineRange.endExclusive.getTime();
    const rs = timelineProjects
      .filter((p) => selectedProgramGroup === 'All Programs' || readTimelineProgramName(p) === selectedProgramGroup)
      .map((p) => {
        const start = readTimelineStart(p);
        const end = readTimelineEnd(p);
        return {
          source: p,
          program: readTimelineProgramName(p),
          project: readTimelineProjectName(p),
          start,
          end,
          progress: readTimelineProgress(p),
        };
      })
      .filter((p) => p.start && p.end)
      .map((p) => {
        const projectStartMs = p.start!.getTime();
        const projectEndExcl = exclusiveEndAfterInclusiveDate(p.end!);
        const visStartMs = Math.max(rangeStart, projectStartMs);
        const visEndExcl = Math.min(rangeEndExcl, projectEndExcl);
        if (visEndExcl <= rangeStart || visStartMs >= rangeEndExcl) return null;
        const viewStart = localDateOnlyFromTimeMs(visStartMs);
        const viewEnd = localDateOnlyFromTimeMs(visEndExcl - 1);
        const hasScheduleMismatch =
          !sameLocalCalendarDay(viewStart, p.start!) || !sameLocalCalendarDay(viewEnd, p.end!);
        return { ...p, viewStart, viewEnd, hasScheduleMismatch };
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => a.start!.getTime() - b.start!.getTime());
    return rs;
  }, [timelineProjects, selectedProgramGroup, timelineRange, readTimelineProgramName]);

  const timelineBars = useMemo(() => {
    const rangeStart = timelineRange.start.getTime();
    const rangeEndExcl = timelineRange.endExclusive.getTime();
    const totalMs = Math.max(1, rangeEndExcl - rangeStart);
    const colors = ['#59628a', '#19c37d', '#1766e5', '#f4b400', '#d35b66', '#7c3aed'];
    return timelineRows
      .map((row, idx) => {
        const projectStartMs = row.start!.getTime();
        const projectEndExcl = exclusiveEndAfterInclusiveDate(row.end!);
        if (projectEndExcl <= projectStartMs) return null;
        const s = Math.max(rangeStart, projectStartMs);
        const e = Math.min(rangeEndExcl, projectEndExcl);
        if (e <= rangeStart || s >= rangeEndExcl) return null;
        const startPct = ((s - rangeStart) / totalMs) * 100;
        const endPct = ((e - rangeStart) / totalMs) * 100;
        return {
          label: row.project,
          startPct,
          widthPct: Math.max(2, endPct - startPct),
          row: idx + 1,
          color: colors[idx % colors.length],
          progress: row.progress,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [timelineRows, timelineRange]);

  const timelineMaxRow = Math.max(timelineRows.length, 1);
  const timelineBodyMinHeight = Math.max(280, timelineMaxRow * 48 + 72);

  const timelineAxisMinWidth = useMemo(() => {
    const n = Math.max(1, timelineRange.bottomLabels.length);
    return Math.max(1200, n * 22);
  }, [timelineRange.bottomLabels.length]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!programMenuOpen) return;
      const el = programPickerRef.current;
      if (el && !el.contains(e.target as Node)) setProgramMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [programMenuOpen]);

  useEffect(() => {
    if (activeNav !== 'Portfolio') return;
    if (portfolioPage > portfolioTotalPages) setPortfolioPage(portfolioTotalPages);
    if (portfolioPage < 1) setPortfolioPage(1);
  }, [activeNav, portfolioPage, portfolioTotalPages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTimelineLoading(true);
      try {
        const [projRes, progRes, pipeRes, clientRes, masterRes] = await Promise.all([
          New_projectsService.getAll({ top: 1000, orderBy: ['new_startdate asc', 'createdon desc'] }),
          New_programsService.getAll({ top: 500, orderBy: ['new_name asc'] }),
          New_pipelinesService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          New_clientsService.getAll({ top: 500, orderBy: ['new_clientname asc'] }),
          EnjazMasterDataService.getAll({ top: 2000, orderBy: ['new_enjazmasterdata1 asc'] }),
        ]);
        if (!projRes.success) throw new Error(projRes.error?.message ?? 'Failed to load timeline projects');
        if (!cancelled) {
          const rows = (projRes.data ?? []) as unknown as Array<Record<string, unknown>>;
          setTimelineProjects(rows);
          setNewPipelines(
            pipeRes.success && Array.isArray(pipeRes.data) ? (pipeRes.data as New_pipelines[]) : [],
          );
          setNewClients(
            clientRes.success && Array.isArray(clientRes.data) ? (clientRes.data as New_clients[]) : [],
          );
          const pRows = (progRes.success ? progRes.data : []) as unknown as Array<Record<string, unknown>>;
          setProgramIdToName(buildProgramIdToNameMap(pRows));
          setPortfolioPrograms(pRows);
          setDashboardMasterRows(
            masterRes.success ? ((masterRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [],
          );
          const datedRows = rows
            .map((r) => parseTimelineDate(r.new_startdate))
            .filter((d): d is Date => Boolean(d))
            .sort((a, b) => b.getTime() - a.getTime());
          if (datedRows.length > 0) {
            const latest = datedRows[0];
            setTimelineYear(latest.getFullYear());
          }
        }
      } catch {
        if (!cancelled) {
          setTimelineProjects([]);
          setNewPipelines([]);
          setNewClients([]);
          setProgramIdToName(new Map());
          setPortfolioPrograms([]);
          setDashboardMasterRows([]);
        }
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataRefresh]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fe] text-gray-800 enjaz-business-ui">
      <aside className="z-[60] w-[86px] shrink-0 border-r border-gray-100 bg-[#f3f4f8] flex min-h-0 flex-col overflow-hidden">
        <div className="h-14 border-b border-gray-100 flex items-center justify-center">
          <LogoMark />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-hidden px-2 py-4">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveNav(name)}
              className={`group relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                activeNav === name ? 'bg-[#A08149] text-white shadow-md' : 'text-[#344054] hover:bg-gray-200 hover:text-[#344054]'
              }`}
              aria-label={name}
              title={name}
            >
              {icon}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-gray-100 px-1 py-3">
          <div className="mx-auto w-fit scale-90">
            <ThemeModeToggle />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell items={[]} />
            <ProfileDropdown onLogout={onLogout} roleLabel="Business" />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {businessReportToast && (
            <NotificationToast
              type={businessReportToast.type}
              message={businessReportToast.message}
              onClose={() => setBusinessReportToast(null)}
            />
          )}
          <div className={`enjaz-business-ui-main enj-app-main enj-stack min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]`}>
          {activeNav === 'Timeline' ? (
            <>
              <section className="relative bg-white rounded-xl p-4 shadow-sm chart-card">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="enj-screen-header">Timeline</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDataRefresh((k) => k + 1)}
                      className={`${enj.btn} ${enj.btnOutline} !h-9 !w-9 !min-h-0 !px-0 rounded-full text-amber-800 border-amber-300 hover:bg-amber-50`}
                      title="Refresh timeline"
                      aria-label="Refresh timeline"
                    >
                      <RefreshCw size={14} className={timelineLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setTimelineYear(now.getFullYear());
                      }}
                      className={`${enj.btn} ${enj.btnOutline} rounded-full text-sm text-amber-800 border-amber-300 hover:bg-amber-50`}
                    >
                      This year
                    </button>
                    <div className="flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setTimelineYear((y) => y - 1)}
                        className={`${enj.btn} ${enj.btnGhost} !h-7 !w-7 !min-h-0 !max-h-none !px-0 rounded-full text-gray-500 shadow-none`}
                        aria-label="Previous year"
                      >
                        {'<'}
                      </button>
                      <span className="min-w-[3.2rem] text-center text-sm font-semibold text-primary">{timelineYear}</span>
                      <button
                        type="button"
                        onClick={() => setTimelineYear((y) => y + 1)}
                        className={`${enj.btn} ${enj.btnGhost} !h-7 !w-7 !min-h-0 !max-h-none !px-0 rounded-full text-gray-500 shadow-none`}
                        aria-label="Next year"
                      >
                        {'>'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid min-h-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[300px_1fr]">
                  <div className="bg-[#f6f8fb] rounded-lg p-3 flex flex-col min-h-0">
                    <div className="relative mb-2 shrink-0" ref={programPickerRef}>
                      <button
                        type="button"
                        onClick={() => setProgramMenuOpen((o) => !o)}
                        className={`${enj.btn} ${enj.btnDefault} w-full max-w-full justify-between px-2 text-left text-sm font-normal shadow-sm`}
                      >
                        <span className="truncate">{selectedProgramGroup}</span>
                        <ChevronDown size={10} className={`shrink-0 text-gray-400 transition-transform ${programMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {programMenuOpen && (
                        <ul className="absolute left-0 right-0 top-full z-20 mt-1 py-1 rounded-md border border-gray-200 bg-white shadow-lg max-h-40 overflow-auto">
                      {timelineFilterOptions.map((opt) => (
                            <li key={opt}>
                              <button
                                type="button"
                                className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-gray-50 ${opt === selectedProgramGroup ? 'text-primary font-semibold bg-indigo-50/50' : 'text-gray-600'}`}
                                onClick={() => {
                                  setSelectedProgramGroup(opt);
                                  setProgramMenuOpen(false);
                                }}
                              >
                                {opt}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2 flex-1 min-h-0 max-h-[560px] overflow-y-auto overflow-x-hidden pr-1 overscroll-contain">
                      {timelineRows.map((row) => (
                        <div
                          key={`${row.project}-${row.start!.getTime()}-${row.end!.getTime()}`}
                          className="bg-white border border-gray-100 rounded-md p-2"
                        >
                          <p className="text-[11px] font-semibold text-[#3a4275] truncate">{row.project}</p>
                          <p className="mt-1 text-[10px] text-gray-500 truncate">{row.program}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatTimelineDateLabel(row.viewStart)} - {formatTimelineDateLabel(row.viewEnd)}
                            {row.hasScheduleMismatch && (
                              <span className="mt-0.5 block text-[9px] text-gray-400/95" title="Full scheduled range from data">
                                Full: {formatTimelineDateLabel(row.start)} - {formatTimelineDateLabel(row.end)}
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                      {!timelineLoading && timelineRows.length === 0 && (
                        <p className="text-[11px] text-gray-400 px-1 py-2">No projects found for selected program.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-100 bg-white">
                    <div
                      className="h-[min(36rem,72vh)] min-h-[16rem] w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-contain scroll-smooth rounded-b-lg"
                    >
                      <div className="w-full" style={{ minWidth: timelineAxisMinWidth }}>
                        <div className="sticky top-0 z-10 space-y-0.5 border-b border-gray-100 bg-white px-3 py-2 shadow-sm">
                          <p className="text-center text-xs font-bold leading-tight text-primary">
                            {timelineRange.yearLabel}
                          </p>
                          <div
                            className="grid w-full border-b border-slate-100 text-[8px] font-bold text-slate-700"
                            style={{
                              gridTemplateColumns: `repeat(${timelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {timelineRange.quarterWeekBands.map((b, i) => (
                              <div
                                key={`qb-${b.text}-${i}`}
                                className="min-w-0 border-l border-slate-100 py-0.5 text-center first:border-l-0"
                                style={{ gridColumn: `span ${b.span}` }}
                              >
                                {b.text}
                              </div>
                            ))}
                          </div>
                          <div
                            className="grid w-full border-b border-indigo-100/80 text-[8px] font-semibold text-indigo-900"
                            style={{
                              gridTemplateColumns: `repeat(${timelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {timelineRange.monthWeekBands.map((b, i) => (
                              <div
                                key={`mb-${b.text}-${i}`}
                                className="min-w-0 border-l border-indigo-100 py-0.5 text-center first:border-l-0"
                                style={{ gridColumn: `span ${b.span}` }}
                              >
                                {b.text}
                              </div>
                            ))}
                          </div>
                          <div
                            className="grid w-full text-gray-600"
                            style={{
                              gridTemplateColumns: `repeat(${timelineRange.bottomLabels.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {timelineRange.bottomLabels.map((w, i) => (
                              <span
                                key={`ax-${w}-${i}`}
                                className="min-w-0 border-l border-gray-100 px-px py-0.5 text-center text-[7px] leading-tight tabular-nums first:border-l-0 sm:text-[8px]"
                                title={String(w)}
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          className="relative w-full chart-svg"
                          style={{
                            minHeight: timelineBodyMinHeight,
                            background: `repeating-linear-gradient(to right, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent ${
                              100 / Math.max(1, timelineRange.bottomLabels.length)
                            }%)`,
                          }}
                        >
                          {timelineBars.map((track, idx) => (
                            <div
                              key={`${track.label}-${idx}`}
                              className="absolute h-6 rounded-full text-white text-[9px] px-3 flex items-center justify-between shadow-sm transition-all duration-300 hover:scale-[1.02]"
                              title={`Project: ${track.label}\nProgress: ${track.progress}`}
                              style={{
                                left: `${track.startPct}%`,
                                width: `${track.widthPct}%`,
                                top: `${track.row * 48}px`,
                                backgroundColor: track.color,
                              }}
                            >
                              <span className="truncate">{track.label}</span>
                              <span className="bg-white/85 text-gray-500 px-1.5 rounded-full shrink-0">{track.progress}</span>
                            </div>
                          ))}
                          {!timelineLoading && timelineBars.length === 0 && (
                            <p className="absolute left-4 top-4 text-xs text-gray-400">No projects available in selected timeline range.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {timelineLoading && <ScreenLoader overlay className="rounded-xl" />}
              </section>
            </>
          ) : activeNav === 'Portfolio' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h1 className="enj-screen-header">Portfolio</h1>
              </div>
              {portfolioPrograms.length > 0 && (
                <section className="space-y-3">
                  <div className="overflow-x-auto bg-transparent">
                    <table className={`${enj.tableBrand} min-w-[980px] text-xs bg-transparent border-separate`}>
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-l-[11.9px]">Program</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">KPI</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Benefits</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Budget</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Program Manager</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">ROI</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Start Date</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-r-[11.9px]">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedPortfolioPrograms.map((row) => {
                          const pid = String(row.new_programid ?? '');
                          const normalizedPid = normalizeDataverseId(pid);
                          const programName = readProgramString(row, ['new_name']);
                          const programKey = normalizedPid ? `id:${normalizedPid}` : `name:${programName.toLowerCase()}`;
                          const fallbackNameKey = `name:${programName.toLowerCase()}`;
                          const programProjects = (
                            portfolioProjectsByProgramKey.get(programKey)
                            ?? portfolioProjectsByProgramKey.get(fallbackNameKey)
                            ?? []
                          )
                            .slice()
                            .sort((a, b) => {
                              const aStart = parseTimelineDate(a.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                              const bStart = parseTimelineDate(b.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                              return aStart - bStart;
                            });
                          const rawPrgPct = Number(row.new_progresslevel ?? NaN);
                          const pPct = Number.isFinite(rawPrgPct) ? Math.max(0, Math.min(100, rawPrgPct)) : (programProgressById.get(normalizeDataverseId(pid)) ?? 0);
                          const start = parseTimelineDate(row.new_startdate);
                          const isExpanded = expandedPortfolioProgramKey === programKey;
                          const readProjectField = (project: Record<string, unknown>, keys: string[], fallback = '—') => {
                            for (const k of keys) {
                              const v = project[k];
                              if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                            }
                            return fallback;
                          };

                          return (
                            <Fragment key={pid || programName}>
                              <tr className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                                <td className="px-3 py-2 font-normal bg-white border-0 rounded-l-[11.9px]">
                                  <button
                                    type="button"
                                    className={`inline-flex items-center gap-1.5 text-left ${enj.tableLink}`}
                                    onClick={() => setExpandedPortfolioProgramKey((prev) => (prev === programKey ? null : programKey))}
                                    aria-expanded={isExpanded}
                                  >
                                    <ChevronDown size={14} className={`transition-transform text-[#6B7280] ${isExpanded ? 'rotate-180' : ''}`} />
                                    <span className="max-w-[18rem] truncate">{programName}</span>
                                  </button>
                                </td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_kpi', 'crcf8_kpi'])}</td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_benefits', 'crcf8_benefit'])}</td>
                                <td className="px-3 py-2 bg-white border-0"><TableBudgetDisplay value={readProgramString(row, ['new_budget', 'crcf8_budget'])} /></td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_programmanager', 'new_ownername', 'owneridname'])}</td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_roi', 'crcf8_roi'])}</td>
                                <td className="px-3 py-2 whitespace-nowrap bg-white border-0">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} className="shrink-0 text-[#9CA3AF]" />
                                    <span className="font-medium text-[#111827]">{formatTimelineDateLabel(start)}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2 w-40 bg-white border-0 rounded-r-[11.9px]">
                                  <div className="flex items-center gap-2">
                                    <div className="enj-table-progress-track flex-1">
                                      <div
                                        className="enj-table-progress-fill"
                                        style={{ width: `${Math.max(0, Math.min(100, pPct))}%` }}
                                      />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-gray-600">
                                      {Math.round(pPct)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && (
                                <>
                                  {programProjects.length === 0 ? (
                                    <tr className="bg-gray-50 border-0">
                                      <td colSpan={8} className="px-3 py-3 text-[11px] text-gray-500 bg-gray-50 border-0">
                                        No projects found for this program.
                                      </td>
                                    </tr>
                                  ) : (
                                    <tr className="bg-gray-50 border-0">
                                      <td colSpan={8} className="px-3 py-2.5 bg-gray-50 border-0">
                                        <div className="overflow-x-auto bg-transparent">
                                          <table className={`${enj.table} min-w-[1140px] text-left text-[11px]`}>
                                            <thead>
                                              <tr>
                                                <th className="px-3 py-1.5 font-semibold">Project</th>
                                                <th className="px-3 py-1.5 font-semibold">Priority</th>
                                                <th className="px-3 py-1.5 font-semibold">Sponsor</th>
                                                <th className="px-3 py-1.5 font-semibold">Type</th>
                                                <th className="px-3 py-1.5 font-semibold">Budget</th>
                                                <th className="px-3 py-1.5 font-semibold">Strat.goal</th>
                                                <th className="px-3 py-1.5 font-semibold">Project Manager</th>
                                                <th className="px-3 py-1.5 font-semibold">Timeline</th>
                                                <th className="px-3 py-1.5 font-semibold">Progress</th>
                                                <th className="px-3 py-1.5 font-semibold">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {programProjects.map((project, i) => {
                                                const projectName =
                                                  String(project.new_projectname ?? project.new_name ?? 'Project').trim() || 'Project';
                                                const PRIORITY_MAP: Record<number, string> = { 100000000: 'Low', 100000001: 'Medium', 100000002: 'High' };
                                                const GOAL_MAP: Record<number, string> = { 100000000: 'Strategic Plan', 100000001: 'Sustainability', 100000002: 'Cost Reduction', 100000003: 'Customer Satisfaction' };
                                                const priorityRaw = readProjectField(project, ['new_priorityname', 'new_priority']);
                                                const priority = PRIORITY_MAP[Number(priorityRaw)] ?? priorityRaw;
                                                const sponsor = readProjectField(project, ['crcf8_projectsponsorname', 'crcf8_projectsponsor']);
                                                const projectType = readProjectField(project, ['new_projectcategoryname', 'new_projectcategory']);
                                                const budget = readProjectField(project, ['new_budget']);
                                                const goalRaw = readProjectField(project, ['new_strategicgoalname', 'new_strategicgoal']);
                                                const strategicObj = GOAL_MAP[Number(goalRaw)] ?? goalRaw;
                                                const manager = readProjectField(project, ['crcf8_projectmanagername', 'crcf8_projectmanager', 'owneridname']);
                                                const startDate = formatTimelineDateLabel(parseTimelineDate(project.new_startdate));
                                                const endDate = formatTimelineDateLabel(parseTimelineDate(project.new_enddate));
                                                const progressRaw = Number(project.new_progress ?? NaN);
                                                const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
                                                const statusText = String(project.new_projectstatusname ?? '').trim();
                                                const statusBucket = businessProjectStatusBucket(project);
                                                const statusLabel =
                                                  statusText
                                                  || (statusBucket === 'completed'
                                                    ? 'Completed'
                                                    : statusBucket === 'delayed'
                                                      ? 'Delayed'
                                                      : statusBucket === 'onTrack'
                                                        ? 'On Track'
                                                        : 'To Start');
                                                const statusKey = statusLabel.toLowerCase();
                                                return (
                                                  <tr key={`${programKey}-${projectName}-${i}`} className="border-t border-gray-100 bg-white">
                                                    <td className="px-3 py-1 font-medium text-[#374151]">{projectName}</td>
                                                    <td className="px-3 py-1">{priority}</td>
                                                    <td className="px-3 py-1">{sponsor}</td>
                                                    <td className="px-3 py-1">{projectType}</td>
                                                    <td className="px-3 py-1"><TableBudgetDisplay value={budget} /></td>
                                                    <td className="px-3 py-1">{strategicObj}</td>
                                                    <td className="px-3 py-1">{manager}</td>
                                                    <td className="px-3 py-1 text-[10px]">
                                                      <div className="space-y-0.5">
                                                        <div><span className="font-normal text-[#6B7280]">Start Date</span>{' '}<span className="font-medium text-[#111827]">{startDate}</span></div>
                                                        <div><span className="font-normal text-[#6B7280]">End Date</span>{' '}<span className="font-medium text-[#111827]">{endDate}</span></div>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-1 w-32">
                                                      <div className="flex items-center gap-2">
                                                        <div className="enj-table-progress-track flex-1">
                                                          <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <span className="w-7 text-right text-[10px] tabular-nums text-gray-600">
                                                          {Math.round(progress)}%
                                                        </span>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-1">
                                                      <span className={`enj-table-status ${portfolioProjectStatusBadgeClass(statusKey, statusBucket as string)}`}>
                                                        {statusLabel}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-gray-100 px-3 py-2">
                    <PagerBar
                      page={portfolioPage}
                      pageSize={portfolioPageSize}
                      total={portfolioPrograms.length}
                      onPrev={() => setPortfolioPage((p) => Math.max(1, p - 1))}
                      onNext={() => setPortfolioPage((p) => Math.min(portfolioTotalPages, p + 1))}
                    />
                  </div>
                </section>
              )}
            </div>
          ) : activeNav === 'Pipeline' ? (
            <BusinessPipelineScreen
              tableRows={businessPipelineTableRows}
              clientOptions={businessClientOptions}
              loading={timelineLoading}
              onNotify={(type, message) => setBusinessReportToast({ type, message })}
              onPipelineCreated={() => setDataRefresh((k) => k + 1)}
            />
          ) : activeNav === 'Reports' ? (
            <ProgramReportsPanel
              isActive={activeNav === 'Reports'}
              onNotify={(type, message) => setBusinessReportToast({ type, message })}
              showTableEdit={false}
            />
          ) : activeNav === 'Feedback' ? (
            <BusinessFeedbackList />
          ) : (
            <div className="relative min-h-[200px]">
              {timelineLoading ? (
                <div className="flex justify-center py-20">
                  <ScreenLoader />
                </div>
              ) : businessDash.isEmpty ? (
                <p className="text-sm text-gray-500 py-8">
                  No project rows returned. When projects exist in Dataverse, this dashboard shows live portfolio metrics.
                </p>
              ) : (
            <div className="enjaz-business-dashboard space-y-4">
          {businessDash.skipReasons.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 mb-4">
              <p className="font-semibold text-amber-900">Charts not shown (missing data)</p>
              <ul className="list-disc pl-4 mt-1.5 space-y-1 text-amber-900/90">
                {businessDash.skipReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Main Dashboard Grid: Top Section (70% left, 30% right) ── */}
          <section className="grid grid-cols-1 gap-2 lg:grid-cols-10 mb-2" style={{ minHeight: '510px' }}>

            {/* ── LEFT COLUMN (60%) ── */}
            <div className="lg:col-span-6 flex flex-col gap-2">

              {/* Summary Cards (35% height) */}
              <div className="flex-[0_0_auto] h-1/3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 h-full">
                  {businessDash.summary3.map((card) => {
                    const iconMap = {
                      completed: <CheckSquare size={28} strokeWidth={1.5} />,
                      ontrack: <Activity size={28} strokeWidth={1.5} />,
                      delayed: <AlertCircle size={28} strokeWidth={1.5} />,
                    };
                    const icon = iconMap[card.icon as keyof typeof iconMap];
                    const trend = card.trend || [];
                    const maxTrend = Math.max(1, ...trend);
                    return (
                      <div key={card.title} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
                        {/* Top: Icon and Value */}
                        <div className="flex items-start justify-between mb-3">
                          <div style={{ color: card.color }} className="flex-shrink-0">{icon}</div>
                          <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                        </div>

                        {/* Title */}
                        <p className="text-xs font-semibold text-gray-600 mb-3">{card.title}</p>

                        {/* Sparkline */}
                        <div className="flex-1 flex items-end justify-between gap-1 h-12 mb-2">
                          {trend.map((val, idx) => (
                            <div key={idx} className="flex-1 flex items-end justify-center">
                              <div
                                className="w-1.5 rounded-t"
                                style={{
                                  height: `${(val / maxTrend) * 100}%`,
                                  backgroundColor: card.color,
                                  minHeight: '2px'
                                }}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Trend text */}
                        <p className="text-xs text-gray-500 text-center">No change from last week</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Timeline (65% height) */}
              {businessDash.has.timeline && (
              <div className="flex-1 min-h-0">
                <div className="bg-white rounded-xl p-4 shadow-sm chart-card border border-gray-100/90 h-full flex flex-col"
                >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-gray-900">Project TimeLine</h2>
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTimelinePeriod(p)}
                        className={`px-1.5 py-0.5 capitalize ${
                          timelinePeriod === p ? 'border-b-2 border-amber-500 font-semibold text-primary' : 'hover:text-gray-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-1.5 flex flex-wrap items-center gap-4 text-[10px] text-gray-700">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timelineStatusFilter.completed}
                      onChange={(e) => setTimelineStatusFilter((prev) => ({ ...prev, completed: e.target.checked }))}
                      className="w-3 h-3 rounded"
                    />
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-[#10B981]" aria-hidden />
                    <span>Completed</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timelineStatusFilter.delayed}
                      onChange={(e) => setTimelineStatusFilter((prev) => ({ ...prev, delayed: e.target.checked }))}
                      className="w-3 h-3 rounded"
                    />
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-[#EF4444]" aria-hidden />
                    <span>Delayed</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timelineStatusFilter.onTrack}
                      onChange={(e) => setTimelineStatusFilter((prev) => ({ ...prev, onTrack: e.target.checked }))}
                      className="w-3 h-3 rounded"
                    />
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-[#3B82F6]" aria-hidden />
                    <span>On Track</span>
                  </label>
                </div>
                {(() => {
                  const tl = periodTimeline;
                  const nY = Math.max(1, tl.years.length);
                  const viewW = 600;
                  const plotH = 158;
                  const yBottom = 141;
                  const yTop = 25;
                  const yearY = 151;
                  const xLeft = 44;
                  const xRight = 560;
                  const xAt = (i: number) =>
                    nY <= 1 ? (xLeft + xRight) / 2 : xLeft + (i * (xRight - xLeft)) / Math.max(1, nY - 1);
                  const yFor = (v: number) => yBottom - (v / 50) * (yBottom - yTop);
                  const stroke = { completed: '#10B981', delayed: '#EF4444', onTrack: '#3B82F6' } as const;
                  return (
                <svg viewBox={`0 0 ${viewW} ${plotH}`} className="h-48 w-full max-w-full chart-svg" preserveAspectRatio="xMidYMid meet">
                  {[0, 1, 2, 3, 4, 5, 6].map((k) => {
                    const y = yBottom - (k / 6) * (yBottom - yTop);
                    return (
                      <line key={k} x1={xLeft} y1={y} x2={xRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    );
                  })}
                  {tl.years.map((year, i) => (
                    <text key={year} x={xAt(i)} y={yearY} textAnchor="middle" fontSize="8" fill="#94a3b8">
                      {year}
                    </text>
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6].map((k) => {
                    const yG = yBottom - (k / 6) * (yBottom - yTop);
                    return (
                      <text
                        key={`yl-${k}`}
                        x="8"
                        y={yG}
                        fontSize="7"
                        fill="#9ca3af"
                        textAnchor="start"
                        dominantBaseline="middle"
                      >
                        {k}
                      </text>
                    );
                  })}
                  {timelineStatusFilter.completed && (
                    <>
                      <polyline
                        fill="none"
                        stroke={stroke.completed}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={tl.completed.map((v, i) => `${xAt(i)},${yFor(v)}`).join(' ')}
                      />
                      {tl.completed.map((v, i) => (
                        <circle key={`c-${i}`} cx={xAt(i)} cy={yFor(v)} r="3.2" fill={stroke.completed} stroke="#fff" strokeWidth="1.2" />
                      ))}
                    </>
                  )}
                  {timelineStatusFilter.delayed && (
                    <>
                      <polyline
                        fill="none"
                        stroke={stroke.delayed}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={tl.delayed.map((v, i) => `${xAt(i)},${yFor(v)}`).join(' ')}
                      />
                      {tl.delayed.map((v, i) => (
                        <circle key={`d-${i}`} cx={xAt(i)} cy={yFor(v)} r="3.2" fill={stroke.delayed} stroke="#fff" strokeWidth="1.2" />
                      ))}
                    </>
                  )}
                  {timelineStatusFilter.onTrack && (
                    <>
                      <polyline
                        fill="none"
                        stroke={stroke.onTrack}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={tl.onTrack.map((v, i) => `${xAt(i)},${yFor(v)}`).join(' ')}
                      />
                      {tl.onTrack.map((v, i) => (
                        <circle key={`o-${i}`} cx={xAt(i)} cy={yFor(v)} r="3.2" fill={stroke.onTrack} stroke="#fff" strokeWidth="1.2" />
                      ))}
                    </>
                  )}
                </svg>
                  );
                })()}
                </div>
              </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (40%) ── */}
            <div className="lg:col-span-4 flex flex-col gap-2">
              {/* Projects by Progress (50% height) */}
              <div className="flex-1 min-h-0">
                <DonutChartCard
                  title="Projects by progress"
                  ringWidth={40}
                  slices={progressDonutSlices}
                  centerText={String(businessDash.totalProjectCount)}
                  centerSubtext="projects"
                  className="h-full"
                />
              </div>

              {/* Budget (50% height) */}
              {businessDash.has.budget && (
              <div className="flex-1 min-h-0">
                <DonutChartCard
                  title="Budget"
                  ringWidth={56}
                  slices={businessDash.budgetData.segments.map((s) => {
                    const nm = s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name;
                    return {
                      label: s.name,
                      value: s.value,
                      color: s.color,
                      displayName: s.name,
                      labelLine: `${formatAEDShort(s.value)} ${nm}`,
                    };
                  })}
                  className="h-full"
                />
              </div>
              )}
            </div>
          </section>

          {/* ── ROW 2: KPI, Categories, Projects Count (3 Equal Columns) ── */}
          <section className="grid grid-cols-1 gap-2 lg:grid-cols-3 mb-2">
            {/* KPI */}
            <div className="flex flex-col h-[272px] rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 shrink-0">KPI</h3>
              {(() => {
                const bars = businessDash.kpiPinnacle;
                const VW = 255, VH = 170;
                const CL = 32, CR = 8, CT = 8, CB = 28;
                const chartW = VW - CL - CR, chartH = VH - CT - CB;
                const chartX = CL, chartBottom = CT + chartH;
                const maxV = 100;
                const yTicks = [0, 25, 50, 75, 100];
                const yCoord = (v: number) => chartBottom - (v / maxV) * chartH;
                const slotW = chartW / Math.max(1, bars.length);
                const barW = Math.max(12, Math.min(28, slotW * 0.55));
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                    {yTicks.map((tick) => (
                      <g key={tick}>
                        <line x1={chartX} x2={chartX + chartW} y1={yCoord(tick)} y2={yCoord(tick)} stroke="#e5e7eb" strokeWidth="0.6" />
                        <text x={chartX - 4} y={yCoord(tick) + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                      </g>
                    ))}
                    {bars.map((bar, i) => {
                      const v = Math.max(0, Math.min(100, bar.value));
                      const bH = Math.max(2, (v / maxV) * chartH);
                      const bX = chartX + i * slotW + (slotW - barW) / 2;
                      const bY = chartBottom - bH;
                      return (
                        <g key={bar.label}>
                          <rect x={bX} y={bY} width={barW} height={bH} fill={bar.color} rx="2" className="chart-bar" />
                          <text x={bX + barW / 2} y={bY - 4} fontSize="8" fill="#374151" textAnchor="middle" fontWeight="bold">{Math.round(v)}%</text>
                          <text x={bX + barW / 2} y={chartBottom + 16} fontSize="7.5" fill="#6b7280" textAnchor="middle" fontWeight="500">{bar.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>

            {/* Project Categories */}
            {businessDash.has.category && (
              <DonutChartCard
                title="Project Categories"
                ringWidth={40}
                slices={categoryDonutSlices}
                centerText={String(categoryDonutCenter)}
                className="h-[272px] rounded-lg border border-gray-200 bg-gray-50 p-4"
              />
            )}

            {/* Projects Count */}
            <div className="flex flex-col h-[272px] rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 shrink-0">Projects Count</h3>
              {(() => {
                const bars = businessDash.projectCounts.slice(0, 5);
                const VW = 255, VH = 170;
                const CL = 32, CR = 8, CT = 8, CB = 28;
                const chartW = VW - CL - CR, chartH = VH - CT - CB;
                const chartX = CL, chartBottom = CT + chartH;
                const maxV = 100;
                const yTicks = [0, 25, 50, 75, 100];
                const yCoord = (v: number) => chartBottom - (v / maxV) * chartH;
                const slotW = chartW / Math.max(1, bars.length);
                const barW = Math.max(12, Math.min(28, slotW * 0.55));
                const maxCount = Math.max(1, ...bars.map(b => b.value));
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                    {yTicks.map((tick) => (
                      <g key={tick}>
                        <line x1={chartX} x2={chartX + chartW} y1={yCoord(tick)} y2={yCoord(tick)} stroke="#e5e7eb" strokeWidth="0.6" />
                        <text x={chartX - 4} y={yCoord(tick) + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                      </g>
                    ))}
                    {bars.map((bar, i) => {
                      const v = Math.max(0, Math.min(100, (bar.value / maxCount) * 100));
                      const bH = Math.max(2, (v / maxV) * chartH);
                      const bX = chartX + i * slotW + (slotW - barW) / 2;
                      const bY = chartBottom - bH;
                      return (
                        <g key={bar.label}>
                          <rect x={bX} y={bY} width={barW} height={bH} fill={bar.color} rx="2" className="chart-bar" />
                          <text x={bX + barW / 2} y={bY - 4} fontSize="8" fill="#374151" textAnchor="middle" fontWeight="bold">{bar.value}</text>
                          <text x={bX + barW / 2} y={chartBottom + 16} fontSize="7.5" fill="#6b7280" textAnchor="middle" fontWeight="500">{bar.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </section>

          {/* ── ROW 2: Actual VS Planned & Deviation (2 Equal Columns) ── */}
          {businessDash.has.budgeting && (
          <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {/* ── Actual VS Planned ── */}
            <div className="flex flex-col h-[280px] rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5 shrink-0">Budgeting</p>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h3 className="text-[11px] font-semibold text-gray-600">Actual VS Planned</h3>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#d9bf89]" />Actual</span>
                  <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#a07b3c]" />Planned</span>
                </div>
              </div>
              {(() => {
                const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                const VW = 560, VH = 185;
                const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                const chartX = CL, chartY = CT, chartBottom = CT + chartH;
                const items = businessDash.budgetVsPlanned;
                const maxV = Math.max(1, ...items.map((it) => Math.max(it.actual, it.planned)));
                const tickStep = Math.max(1, Math.ceil(maxV / 5));
                const niceMax = tickStep * 5;
                const yTicks = [0, 1, 2, 3, 4, 5].map((t) => t * tickStep);
                const yCoord = (v: number) => chartBottom - (v / niceMax) * chartH;
                const slotW = chartW / 12;
                const barW = Math.max(4, Math.min(10, slotW / 3));
                const gap = 2;
                const groupW = barW * 2 + gap;
                const isEmpty = items.every((it) => it.actual === 0 && it.planned === 0);
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                    {yTicks.map((tick) => {
                      const y = yCoord(tick);
                      return (
                        <g key={tick}>
                          <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
                          <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                        </g>
                      );
                    })}
                    {isEmpty && <text x={chartX + chartW / 2} y={chartY + chartH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No budget data available</text>}
                    {items.map((item, i) => {
                      const slotX = chartX + i * slotW + (slotW - groupW) / 2;
                      const aH = Math.max(1, (item.actual / niceMax) * chartH);
                      const pH = Math.max(1, (item.planned / niceMax) * chartH);
                      return (
                        <g key={item.month}>
                          <rect x={slotX} y={chartBottom - aH} width={barW} height={aH} fill="#d9bf89" rx="1" className="chart-bar" />
                          <rect x={slotX + barW + gap} y={chartBottom - pH} width={barW} height={pH} fill="#a07b3c" rx="1" className="chart-bar" />
                          <text x={slotX + groupW / 2} y={chartBottom + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{String(item.month).toUpperCase().slice(0, 3)}</text>
                        </g>
                      );
                    })}
                    <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                  </svg>
                );
              })()}
            </div>

            {/* ── Deviation ── */}
            <div className="flex flex-col h-[280px] rounded-lg border border-gray-200 bg-gray-50 p-4 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5 shrink-0">Budgeting</p>
              <h3 className="text-[11px] font-semibold text-gray-600 mb-2 shrink-0">Deviation</h3>
              {(() => {
                const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                const VW = 560, VH = 185;
                const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                const chartX = CL, chartY = CT;
                const items = businessDash.budgetDeviation;
                const maxAbs = Math.max(1, ...items.map((x) => Math.abs(x.val)));
                const absStep = Math.max(1, Math.ceil(maxAbs / 3));
                const niceAbs = absStep * 3;
                const midY = chartY + chartH / 2;
                const halfH = chartH / 2;
                const yTicks = [-3, -2, -1, 0, 1, 2, 3].map((t) => t * absStep);
                const yCoord = (v: number) => midY - (v / niceAbs) * halfH;
                const slotW = chartW / 12;
                const barW = Math.max(4, Math.min(10, slotW / 2.5));
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                    {yTicks.map((tick) => {
                      const y = yCoord(tick);
                      return (
                        <g key={tick}>
                          <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke={tick === 0 ? '#9ca3af' : '#e5e7eb'} strokeWidth={tick === 0 ? '1' : '0.6'} />
                          <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                        </g>
                      );
                    })}
                    {items.map((item, i) => {
                      const v = item.val;
                      const h = Math.max(1, (Math.abs(v) / niceAbs) * halfH);
                      const slotX = chartX + i * slotW + (slotW - barW) / 2;
                      return (
                        <g key={item.month}>
                          <rect x={slotX} y={v >= 0 ? yCoord(v) : midY} width={barW} height={h} fill={v >= 0 ? '#d9bf89' : '#a07b3c'} rx="1" className="chart-bar" />
                          <text x={slotX + barW / 2} y={chartY + chartH + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{String(item.month).toUpperCase().slice(0, 3)}</text>
                        </g>
                      );
                    })}
                    <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                  </svg>
                );
              })()}
            </div>
          </section>
          )}

          {portfolioPrograms.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-gray-900">Portfolio</h2>
                {portfolioPrograms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('Portfolio')}
                    className="bg-transparent p-0 text-xs font-semibold text-[#A08149] hover:underline"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="overflow-x-auto bg-transparent">
                <table className={`${enj.tableBrand} min-w-[980px] text-xs bg-transparent border-separate`}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-l-[11.9px]">Program</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">KPI</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Benefits</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Budget</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Program Manager</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">ROI</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Start Date</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-r-[11.9px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestPortfolio.map((row) => {
                      const pid = String(row.new_programid ?? '');
                      const normalizedPid = normalizeDataverseId(pid);
                      const programName = readProgramString(row, ['new_name']);
                      const programKey = normalizedPid ? `id:${normalizedPid}` : `name:${programName.toLowerCase()}`;
                      const fallbackNameKey = `name:${programName.toLowerCase()}`;
                      const programProjects = (
                        portfolioProjectsByProgramKey.get(programKey)
                        ?? portfolioProjectsByProgramKey.get(fallbackNameKey)
                        ?? []
                      )
                        .slice()
                        .sort((a, b) => {
                          const aStart = parseTimelineDate(a.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                          const bStart = parseTimelineDate(b.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                          return aStart - bStart;
                        });
                      const rawPrgPct = Number(row.new_progresslevel ?? NaN);
                      const pPct = Number.isFinite(rawPrgPct) ? Math.max(0, Math.min(100, rawPrgPct)) : (programProgressById.get(normalizeDataverseId(pid)) ?? 0);
                      const start = parseTimelineDate(row.new_startdate);
                      const isExpanded = expandedPortfolioProgramKey === programKey;
                      const readProjectField = (project: Record<string, unknown>, keys: string[], fallback = '—') => {
                        for (const k of keys) {
                          const v = project[k];
                          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                        }
                        return fallback;
                      };

                      return (
                        <Fragment key={pid || programName}>
                          <tr className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                            <td className="px-3 py-2 font-normal bg-white border-0 rounded-l-[11.9px]">
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 text-left ${enj.tableLink}`}
                                onClick={() => setExpandedPortfolioProgramKey((prev) => (prev === programKey ? null : programKey))}
                                aria-expanded={isExpanded}
                              >
                                <ChevronDown size={14} className={`transition-transform text-[#6B7280] ${isExpanded ? 'rotate-180' : ''}`} />
                                <span className="max-w-[18rem] truncate">{programName}</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_kpi', 'crcf8_kpi'])}</td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_benefits', 'crcf8_benefit'])}</td>
                            <td className="px-3 py-2 bg-white border-0"><TableBudgetDisplay value={readProgramString(row, ['new_budget', 'crcf8_budget'])} /></td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_programmanager', 'new_ownername', 'owneridname'])}</td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramString(row, ['new_roi', 'crcf8_roi'])}</td>
                            <td className="px-3 py-2 whitespace-nowrap bg-white border-0">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={12} className="shrink-0 text-[#9CA3AF]" />
                                <span className="font-medium text-[#111827]">{formatTimelineDateLabel(start)}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 w-40 bg-white border-0 rounded-r-[11.9px]">
                              <div className="flex items-center gap-2">
                                <div className="enj-table-progress-track flex-1">
                                  <div
                                    className="enj-table-progress-fill"
                                    style={{ width: `${Math.max(0, Math.min(100, pPct))}%` }}
                                  />
                                </div>
                                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-gray-600">
                                  {Math.round(pPct)}%
                                </span>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <>
                              {programProjects.length === 0 ? (
                                <tr className="bg-gray-50 border-0">
                                  <td colSpan={8} className="px-3 py-3 text-[11px] text-gray-500 bg-gray-50 border-0">
                                    No projects found for this program.
                                  </td>
                                </tr>
                              ) : (
                                <tr className="bg-gray-50 border-0">
                                  <td colSpan={8} className="px-3 py-2.5 bg-gray-50 border-0">
                                    <div className="overflow-x-auto bg-transparent">
                                      <table className={`${enj.table} min-w-[1140px] text-left text-xs`}>
                                        <thead>
                                          <tr>
                                            <th className="px-3 py-2 font-semibold">Project</th>
                                            <th className="px-3 py-2 font-semibold">Priority</th>
                                            <th className="px-3 py-2 font-semibold">Sponsor</th>
                                            <th className="px-3 py-2 font-semibold">Type</th>
                                            <th className="px-3 py-2 font-semibold">Budget</th>
                                            <th className="px-3 py-2 font-semibold">Starg.obj</th>
                                            <th className="px-3 py-2 font-semibold">Project Manager</th>
                                            <th className="px-3 py-2 font-semibold">Timeline</th>
                                            <th className="px-3 py-2 font-semibold">Progress</th>
                                            <th className="px-3 py-2 font-semibold">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {programProjects.map((project, i) => {
                                            const projectName =
                                              String(project.new_projectname ?? project.new_name ?? 'Project').trim() || 'Project';
                                            const PRIORITY_MAP_: Record<number, string> = { 100000000: 'Low', 100000001: 'Medium', 100000002: 'High' };
                                            const GOAL_MAP_: Record<number, string> = { 100000000: 'Strategic Plan', 100000001: 'Sustainability', 100000002: 'Cost Reduction', 100000003: 'Customer Satisfaction' };
                                            const priorityRaw_ = readProjectField(project, ['new_priorityname', 'new_priority']);
                                            const priority = PRIORITY_MAP_[Number(priorityRaw_)] ?? priorityRaw_;
                                            const sponsor = readProjectField(project, ['crcf8_projectsponsorname', 'crcf8_projectsponsor']);
                                            const projectType = readProjectField(project, ['new_projectcategoryname', 'new_projectcategory']);
                                            const budget = readProjectField(project, ['new_budget']);
                                            const goalRaw_ = readProjectField(project, ['new_strategicgoalname', 'new_strategicgoal']);
                                            const strategicObj = GOAL_MAP_[Number(goalRaw_)] ?? goalRaw_;
                                            const manager = readProjectField(project, ['crcf8_projectmanagername', 'crcf8_projectmanager', 'owneridname']);
                                            const startDate = formatTimelineDateLabel(parseTimelineDate(project.new_startdate));
                                            const endDate = formatTimelineDateLabel(parseTimelineDate(project.new_enddate));
                                            const progressRaw = Number(project.new_progress ?? NaN);
                                            const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
                                            const statusText = String(project.new_projectstatusname ?? '').trim();
                                            const statusBucket = businessProjectStatusBucket(project);
                                            const statusLabel =
                                              statusText
                                              || (statusBucket === 'completed'
                                                ? 'Completed'
                                                : statusBucket === 'delayed'
                                                  ? 'Delayed'
                                                  : statusBucket === 'onTrack'
                                                    ? 'On Track'
                                                    : 'To Start');
                                            const statusKey = statusLabel.toLowerCase();
                                            return (
                                              <tr key={`${programKey}-${projectName}-${i}`} className="border-t border-gray-100 bg-white">
                                                <td className="px-3 py-1 font-medium text-[#374151]">{projectName}</td>
                                                <td className="px-3 py-1">{priority}</td>
                                                <td className="px-3 py-1">{sponsor}</td>
                                                <td className="px-3 py-1">{projectType}</td>
                                                <td className="px-3 py-1"><TableBudgetDisplay value={budget} /></td>
                                                <td className="px-3 py-1">{strategicObj}</td>
                                                <td className="px-3 py-1">{manager}</td>
                                                <td className="px-3 py-1 text-[10px]">
                                                  <div className="space-y-0.5">
                                                    <div><span className="font-normal text-[#6B7280]">Start Date</span>{' '}<span className="font-medium text-[#111827]">{startDate}</span></div>
                                                    <div><span className="font-normal text-[#6B7280]">End Date</span>{' '}<span className="font-medium text-[#111827]">{endDate}</span></div>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-1 w-32">
                                                  <div className="flex items-center gap-2">
                                                    <div className="enj-table-progress-track flex-1">
                                                      <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="w-7 text-right text-[10px] tabular-nums text-gray-600">
                                                      {Math.round(progress)}%
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-1">
                                                  <span className={`enj-table-status ${portfolioProjectStatusBadgeClass(statusKey, statusBucket as string)}`}>
                                                    {statusLabel}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

            </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ProgramDashboard({ onLogout }: { onLogout: () => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [showAddMeetingForm, setShowAddMeetingForm] = useState(false);
  const [programMeetings, setProgramMeetings] = useState<Array<Record<string, unknown>>>([]);
  const [programTeamMemberRows, setProgramTeamMemberRows] = useState<Array<Record<string, unknown>>>([]);
  const [programMeetingsLoading, setProgramMeetingsLoading] = useState(false);
  const [showAddDeliverableForm, setShowAddDeliverableForm] = useState(false);
  const [deliverableListRefresh, setDeliverableListRefresh] = useState(0);
  const [editingDeliverableRow, setEditingDeliverableRow] = useState<import('./generated/models/New_deliverablesModel').New_deliverables | null>(null);
  const [deletingDeliverableRow, setDeletingDeliverableRow] = useState<import('./generated/models/New_deliverablesModel').New_deliverables | null>(null);
  const [deletingDeliverableBusy, setDeletingDeliverableBusy] = useState(false);
  const [showAddProgramForm, setShowAddProgramForm] = useState(false);
  const [programFormMode, setProgramFormMode] = useState<'add' | 'edit'>('add');
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState({
    programName: '',
    benefits: '',
    programManager: '',
    budget: '',
    startDate: todayIso,
    endDate: todayIso,
    roi: '',
    kpi: '',
    status: '',
    progress: '',
  });
  const [programFormBusy, setProgramFormBusy] = useState(false);
  const [programFormMsg, setProgramFormMsg] = useState('');
  const [programToast, setProgramToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [programPipelineData, setProgramPipelineData] = useState<New_pipelines[]>([]);
  const [programPipelineClients, setProgramPipelineClients] = useState<New_clients[]>([]);
  const [programPipelineLoading, setProgramPipelineLoading] = useState(false);
  const [programFormErrors, setProgramFormErrors] = useState<Partial<Record<keyof typeof programForm, string>>>({});
  const [benefitsOptions, setBenefitsOptions] = useState<string[]>([]);
  const [kpiOptions, setKpiOptions] = useState<string[]>([]);
  /** Emails: users with Department/role = Program (matches Power Apps: Filter Users where Department = "Program") */
  const [programManagerEmailOptions, setProgramManagerEmailOptions] = useState<string[]>([]);
  const fallbackStatusOptions = [
    { value: 100000000, label: 'To Start' },
    { value: 100000001, label: 'On Hold' },
    { value: 100000002, label: 'Delayed' },
  ];
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: number }>>(fallbackStatusOptions);
  const [programRows, setProgramRows] = useState<Array<Record<string, unknown>>>([]);
  const [programListPage, setProgramListPage] = useState(1);
  const PROGRAM_LIST_PAGE_SIZE = 5;
  const [programLoading, setProgramLoading] = useState(false);
  const [programColumns, setProgramColumns] = useState<{
    benefits?: string;
    manager?: string;
    budget?: string;
    roi?: string;
    kpi?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    progress?: string;
    name?: string;
  }>({});
  const [programOverviewCounts, setProgramOverviewCounts] = useState({
    programs: 0,
    meetings: 0,
    projects: 0,
    teamMembers: 0,
    issues: 0,
    tasks: 0,
    deliverables: 0,
  });
  const [programChartActual, setProgramChartActual] = useState<number[]>(Array(12).fill(0));
  const [programChartPlanned, setProgramChartPlanned] = useState<number[]>(Array(12).fill(0));
  const [programChartDeviation, setProgramChartDeviation] = useState<number[]>(Array(12).fill(0));
  const [programInsightProjectRows, setProgramInsightProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [programInsightTaskRows, setProgramInsightTaskRows] = useState<Array<Record<string, unknown>>>([]);
  const [programPortfolioExpandedKey, setProgramPortfolioExpandedKey] = useState<string | null>(null);
  const [programPortfolioPage, setProgramPortfolioPage] = useState(1);
  const [programInsightStatusFilter, setProgramInsightStatusFilter] = useState<'all' | 'onTrack' | 'completed' | 'delayed'>('all');
  const [programInsightPeriodFilter, setProgramInsightPeriodFilter] = useState<'allTime' | 'thisMonth' | 'last3' | 'last6' | 'thisYear'>('allTime');
  const [programInsightProjectBars, setProgramInsightProjectBars] = useState([
    { label: 'To Start',  val: 0, color: '#6b7280', bg: '#f3f4f6' },
    { label: 'On Track',  val: 0, color: '#059669', bg: '#d1fae5' },
    { label: 'Completed', val: 0, color: '#1d4ed8', bg: '#dbeafe' },
    { label: 'Delayed',   val: 0, color: '#dc2626', bg: '#fee2e2' },
  ]);
  const [programInsightBudgetSlices, setProgramInsightBudgetSlices] = useState([
    { label: 'No Data', value: 1, color: '#cbd5e1' },
  ]);
  const [programDeliverableDelayed, setProgramDeliverableDelayed] = useState<number[]>(Array(12).fill(0));
  const [programDeliverableDelivered, setProgramDeliverableDelivered] = useState<number[]>(Array(12).fill(0));
  const [programDeliverablePending, setProgramDeliverablePending] = useState<number[]>(Array(12).fill(0));
  const overviewCards = [
    { label: 'Program', value: programOverviewCounts.programs, color: '#b28a44' },
    { label: 'Projects', value: programOverviewCounts.projects, color: '#34d399' },
    { label: 'Team Members', value: programOverviewCounts.teamMembers, color: '#4f46e5' },
    { label: 'Issues', value: programOverviewCounts.issues, color: '#3b82f6' },
    { label: 'Tasks', value: programOverviewCounts.tasks, color: '#fbbf24' },
    { label: 'Deliverables', value: programOverviewCounts.deliverables, color: '#94a3b8' },
    { label: 'Meetings', value: programOverviewCounts.meetings, color: '#64748b' },
  ];
  const navItems = [
    { name: 'Dashboard', icon: <LayoutGrid size={16} /> },
    { name: 'Program', icon: <FolderOpen size={16} /> },
    { name: 'Projects', icon: <Briefcase size={16} /> },
    { name: 'Meetings', icon: <Calendar size={16} /> },
    { name: 'Deliverables', icon: <ShieldCheck size={16} /> },
    { name: 'Reports', icon: <FileText size={16} /> },
    { name: 'Project Pipeline', icon: <TrendingUp size={16} /> },
  ];
  const programPipelineTableRows = useMemo(
    (): BusinessPipelineTableRow[] => programPipelineData.map((r, i) => newPipelineToTableRow(r, i)),
    [programPipelineData],
  );
  const programPipelineClientOptions = useMemo(
    () =>
      programPipelineClients
        .map((c) => ({
          id: String(c.new_clientid),
          name: String(c.new_clientname ?? '').trim(),
        }))
        .filter((c) => c.id && c.name),
    [programPipelineClients],
  );
  const programPortfolioPageSize = 10;
  const programPortfolioLatestFive = useMemo(() => programRows.slice(0, 5), [programRows]);
  const programPortfolioTotalPages = useMemo(
    () => Math.max(1, Math.ceil(programRows.length / programPortfolioPageSize)),
    [programRows.length],
  );
  const pagedProgramPortfolioRows = useMemo(() => {
    const start = (programPortfolioPage - 1) * programPortfolioPageSize;
    return programRows.slice(start, start + programPortfolioPageSize);
  }, [programRows, programPortfolioPage]);
  const programIdToName = useMemo(() => {
    const out = new Map<string, string>();
    for (const row of programRows) {
      const idRaw = row.new_programid;
      const name = String(row.new_name ?? '').trim();
      if (!name) continue;
      if (idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== '') {
        out.set(normalizeDataverseId(String(idRaw)), name);
      }
    }
    return out;
  }, [programRows]);
  const portfolioProgramProgressById = useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of programInsightProjectRows) {
      const idRaw = r._new_program_value ?? r.new_programid;
      if (idRaw === undefined || idRaw === null || String(idRaw).trim() === '') continue;
      const id = normalizeDataverseId(String(idRaw));
      const p = Number(r.new_progress);
      if (!Number.isFinite(p)) continue;
      const cur = acc.get(id) ?? { sum: 0, n: 0 };
      cur.sum += p;
      cur.n += 1;
      acc.set(id, cur);
    }
    const out = new Map<string, number>();
    acc.forEach((v, k) => {
      if (v.n > 0) out.set(k, Math.round((v.sum / v.n) * 10) / 10);
    });
    return out;
  }, [programInsightProjectRows]);
  const portfolioProjectsByProgramKey = useMemo(() => {
    const out = new Map<string, Array<Record<string, unknown>>>();
    for (const project of programInsightProjectRows) {
      const keys: string[] = [];
      const rawId = project._new_program_value ?? project.new_programid;
      if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
        keys.push(`id:${normalizeDataverseId(String(rawId))}`);
      }
      const resolvedProgramName = resolveProjectProgramName(project, programIdToName).trim();
      if (resolvedProgramName) {
        keys.push(`name:${resolvedProgramName.toLowerCase()}`);
      }
      for (const key of keys) {
        const bucket = out.get(key);
        if (bucket) bucket.push(project);
        else out.set(key, [project]);
      }
    }
    return out;
  }, [programInsightProjectRows, programIdToName]);
  const categoryFromMaster = (row: EnjazMasterDataRow): string => {
    const typed = String((row as { new_categorytype?: unknown }).new_categorytype ?? '').trim();
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

  const loadPrograms = async () => {
    setProgramLoading(true);
    try {
      const res = await New_programsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load programs');
      setProgramRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
      setProgramListPage(1);
    } catch (error) {
      setProgramFormMsg(error instanceof Error ? error.message : 'Failed to load programs');
    } finally {
      setProgramLoading(false);
    }
  };

  const loadProgramMeetings = async () => {
    setProgramMeetingsLoading(true);
    try {
      const res = await New_meetingdetailsService.getAll({ top: 2000, orderBy: ['new_meetingdate desc', 'createdon desc'] });
      if (!res.success) {
        setProgramMeetings([]);
      } else {
        const sessionEmail = (getSessionUserEmail() ?? '').trim().toLowerCase();
        const local = sessionEmail.split('@')[0] ?? '';
        const rows = ((res.data ?? []) as unknown as Array<Record<string, unknown>>).filter((row) => {
          if (!sessionEmail) return true;
          const invited = String(row.new_invitememberemails ?? '').toLowerCase();
          return invited.includes(sessionEmail) || (local.length > 1 && invited.includes(local));
        });
        setProgramMeetings(rows);
      }
    } catch {
      setProgramMeetings([]);
    } finally {
      setProgramMeetingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeNav !== 'Project Pipeline') return;
    let cancelled = false;
    (async () => {
      setProgramPipelineLoading(true);
      try {
        const [pipeRes, clientRes] = await Promise.all([
          New_pipelinesService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          New_clientsService.getAll({ top: 500, orderBy: ['new_clientname asc'] }),
        ]);
        if (cancelled) return;
        setProgramPipelineData(
          pipeRes.success && Array.isArray(pipeRes.data) ? (pipeRes.data as New_pipelines[]) : [],
        );
        setProgramPipelineClients(
          clientRes.success && Array.isArray(clientRes.data) ? (clientRes.data as New_clients[]) : [],
        );
      } catch {
        if (!cancelled) {
          setProgramPipelineData([]);
          setProgramPipelineClients([]);
        }
      } finally {
        if (!cancelled) setProgramPipelineLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  const programNotifications = useMemo(() => {
    const scoped = new Set(
      programInsightProjectRows
        .map((r) => String(r.new_projectname ?? r.new_name ?? '').trim())
        .filter(Boolean),
    );
    return buildInboxNotifications('program', {
      teamMembers: programTeamMemberRows,
      projects: programInsightProjectRows,
      tasks: programInsightTaskRows,
      scopedProjectNames: scoped,
    });
  }, [programTeamMemberRows, programInsightProjectRows, programInsightTaskRows]);

  const loadProgramOverviewCounts = async () => {
    const settled = await Promise.allSettled([
      New_programsService.getAll({ top: 5000 }),
      New_projectsService.getAll({ top: 5000 }),
      New_teammembersService.getAll({ top: 5000 }),
      New_issuesService.getAll({ top: 5000 }),
      New_tasksService.getAll({ top: 5000 }),
      New_deliverablesService.getAll({ top: 5000 }),
    ]);
    const teamSettled = settled[2];
    if (teamSettled?.status === 'fulfilled' && (teamSettled.value as { success?: boolean; data?: unknown[] }).success) {
      setProgramTeamMemberRows(
        ((teamSettled.value as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>,
      );
    } else {
      setProgramTeamMemberRows([]);
    }
    const countFromSettled = (idx: number) => {
      const item = settled[idx];
      if (!item || item.status !== 'fulfilled') return 0;
      const res = item.value as { success?: boolean; data?: Array<unknown> };
      return res.success ? (res.data ?? []).length : 0;
    };
    setProgramOverviewCounts({
      meetings: 0,
      programs: countFromSettled(0),
      projects: countFromSettled(1),
      teamMembers: countFromSettled(2),
      issues: countFromSettled(3),
      tasks: countFromSettled(4),
      deliverables: countFromSettled(5),
    });

    const monthIdx = (v: unknown) => {
      const d = new Date(String(v ?? ''));
      return Number.isNaN(d.getTime()) ? -1 : d.getMonth();
    };
    const projectsRes = settled[1];
    const tasksRes = settled[4];
    const projectRows =
      projectsRes && projectsRes.status === 'fulfilled' && projectsRes.value.success
        ? ((projectsRes.value.data ?? []) as unknown as Array<Record<string, unknown>>)
        : [];
    const taskRows =
      tasksRes && tasksRes.status === 'fulfilled' && tasksRes.value.success
        ? ((tasksRes.value.data ?? []) as unknown as Array<Record<string, unknown>>)
        : [];
    const budgetActual = Array(12).fill(0) as number[];
    const budgetPlanned = Array(12).fill(0) as number[];
    projectRows.forEach((r) => {
      const idx = monthIdx(r.new_startdate ?? r.createdon);
      if (idx < 0) return;
      const bu = Number(r.new_budget ?? 0);
      const act = Number(r.new_actualamount ?? 0);
      if (bu > 0) budgetPlanned[idx] += bu;
      if (act > 0) budgetActual[idx] += act;
    });
    const bmax = Math.max(1, ...budgetPlanned, ...budgetActual);
    const toScale = (v: number) => (v / bmax) * 600;
    setProgramChartActual(budgetActual.map(toScale));
    setProgramChartPlanned(budgetPlanned.map(toScale));
    setProgramChartDeviation(budgetPlanned.map((p, i) => {
      const a = budgetActual[i] ?? 0;
      const val = p > 0 ? ((a - p) / p) * 100 : a > 0 ? 30 : 0;
      return Math.max(-30, Math.min(30, val));
    }));
    setProgramInsightProjectRows(projectRows);
    setProgramInsightTaskRows(taskRows);

    const delivSettled = settled[5];
    const delivRows: Array<Record<string, unknown>> =
      delivSettled?.status === 'fulfilled' && (delivSettled.value as { success?: boolean }).success
        ? (((delivSettled.value as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>)
        : [];
    const currYear = new Date().getFullYear();
    const delivTotal = Array(12).fill(0) as number[];
    const delivDone = Array(12).fill(0) as number[];
    const delivPending = Array(12).fill(0) as number[];
    delivRows.forEach((row) => {
      const d = new Date(String(row.new_duedate ?? row.new_deliverydate ?? row.createdon ?? ''));
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== currYear) return;
      const mi = d.getMonth();
      const statusNum = Number(row.new_status ?? row.new_deliverablestatus ?? NaN);
      const statusName = String(row.new_statusname ?? row.new_deliverablestatusname ?? '').toLowerCase();
      if (statusNum === 100000000 || statusName.includes('deliver') || statusName.includes('complet') || statusName.includes('done')) {
        delivDone[mi] += 1;
      } else if (statusNum === 100000002 || statusName.includes('delay')) {
        delivTotal[mi] += 1; // reused for Delayed
      } else {
        delivPending[mi] += 1; // To Be Delivered
      }
    });
    setProgramDeliverableDelayed(delivTotal);   // Delayed
    setProgramDeliverableDelivered(delivDone); // Delivered
    setProgramDeliverablePending(delivPending); // To Be Delivered
  };

  useEffect(() => {
    const statusBucket = (r: Record<string, unknown>): 'toStart' | 'onTrack' | 'completed' | 'delayed' => {
      const statusNum = Number(r.new_projectstatus);
      const statusName = String(r.new_projectstatusname ?? '').toLowerCase();
      if (statusNum === 100000003 || statusName.includes('complet')) return 'completed';
      if (statusNum === 100000002 || statusName.includes('delay')) return 'delayed';
      if (statusNum === 100000001 || (statusName.includes('on') && statusName.includes('track'))) return 'onTrack';
      return 'toStart';
    };
    const resolveDate = (r: Record<string, unknown>) =>
      new Date(String(r.new_enddate ?? r.new_startdate ?? r.createdon ?? ''));
    const isWithinPeriod = (dt: Date) => {
      if (Number.isNaN(dt.getTime())) return false;
      if (programInsightPeriodFilter === 'allTime') return true;
      const now = new Date();
      if (programInsightPeriodFilter === 'thisMonth') {
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
      }
      if (programInsightPeriodFilter === 'last3') {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        return dt >= start && dt <= now;
      }
      if (programInsightPeriodFilter === 'last6') {
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        return dt >= start && dt <= now;
      }
      return dt.getFullYear() === now.getFullYear();
    };

    let filteredProjects = programInsightProjectRows.filter((r) => isWithinPeriod(resolveDate(r)));
    if (programInsightStatusFilter !== 'all') {
      filteredProjects = filteredProjects.filter((r) => statusBucket(r) === programInsightStatusFilter);
    }
    const filteredTasks = programInsightTaskRows.filter((r) => isWithinPeriod(resolveDate(r)));

    const buckets = { toStart: 0, onTrack: 0, completed: 0, delayed: 0 };
    filteredProjects.forEach((r) => {
      const b = statusBucket(r);
      buckets[b] += 1;
    });
    const totalProjects = filteredProjects.length;
    const pct = (n: number) => totalProjects > 0 ? Math.round((n / totalProjects) * 100) : 0;
    setProgramInsightProjectBars([
      { label: 'To Start',  val: pct(buckets.toStart),   color: '#6b7280', bg: '#f3f4f6' },
      { label: 'On Track',  val: pct(buckets.onTrack),   color: '#059669', bg: '#d1fae5' },
      { label: 'Completed', val: pct(buckets.completed), color: '#1d4ed8', bg: '#dbeafe' },
      { label: 'Delayed',   val: pct(buckets.delayed),   color: '#dc2626', bg: '#fee2e2' },
    ]);

    const budgetByCategory = new Map<string, number>();
    filteredProjects.forEach((r) => {
      const budgetNum = Number(r.new_budget ?? r.crcf8_budget ?? 0);
      if (!Number.isFinite(budgetNum) || budgetNum <= 0) return;
      const category = String(r.new_projectcategoryname ?? r.new_sectorname ?? r.new_projectcategory ?? 'Other').trim() || 'Other';
      budgetByCategory.set(category, (budgetByCategory.get(category) ?? 0) + budgetNum);
    });
    const budgetColors = ['#3b82f6', '#d4a759', '#60a5fa', '#ef4444', '#4f46e5', '#10b981'];
    const budgetEntries = Array.from(budgetByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({ label, value, color: budgetColors[i % budgetColors.length] }));
    setProgramInsightBudgetSlices(
      budgetEntries.length > 0
        ? budgetEntries
        : [{ label: 'No Data', value: 1, color: '#cbd5e1' }],
    );

    const now = new Date();
    const monthWindow = Array.from({ length: 5 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (4 - i), 1));
    const slotFor = (d: Date) => monthWindow.findIndex((m) => m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth());
    const milestoneActual = Array(5).fill(0) as number[];
    const milestonePlanned = Array(5).fill(0) as number[];
    filteredProjects.forEach((r) => {
      const dt = resolveDate(r);
      if (Number.isNaN(dt.getTime())) return;
      const idx = slotFor(dt);
      if (idx >= 0) milestoneActual[idx] += 1;
    });
    filteredTasks.forEach((r) => {
      const dt = resolveDate(r);
      if (Number.isNaN(dt.getTime())) return;
      const idx = slotFor(dt);
      if (idx >= 0) milestonePlanned[idx] += 1;
    });
  }, [programInsightProjectRows, programInsightTaskRows, programInsightStatusFilter, programInsightPeriodFilter]);

  useEffect(() => {
    if (activeNav !== 'Meetings') return;
    void loadProgramMeetings();
  }, [activeNav]);

  /**
   * Program Add/Edit — Project Manager: Users where `new_role` is Program (choice 100000002),
   * options show `new_newcolumn` only (per Users table spec).
   */
  const loadProgramManagerEmails = async () => {
    try {
      const res = await NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) return;
      const userRows = (res.data ?? []) as Array<Record<string, unknown>>;

      const isProgramRole = (u: Record<string, unknown>) => {
        const raw = u.new_role;
        const n = Number(raw);
        if (!Number.isNaN(n) && n === 100000002) return true; // Dataverse: Program
        if (String(raw ?? '') === '100000002') return true;
        if (String(raw ?? '').trim() === 'Program') return true;
        return String(u.new_rolename ?? '').trim().toLowerCase() === 'program';
      };

      const fromNewColumn = userRows
        .filter(isProgramRole)
        .map((u) => String(u.new_newcolumn ?? '').trim())
        .filter((s) => s.length > 0);

      setProgramManagerEmailOptions(
        Array.from(new Set(fromNewColumn)).sort((a, b) => a.localeCompare(b)),
      );
    } catch {
      // non-fatal
    }
  };

  const loadProgramMetadata = async () => {
    const metaRes = await New_programsService.getMetadata();
    const meta = (metaRes as { data?: unknown })?.data as { Attributes?: Array<Record<string, unknown>> } | undefined;
    const attrs = meta?.Attributes ?? [];
    const findAttrByLogical = (logical: string) =>
      attrs.find((a) => String(a.LogicalName ?? a.logicalName ?? '').toLowerCase() === logical.toLowerCase());
    const logicalNames = attrs
      .map((a) => String(a.LogicalName ?? a.logicalName ?? a.SchemaName ?? a.schemaName ?? ''))
      .filter(Boolean);
    const pick = (...parts: string[]) =>
      logicalNames.find((name) => {
        const n = name.toLowerCase();
        return parts.every((p) => n.includes(p));
      });

    const statusAttr = findAttrByLogical('new_status');
    const optionListRaw =
      (statusAttr?.OptionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (statusAttr?.OptionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? (statusAttr?.optionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (statusAttr?.optionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? [];
    const parsedStatusOptions = optionListRaw
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
      .filter((o): o is { value: number; label: string } => Boolean(o));

    const finalStatusOptions = parsedStatusOptions.length > 0 ? parsedStatusOptions : fallbackStatusOptions;
    setProgramColumns({
      name: pick('name') ?? 'new_name',
      startDate: pick('start', 'date') ?? 'new_startdate',
      endDate: pick('end', 'date') ?? 'new_enddate',
      status: pick('program', 'status') ?? pick('status') ?? 'new_programstatus',
      benefits: pick('benefit') ?? 'new_benefits',
      manager: pick('manager') ?? 'new_programmanager',
      budget: pick('budget') ?? 'crcf8_budget',
      roi: pick('roi') ?? 'new_roi',
      kpi: pick('kpi') ?? 'new_kpi',
      progress: pick('progress') ?? 'new_progresslevel',
    });
    setStatusOptions(finalStatusOptions);
    setProgramForm((f) => ({
      ...f,
      status: f.status || (finalStatusOptions[0] ? String(finalStatusOptions[0].value) : ''),
    }));
  };

  useEffect(() => {
    if (activeNav !== 'Program' && activeNav !== 'Dashboard' && activeNav !== 'Portfolio') return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await loadProgramOverviewCounts();
        if (activeNav === 'Program' || activeNav === 'Portfolio') {
          await loadProgramMetadata();

          const res = await EnjazMasterDataService.getAll({ top: 1000, orderBy: ['new_code asc'] });
          if (!res.success) throw new Error(res.error?.message ?? 'Failed to load master data options');
          const rows = res.data ?? [];
          const benefits = rows
            .filter((r) => categoryFromMaster(r) === 'Benefits')
            .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
            .filter(Boolean);
          const kpis = rows
            .filter((r) => categoryFromMaster(r) === 'KPI')
            .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
            .filter(Boolean);
          if (!cancelled) {
            setBenefitsOptions(Array.from(new Set(benefits)));
            setKpiOptions(Array.from(new Set(kpis)));
          }
          if (!cancelled) await loadProgramManagerEmails();
          if (!cancelled) await loadPrograms();
        } else if (activeNav === 'Dashboard' || activeNav === 'Portfolio') {
          if (!cancelled) await loadPrograms();
        }
      } catch (error) {
        if (!cancelled) setProgramFormMsg(error instanceof Error ? error.message : 'Failed to load dropdown values');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== 'Portfolio') return;
    if (programPortfolioPage > programPortfolioTotalPages) setProgramPortfolioPage(programPortfolioTotalPages);
    if (programPortfolioPage < 1) setProgramPortfolioPage(1);
  }, [activeNav, programPortfolioPage, programPortfolioTotalPages]);

  const getValueFromRow = (row: Record<string, unknown>, key: string): unknown => {
    if (row[key] !== undefined) return row[key];
    const lower = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lower) return row[k];
    }
    return undefined;
  };

  const getProgramBudgetDisplay = (row: Record<string, unknown>) => {
    const formatPrimitive = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
      if (typeof v === 'string') {
        const t = v.trim();
        return t || null;
      }
      if (typeof v === 'object' && v !== null) {
        const o = v as { Value?: number; value?: number };
        if (o.Value !== undefined && o.Value !== null && !Number.isNaN(o.Value)) return String(o.Value);
        if (o.value !== undefined && o.value !== null && !Number.isNaN(o.value)) return String(o.value);
      }
      return null;
    };

    const raw = (k: string) => formatPrimitive(getValueFromRow(row, k));

    const tryKeys = [
      'crcf8_budget',
      programColumns.budget,
      'new_budget',
      'crcf8_programbudget',
      'new_programbudget',
      'new_program_budget',
    ].filter(Boolean) as string[];
    for (const k of tryKeys) {
      const t = raw(k);
      if (t !== null && t !== '') return t;
    }
    for (const k of Object.keys(row)) {
      const low = k.toLowerCase();
      if (!low.includes('budget') || low.includes('name') || low.includes('transaction') || k.includes('@')) continue;
      const t = formatPrimitive(row[k]);
      if (t !== null && t !== '') return t;
    }
    return '';
  };

  const clearProgramForm = () => {
    setProgramForm({
      programName: '',
      benefits: '',
      programManager: programManagerEmailOptions[0] ?? '',
      budget: '',
      startDate: todayIso,
      endDate: todayIso,
      roi: '',
      kpi: '',
      status: statusOptions[0] ? String(statusOptions[0].value) : '',
      progress: '',
    });
    setProgramFormErrors({});
    setProgramFormMsg('');
  };

  const cancelProgramForm = () => {
    setShowAddProgramForm(false);
    setProgramFormMsg('');
    setProgramFormErrors({});
    setEditingProgramId(null);
    setProgramFormMode('add');
  };

  const openAddProgram = () => {
    setProgramFormMode('add');
    setEditingProgramId(null);
    clearProgramForm();
    void loadProgramManagerEmails();
    setShowAddProgramForm(true);
  };

  const toDateInput = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return todayIso;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return todayIso;
    return d.toISOString().slice(0, 10);
  };

  const openEditProgram = async (row: Record<string, unknown>) => {
    const id = String(row.new_programid ?? '');
    if (!id) {
      setProgramFormMsg('Unable to edit: missing program id.');
      return;
    }
    await loadProgramManagerEmails();
    setProgramFormMode('edit');
    setEditingProgramId(id);
    setProgramFormErrors({});
    setProgramFormMsg('');

    let rowToUse: Record<string, unknown> = { ...row };
    try {
      const res = await New_programsService.get(id);
      if (res.success && res.data) {
        rowToUse = { ...rowToUse, ...(res.data as object) } as Record<string, unknown>;
      }
    } catch {
      // Use grid row only if single-record load fails
    }

    const readProgramValue = (primary?: string, fallbacks: string[] = []) => {
      const keys = [primary, ...fallbacks].filter(Boolean) as string[];
      for (const key of keys) {
        const val = rowValueText(rowToUse, key);
        if (val !== '-') return val;
      }
      return '';
    };
    setProgramForm({
      programName: readProgramValue(programColumns.name ?? 'new_name', ['new_name']),
      benefits: readProgramValue(programColumns.benefits, ['new_benefits']),
      programManager: readProgramValue(programColumns.manager, ['new_programmanager']),
      budget: getProgramBudgetDisplay(rowToUse),
      startDate: toDateInput(getValueFromRow(rowToUse, programColumns.startDate ?? 'new_startdate')),
      endDate: toDateInput(getValueFromRow(rowToUse, programColumns.endDate ?? 'new_enddate')),
      roi: readProgramValue(programColumns.roi, ['new_roi']),
      kpi: readProgramValue(programColumns.kpi, ['new_kpi']),
      status: String(
        getValueFromRow(rowToUse, programColumns.status ?? 'new_programstatus') ?? rowToUse.new_programstatus ?? '',
      ),
      progress: readProgramValue('new_progresslevel', []),
    });
    setShowAddProgramForm(true);
  };

  const saveProgram = async () => {
    const next: Partial<Record<keyof typeof programForm, string>> = {};
    if (!programForm.programName.trim()) next.programName = 'Program Name is required';
    if (!programForm.benefits) next.benefits = 'Benefits is required';
    if (!programForm.programManager.trim()) next.programManager = 'Project Manager is required';
    if (!programForm.budget.trim()) next.budget = 'Budget is required';
    else if (!/^\d+(\.\d+)?$/.test(programForm.budget.trim())) next.budget = 'Budget must be numbers only';
    if (!programForm.startDate) next.startDate = 'Start Date is required';
    if (programFormMode === 'add' && programForm.startDate && programForm.startDate < todayIso) next.startDate = 'Past dates are not allowed';
    if (!programForm.endDate) next.endDate = 'End Date is required';
    if (programForm.startDate && programForm.endDate && programForm.endDate < programForm.startDate) next.endDate = 'End Date should be after Start Date';
    if (!programForm.roi.trim()) next.roi = 'ROI is required';
    if (!programForm.kpi) next.kpi = 'KPI is required';
    if (!programForm.status) next.status = 'Program Status is required';
    if (programForm.progress.trim() !== '') {
      const pv = Number(programForm.progress);
      if (!Number.isFinite(pv) || pv < 0 || pv > 100) next.progress = 'Progress must be a number between 0 and 100';
    }
    setProgramFormErrors(next);
    if (Object.keys(next).length > 0) return;

    setProgramFormBusy(true);
    setProgramFormMsg('');
    try {
      const payload: Record<string, unknown> = {
        [programColumns.name ?? 'new_name']: programForm.programName.trim(),
        [programColumns.startDate ?? 'new_startdate']: new Date(programForm.startDate).toISOString(),
        new_programstatus: Number(programForm.status),
        new_benefits: programForm.benefits,
        new_programmanager: programForm.programManager.trim(),
        new_roi: programForm.roi.trim(),
        new_kpi: programForm.kpi,
        new_enddate: new Date(programForm.endDate).toISOString(),
        crcf8_budget: Number(programForm.budget),
        ...(programForm.progress.trim() !== '' && { new_progresslevel: Number(programForm.progress) }),
      };
      if (programColumns.status && programColumns.status !== 'new_programstatus') {
        payload[programColumns.status] = Number(programForm.status);
      }
      if (programColumns.benefits) payload[programColumns.benefits] = programForm.benefits;
      if (programColumns.manager) payload[programColumns.manager] = programForm.programManager.trim();
      if (programColumns.budget && programColumns.budget !== 'crcf8_budget') {
        payload[programColumns.budget] = Number(programForm.budget);
      }
      if (programColumns.roi) payload[programColumns.roi] = programForm.roi.trim();
      if (programColumns.kpi) payload[programColumns.kpi] = programForm.kpi;
      if (programColumns.endDate) payload[programColumns.endDate] = new Date(programForm.endDate).toISOString();

      if (programFormMode === 'edit' && editingProgramId) {
        const res = await New_programsService.update(
          editingProgramId,
          payload as Parameters<typeof New_programsService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update program');
        setProgramFormMsg('Program updated successfully.');
        setProgramToast({ type: 'success', message: 'Program updated successfully.' });
      } else {
        const res = await New_programsService.create(payload as Parameters<typeof New_programsService.create>[0]);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to create program');
        setProgramFormMsg('Program saved successfully.');
        setProgramToast({ type: 'success', message: 'Program created successfully.' });

        // Send email notification for new program
        const programManagerEmail = programForm.programManager?.trim();
        if (programManagerEmail && programManagerEmail.includes('@')) {
          const emailTemplate = generateEmailTemplate(
            'New Program Created',
            'Dear Program Manager,',
            'A new program has been successfully created in the system. Please review the details below and take necessary actions.',
            [
              { label: 'Program Name', value: programForm.programName },
              { label: 'Status', value: statusOptions.find((s) => s.value === Number(programForm.status))?.label || programForm.status },
              { label: 'Start Date', value: programForm.startDate },
              { label: 'End Date', value: programForm.endDate },
              { label: 'Budget', value: programForm.budget || '-' },
              { label: 'Benefits', value: programForm.benefits || '-' },
              { label: 'ROI', value: programForm.roi || '-' },
              { label: 'KPI', value: programForm.kpi || '-' },
            ],
          );

          sendEmailNotification({
            toEmail: programManagerEmail,
            subject: `New Program Created: ${programForm.programName}`,
            htmlBody: emailTemplate,
          }).catch((err) => {
            console.error('Failed to send program creation email:', err);
          });
        }
      }
      clearProgramForm();
      await loadPrograms();
      setShowAddProgramForm(false);
    } catch (error) {
      setProgramFormMsg(error instanceof Error ? error.message : 'Failed to create program');
      setProgramToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create program' });
    } finally {
      setProgramFormBusy(false);
    }
  };

  const rowValueText = (row: Record<string, unknown>, column?: string) => {
    if (!column) return '-';
    if (column === (programColumns.status ?? 'new_status')) {
      const namedStatus = row[`${column}name`] ?? row.new_statusname;
      if (namedStatus !== undefined && namedStatus !== null && String(namedStatus).trim()) return String(namedStatus);
      const rawStatus = row[column] ?? row.new_status;
      const statusNum = Number(rawStatus ?? NaN);
      const mapped = statusOptions.find((opt) => opt.value === statusNum)?.label;
      if (mapped) return mapped;
      const fallbackMapped = fallbackStatusOptions.find((opt) => opt.value === statusNum)?.label;
      if (fallbackMapped) return fallbackMapped;
    }
    const direct = row[column];
    const named = row[`${column}name`];
    const value = named ?? direct;
    if (value === undefined || value === null || String(value).trim() === '') return '-';
    return String(value);
  };
  const readProgramPortfolioText = (
    row: Record<string, unknown>,
    primary?: string,
    fallbacks: string[] = [],
  ) => {
    const keys = [primary, ...fallbacks].filter(Boolean) as string[];
    for (const key of keys) {
      const value = rowValueText(row, key);
      if (value !== '-') return value;
    }
    return '-';
  };

  /** Program list screen — budget donut from `new_program` / `programRows` (same source as the grid). */
  const programListBudgetChartSlices = useMemo((): { label: string; value: number; color: string }[] => {
    try {
      const colors = ['#323b8f', '#1fcf92', '#d4a759', '#60a5fa', '#d65257', '#8b5cf6'];
      const withBudget = programRows
        .map((row) => {
          const name =
            String(getValueFromRow(row, programColumns.name ?? 'new_name') ?? getValueFromRow(row, 'new_name') ?? 'Program')
              .trim() || 'Program';
          const display = getProgramBudgetDisplay(row);
          const n = parseFloat(String(display).replace(/[^0-9.+-]/g, ''));
          const budget = Number.isFinite(n) && n > 0 ? n : 0;
          return { name, budget };
        })
        .filter((x) => x.budget > 0);
      if (withBudget.length === 0) {
        return [{ label: 'No budget data', value: 1, color: '#e5e7eb' }];
      }
      const sorted = [...withBudget].sort((a, b) => b.budget - a.budget);
      const top = sorted.slice(0, 5);
      const otherSum = sorted.slice(5).reduce((s, x) => s + x.budget, 0);
      const slices: { label: string; value: number; color: string }[] = top.map((x, i) => ({
        label: x.name.length > 16 ? `${x.name.slice(0, 15)}…` : x.name,
        value: Math.max(0, Math.round(x.budget)),
        color: colors[i % colors.length] ?? '#94a3b8',
      }));
      if (otherSum > 0) {
        slices.push({ label: 'Other', value: Math.max(0, Math.round(otherSum)), color: '#dbe2f4' });
      }
      return slices;
    } catch {
      return [{ label: 'No data', value: 1, color: '#e5e7eb' }];
    }
  }, [programRows, programColumns]);

  /** Program list screen — one bar per program (progress %), same rows as the grid, max 6 visible. */
  const programListProgressBarRows = useMemo((): { name: string; pct: number }[] => {
    try {
      const col = programColumns.progress ?? 'new_progresslevel';
      return programRows.map((row) => {
        const name =
          String(getValueFromRow(row, programColumns.name ?? 'new_name') ?? getValueFromRow(row, 'new_name') ?? '—')
            .trim() || '—';
        let pct = 0;
        const t = rowValueText(row, col);
        if (t !== '-') {
          const n = parseFloat(String(t).replace(/%/g, ''));
          if (Number.isFinite(n)) pct = Math.min(100, Math.max(0, n));
        }
        if (pct === 0) {
          const n = Number(getValueFromRow(row, 'new_progresslevel') ?? getValueFromRow(row, 'new_progress') ?? getValueFromRow(row, 'crcf8_progress') ?? NaN);
          if (Number.isFinite(n)) pct = Math.min(100, Math.max(0, n));
        }
        return { name, pct };
      });
    } catch {
      return [];
    }
  }, [programRows, programColumns, statusOptions]);


  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="z-[60] w-52 bg-white border-r border-gray-100 flex min-h-0 flex-col flex-shrink-0 pb-8">
        <div className="h-14 border-b border-gray-100 px-4 flex items-center gap-3">
          <LogoMark />
          <span className="text-base sm:text-lg font-bold tracking-wide text-[#232360]">ENJAZ</span>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setActiveNav(name);
                if (name === 'Project Pipeline') setProgramPipelineLoading(true);
                if (name === 'Dashboard' || name === 'Program' || name === 'Portfolio') setProgramLoading(true);
                if (name !== 'Meetings') setShowAddMeetingForm(false);
                if (name !== 'Deliverables') setShowAddDeliverableForm(false);
                if (name !== 'Program') setShowAddProgramForm(false);
              }}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name
                  ? 'text-[#A08149] font-semibold'
                  : 'text-[#344054] hover:bg-gray-50 hover:text-[#344054]'
              }`}
            >
              {activeNav === name && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#A08149]" />
              )}
              {icon}
              {name}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <ThemeModeToggle />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell items={programNotifications} />
            <ProfileDropdown onLogout={onLogout} roleLabel="Program" />
          </div>
        </header>

        <main
          className={`enj-app-main flex-1 min-h-0 min-w-0 flex flex-col ${
            activeNav === 'Projects' || activeNav === 'Program' || activeNav === 'Deliverables'
              ? 'overflow-hidden !pb-0'
              : 'overflow-y-auto'
          }`}
        >
          {programToast && (
            <div className="shrink-0">
              <NotificationToast type={programToast.type} message={programToast.message} onClose={() => setProgramToast(null)} />
            </div>
          )}
          <div className={
            activeNav === 'Projects'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden min-w-0'
              : activeNav === 'Program' || activeNav === 'Deliverables'
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden min-w-0 pb-12'
                : 'space-y-4'
          }>
          {activeNav === 'Program' ? (
            <>
              {showAddProgramForm ? (
                <section className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <h2 className="enj-screen-header">
                      {programFormMode === 'edit' ? 'Program / Edit Program' : 'Program / Add New Program'}
                    </h2>
                    <button
                      type="button"
                      className="text-3xl leading-none text-gray-500 hover:text-gray-700"
                      onClick={cancelProgramForm}
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
                    <label>
                      <span className="text-sm text-[#353b57]">Program Name <span className="text-rose-500">*</span></span>
                      <input
                        className={`${enj.control} mt-2`}
                        placeholder="Enter"
                        value={programForm.programName}
                        onChange={(e) => setProgramForm((f) => ({ ...f, programName: e.target.value }))}
                      />
                      {programFormErrors.programName && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.programName}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Benefits <span className="text-rose-500">*</span></span>
                      <select
                        className={`${enj.control} mt-2 text-gray-500`}
                        value={programForm.benefits}
                        onChange={(e) => setProgramForm((f) => ({ ...f, benefits: e.target.value }))}
                      >
                        <option value="">Select Benefits</option>
                        {benefitsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {programFormErrors.benefits && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.benefits}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Project Manager <span className="text-rose-500">*</span></span>
                      <select
                        className={`${enj.control} mt-2 text-gray-500`}
                        value={programForm.programManager}
                        onChange={(e) => setProgramForm((f) => ({ ...f, programManager: e.target.value }))}
                      >
                        <option value="">Select Project Manager</option>
                        {Array.from(new Set([...programManagerEmailOptions, programForm.programManager].filter(Boolean)))
                          .sort((a, b) => a.localeCompare(b))
                          .map((email) => (
                            <option key={email} value={email}>{email}</option>
                          ))}
                      </select>
                      {programFormErrors.programManager && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.programManager}</p>}
                    </label>

                    <label>
                      <span className="text-sm text-[#353b57]">Budgets <span className="text-rose-500">*</span></span>
                      <div className={`mt-2 flex h-9 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm`}>
                        <input
                          className="h-full min-h-0 flex-1 border-0 bg-transparent px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-inset focus:ring-secondary/30"
                          placeholder="Enter"
                          value={programForm.budget}
                          inputMode="decimal"
                          onChange={(e) => {
                            const next = e.target.value;
                            if (/^\d*\.?\d*$/.test(next)) setProgramForm((f) => ({ ...f, budget: next }));
                          }}
                        />
                        <span className="w-12 border-l border-gray-200 text-xs text-gray-500 flex items-center justify-center">AED</span>
                      </div>
                      {programFormErrors.budget && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.budget}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Start Date <span className="text-rose-500">*</span></span>
                      <input
                        type="date"
                        min={programFormMode === 'add' ? todayIso : undefined}
                        className={`${enj.control} mt-2`}
                        value={programForm.startDate}
                        onChange={(e) => setProgramForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                      {programFormErrors.startDate && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.startDate}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">End Date <span className="text-rose-500">*</span></span>
                      <input
                        type="date"
                        min={programForm.startDate || (programFormMode === 'add' ? todayIso : undefined)}
                        className={`${enj.control} mt-2`}
                        value={programForm.endDate}
                        onChange={(e) => setProgramForm((f) => ({ ...f, endDate: e.target.value }))}
                      />
                      {programFormErrors.endDate && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.endDate}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">ROI <span className="text-rose-500">*</span></span>
                      <input
                        className={`${enj.control} mt-2`}
                        placeholder="Enter ROI Value"
                        value={programForm.roi}
                        onChange={(e) => setProgramForm((f) => ({ ...f, roi: e.target.value }))}
                      />
                      {programFormErrors.roi && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.roi}</p>}
                    </label>

                    <label>
                      <span className="text-sm text-[#353b57]">KPI <span className="text-rose-500">*</span></span>
                      <select
                        className={`${enj.control} mt-2 text-gray-500`}
                        value={programForm.kpi}
                        onChange={(e) => setProgramForm((f) => ({ ...f, kpi: e.target.value }))}
                      >
                        <option value="">Select KPI</option>
                        {kpiOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {programFormErrors.kpi && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.kpi}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Program Status <span className="text-rose-500">*</span></span>
                      <select
                        className={`${enj.control} mt-2 text-gray-500`}
                        value={programForm.status}
                        onChange={(e) => setProgramForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="">Select Program Status</option>
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {programFormErrors.status && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.status}</p>}
                    </label>

                    <label>
                      <span className="text-sm text-[#353b57]">Progress (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0 – 100"
                        className={`${enj.control} mt-2`}
                        value={programForm.progress}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || /^\d{0,3}$/.test(raw)) {
                            setProgramForm((f) => ({ ...f, progress: raw }));
                          }
                        }}
                        onBlur={() => {
                          const n = Number(programForm.progress);
                          if (programForm.progress !== '' && (n < 0 || n > 100)) {
                            setProgramForm((f) => ({ ...f, progress: String(Math.max(0, Math.min(100, n))) }));
                          }
                        }}
                      />
                      {programFormErrors.progress && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.progress}</p>}
                    </label>
                  </div>
                  {programFormMsg && <p className="mt-4 text-sm text-gray-700">{programFormMsg}</p>}

                  <div className="mt-10 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className={`${enj.btn} ${enj.btnOutline} px-4 font-medium`}
                      onClick={cancelProgramForm}
                      disabled={programFormBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveProgram()}
                      disabled={programFormBusy}
                      className={`${enj.btn} ${enj.btnPrimary} px-5 font-medium disabled:opacity-50 hover:brightness-105`}
                    >
                      {programFormBusy ? 'Saving...' : programFormMode === 'edit' ? 'Update' : 'Save'}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="flex items-center justify-between">
                    <h2 className="enj-screen-header">Programs</h2>
                    <button
                      className={`${enj.btn} ${enj.btnPrimary} font-medium`}
                      onClick={openAddProgram}
                    >
                      Add New Program
                    </button>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3 mt-3">
                    <div className="overflow-x-auto bg-transparent">
                      <table className={`${enj.tableBrand} w-full min-w-[760px] text-xs bg-transparent border-separate`}>
                        <thead>
                          <tr className="bg-gray-50">
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0 rounded-l-[11.9px]">Program Name</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">Benefits</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">Project Manager</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">Budgets</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">KPI</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">Status</th>
                            <th scope="col" className="px-4 py-3 bg-gray-50 border-0">Progress</th>
                            <th scope="col" className="w-[4.25rem] text-center px-4 py-3 bg-gray-50 border-0 rounded-r-[11.9px]">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {programLoading ? (
                            <tr className="bg-transparent">
                              <td className="px-4 py-6 text-center text-sm text-[#6B7280] bg-transparent" colSpan={8}>
                                Loading programs...
                              </td>
                            </tr>
                          ) : programRows.length === 0 ? (
                            <tr className="bg-transparent">
                              <td className="px-4 py-6 text-center text-sm text-[#6B7280] bg-transparent" colSpan={8}>
                                No programs found.
                              </td>
                            </tr>
                          ) : programRows.slice((programListPage - 1) * PROGRAM_LIST_PAGE_SIZE, programListPage * PROGRAM_LIST_PAGE_SIZE).map((row) => {
                            const id = String(row.new_programid ?? row[programColumns.name ?? 'new_name'] ?? Math.random());
                            const displayText = (primary?: string, fallbacks: string[] = []) => {
                              const keys = [primary, ...fallbacks].filter(Boolean) as string[];
                              for (const key of keys) {
                                const value = rowValueText(row, key);
                                if (value !== '-') return value;
                              }
                              return '-';
                            };
                            const statusLabel = displayText(programColumns.status, ['new_programstatus']);
                            const progressText = rowValueText(row, programColumns.progress);
                            const parsedProgress = Number(String(progressText).replace(/%/g, '').trim());
                            const progressPct = Number.isFinite(parsedProgress)
                              ? Math.max(0, Math.min(100, parsedProgress))
                              : NaN;

                            const programDisplayName = displayText(programColumns.name ?? 'new_name', ['new_name']);

                            return (
                              <tr key={id} className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                                <td className="px-4 py-3 bg-white border-0 rounded-l-[11.9px]">
                                  <button
                                    type="button"
                                    className={enj.tableLink}
                                    title={programDisplayName}
                                    onClick={() => void openEditProgram(row)}
                                  >
                                    {programDisplayName}
                                  </button>
                                </td>
                                <td className="px-4 py-3 bg-white border-0">{displayText(programColumns.benefits, ['new_benefits'])}</td>
                                <td className="px-4 py-3 bg-white border-0">{displayText(programColumns.manager, ['new_programmanager'])}</td>
                                <td className="px-4 py-3 bg-white border-0">
                                  <TableBudgetDisplay value={getProgramBudgetDisplay(row) || '-'} />
                                </td>
                                <td className="px-4 py-3 bg-white border-0">{displayText(programColumns.kpi, ['new_kpi'])}</td>
                                <td className="px-4 py-3 bg-white border-0">
                                  <span className={`enj-table-status ${programTableStatusBadgeClass(statusLabel)}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="min-w-[7.5rem] px-4 py-3 bg-white border-0">
                                  {Number.isFinite(progressPct) ? (
                                    <div className="flex min-w-[6.5rem] max-w-[9rem] items-center gap-2">
                                      <div className="enj-table-progress-track min-w-[3rem] flex-1">
                                        <div
                                          className="enj-table-progress-fill"
                                          style={{ width: `${progressPct}%` }}
                                        />
                                      </div>
                                      <span className="w-8 text-right text-[10px] tabular-nums text-gray-600">{Math.round(progressPct)}%</span>
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="text-center px-4 py-3 bg-white border-0 rounded-r-[11.9px]">
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] shadow-sm transition-colors hover:bg-[#F9FAFB]"
                                    aria-label={`Edit ${programDisplayName}`}
                                    onClick={() => void openEditProgram(row)}
                                  >
                                    <Pencil size={14} strokeWidth={2} aria-hidden />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-3 py-2">
                        <PagerBar
                          page={programListPage}
                          pageSize={PROGRAM_LIST_PAGE_SIZE}
                          total={programRows.length}
                          onPrev={() => setProgramListPage((p) => Math.max(1, p - 1))}
                          onNext={() => setProgramListPage((p) => Math.min(Math.ceil(programRows.length / PROGRAM_LIST_PAGE_SIZE), p + 1))}
                          disabled={programLoading}
                        />
                      </div>
                    </div>

                    <aside className="space-y-3">
                      {programLoading ? (
                        <div className="bg-white rounded-xl p-3 shadow-sm chart-card flex items-center justify-center min-h-[200px]">
                          <p className="text-xs text-gray-400">Loading…</p>
                        </div>
                      ) : (
                        <DonutChartCard
                          title="Budget chart"
                          slices={programListBudgetChartSlices}
                          ringWidth={32}
                          chartSize="sm"
                          className="chart-card"
                          footer={programListBudgetChartSlices.length === 1 && programListBudgetChartSlices[0]?.label === 'No budget data' ? (
                            <p className="text-[10px] text-center text-gray-400">Add budgets to programs to see the split.</p>
                          ) : null}
                        />
                      )}
                      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
                        <h3 className="text-sm font-semibold text-primary mb-2">Program Progress Levels</h3>
                        {programLoading ? (
                          <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
                        ) : programListProgressBarRows.length === 0 ? (
                          <p className="text-xs text-gray-400 py-6 text-center">No programs to display.</p>
                        ) : (
                          <svg viewBox="0 0 260 170" className="w-full h-36 chart-svg">
                            {(() => {
                              const bars = programListProgressBarRows
                                .slice()
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .slice(0, 6);
                              const hasAny = bars.some((b) => b.pct > 0);
                              if (!hasAny) {
                                return (
                                  <text x="130" y="90" textAnchor="middle" fontSize="9" fill="#9ca3af">
                                    No progress values yet
                                  </text>
                                );
                              }
                              const barColors = ['#1fcf92', '#323b8f', '#d4a759', '#60a5fa', '#d65257', '#94a3b8'];
                              const n = bars.length;
                              const maxBar = 110;
                              const yBase = 140;
                              return (
                                <>
                                  {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                    <line
                                      key={`g-${i}`}
                                      x1="28"
                                      x2="248"
                                      y1={yBase - p * maxBar}
                                      y2={yBase - p * maxBar}
                                      stroke="#f1f5f9"
                                    />
                                  ))}
                                  {[0, 25, 50, 75, 100].map((tick) => (
                                    <text
                                      key={`t-${tick}`}
                                      x="6"
                                      y={yBase - (tick / 100) * maxBar + 3}
                                      fontSize="7"
                                      fill="#94a3b8"
                                    >
                                      {tick}
                                    </text>
                                  ))}
                                  {bars.map((b, i) => {
                                    const chartLeft = 32;
                                    const chartW = 200;
                                    const barSlot = chartW / Math.max(1, n);
                                    const w = Math.max(8, n <= 1 ? 48 : barSlot - 6);
                                    const x0 = chartLeft + i * barSlot + (barSlot - w) / 2;
                                    const h = (b.pct / 100) * maxBar;
                                    return (
                                      <g key={b.name + i}>
                                        <rect
                                          x={x0}
                                          y={yBase - h}
                                          width={w}
                                          height={Math.max(1, h)}
                                          rx="3"
                                          fill={barColors[i % barColors.length] ?? '#1fcf92'}
                                          className="chart-bar"
                                        >
                                          <title>{`${b.name}: ${b.pct}%`}</title>
                                        </rect>
                                        <text
                                          x={x0 + w / 2}
                                          y={yBase - h - 4}
                                          textAnchor="middle"
                                          fontSize="8"
                                          fill="#4c556d"
                                        >
                                          {b.pct}%
                                        </text>
                                        <text
                                          x={x0 + w / 2}
                                          y="158"
                                          textAnchor="middle"
                                          fontSize="7"
                                          fill="#6b7280"
                                          transform={`rotate(-48 ${x0 + w / 2} 158)`}
                                        >
                                          {b.name.length > 10 ? `${b.name.slice(0, 9)}…` : b.name}
                                        </text>
                                      </g>
                                    );
                                  })}
                                  {programListProgressBarRows.length > 6 && (
                                    <text x="250" y="12" textAnchor="end" fontSize="7" fill="#9ca3af">
                                      +{programListProgressBarRows.length - 6} more
                                    </text>
                                  )}
                                </>
                              );
                            })()}
                          </svg>
                        )}
                      </div>
                    </aside>
                  </section>
                </>
              )}
            </>
          ) : activeNav === 'Reports' ? (
            <ProgramReportsPanel
              isActive={activeNav === 'Reports'}
              onNotify={(type, message) => setProgramToast({ type, message })}
            />
          ) : activeNav === 'Project Pipeline' ? (
            <BusinessPipelineScreen
              tableRows={programPipelineTableRows}
              clientOptions={programPipelineClientOptions}
              loading={programPipelineLoading}
              hidePipelineCreation
              screenTitle="Project Pipeline"
              onNotify={(type, message) => setProgramToast({ type, message })}
            />
          ) : activeNav === 'Portfolio' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h1 className="enj-screen-header">Portfolio</h1>
              </div>
              {pagedProgramPortfolioRows.length > 0 && (
                <section className="space-y-3">
                  <div className="overflow-x-auto bg-transparent">
                    <table className={`${enj.tableBrand} min-w-[980px] text-xs bg-transparent border-separate`}>
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-l-[11.9px]">Program</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">KPI</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Benefits</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Budget</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Program Manager</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">ROI</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Start Date</th>
                          <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-r-[11.9px]">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedProgramPortfolioRows.map((row) => {
                          const pid = String(row.new_programid ?? '');
                          const normalizedPid = normalizeDataverseId(pid);
                          const programName = readProgramPortfolioText(row, programColumns.name ?? 'new_name', ['new_name']);
                          const programKey = normalizedPid ? `id:${normalizedPid}` : `name:${programName.toLowerCase()}`;
                          const fallbackNameKey = `name:${programName.toLowerCase()}`;
                          const programProjects = (
                            portfolioProjectsByProgramKey.get(programKey)
                            ?? portfolioProjectsByProgramKey.get(fallbackNameKey)
                            ?? []
                          )
                            .slice()
                            .sort((a, b) => {
                              const aStart = parseTimelineDate(a.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                              const bStart = parseTimelineDate(b.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                              return aStart - bStart;
                            });
                          const progressValue = row.new_progresslevel;
                          const rawPrgPct = typeof progressValue === 'number' ? progressValue : (typeof progressValue === 'string' ? Number(progressValue.trim()) : Number(progressValue ?? NaN));
                          const pPct = Number.isFinite(rawPrgPct) && rawPrgPct >= 0 && rawPrgPct <= 100 ? rawPrgPct : (portfolioProgramProgressById.get(normalizedPid) ?? 0);
                          const start = parseTimelineDate(row.new_startdate);
                          const isExpanded = programPortfolioExpandedKey === programKey;
                          const readProjectField = (project: Record<string, unknown>, keys: string[], fallback = '—') => {
                            for (const k of keys) {
                              const v = project[k];
                              if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                            }
                            return fallback;
                          };

                          return (
                            <Fragment key={pid || programName}>
                              <tr className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                                <td className="px-3 py-2 font-normal bg-white border-0 rounded-l-[11.9px]">
                                  <button
                                    type="button"
                                    className={`inline-flex items-center gap-1.5 text-left ${enj.tableLink}`}
                                    onClick={() => setProgramPortfolioExpandedKey((prev) => (prev === programKey ? null : programKey))}
                                    aria-expanded={isExpanded}
                                  >
                                    <ChevronDown size={14} className={`transition-transform text-[#6B7280] ${isExpanded ? 'rotate-180' : ''}`} />
                                    <span className="max-w-[18rem] truncate">{programName}</span>
                                  </button>
                                </td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.kpi, ['new_kpi', 'crcf8_kpi'])}</td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.benefits, ['new_benefits', 'crcf8_benefit'])}</td>
                                <td className="px-3 py-2 bg-white border-0"><TableBudgetDisplay value={getProgramBudgetDisplay(row) || '-'} /></td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.manager, ['new_programmanager', 'new_ownername', 'owneridname'])}</td>
                                <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.roi, ['new_roi', 'crcf8_roi'])}</td>
                                <td className="px-3 py-2 whitespace-nowrap bg-white border-0">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} className="shrink-0 text-[#9CA3AF]" />
                                    <span className="font-medium text-[#111827]">{formatTimelineDateLabel(start)}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2 w-40 bg-white border-0 rounded-r-[11.9px]">
                                  <div className="flex items-center gap-2">
                                    <div className="enj-table-progress-track flex-1">
                                      <div className="enj-table-progress-fill" style={{ width: `${Math.max(0, Math.min(100, pPct))}%` }} />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-gray-600">{Math.round(pPct)}%</span>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <>
                                  {programProjects.length === 0 ? (
                                    <tr className="bg-gray-50 border-0">
                                      <td colSpan={8} className="px-3 py-3 text-[11px] text-gray-500 bg-gray-50 border-0">No projects found for this program.</td>
                                    </tr>
                                  ) : (
                                    <tr className="bg-gray-50 border-0">
                                      <td colSpan={8} className="px-3 py-2.5 bg-gray-50 border-0">
                                        <div className="overflow-x-auto bg-transparent">
                                          <table className={`${enj.table} min-w-[1140px] text-left text-[11px]`}>
                                            <thead>
                                              <tr>
                                                <th className="px-3 py-1.5 font-semibold">Project</th>
                                                <th className="px-3 py-1.5 font-semibold">Priority</th>
                                                <th className="px-3 py-1.5 font-semibold">Sponsor</th>
                                                <th className="px-3 py-1.5 font-semibold">Type</th>
                                                <th className="px-3 py-1.5 font-semibold">Budget</th>
                                                <th className="px-3 py-1.5 font-semibold">Strat.goal</th>
                                                <th className="px-3 py-1.5 font-semibold">Project Manager</th>
                                                <th className="px-3 py-1.5 font-semibold">Timeline</th>
                                                <th className="px-3 py-1.5 font-semibold">Progress</th>
                                                <th className="px-3 py-1.5 font-semibold">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {programProjects.map((project, i) => {
                                                const projectName = String(project.new_projectname ?? project.new_name ?? 'Project').trim() || 'Project';
                                                const PRIORITY_MAP: Record<number, string> = { 100000000: 'Low', 100000001: 'Medium', 100000002: 'High' };
                                                const GOAL_MAP: Record<number, string> = { 100000000: 'Strategic Plan', 100000001: 'Sustainability', 100000002: 'Cost Reduction', 100000003: 'Customer Satisfaction' };
                                                const priorityRaw = readProjectField(project, ['new_priorityname', 'new_priority']);
                                                const priority = PRIORITY_MAP[Number(priorityRaw)] ?? priorityRaw;
                                                const sponsor = readProjectField(project, ['crcf8_projectsponsorname', 'crcf8_projectsponsor']);
                                                const projectType = readProjectField(project, ['new_projectcategoryname', 'new_projectcategory']);
                                                const budget = readProjectField(project, ['new_budget']);
                                                const goalRaw = readProjectField(project, ['new_strategicgoalname', 'new_strategicgoal']);
                                                const strategicObj = GOAL_MAP[Number(goalRaw)] ?? goalRaw;
                                                const manager = readProjectField(project, ['crcf8_projectmanagername', 'crcf8_projectmanager', 'owneridname']);
                                                const startDate = formatTimelineDateLabel(parseTimelineDate(project.new_startdate));
                                                const endDate = formatTimelineDateLabel(parseTimelineDate(project.new_enddate));
                                                const progressRaw = Number(project.new_progress ?? NaN);
                                                const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
                                                const statusText = String(project.new_projectstatusname ?? '').trim();
                                                const statusBucket = businessProjectStatusBucket(project);
                                                const statusLabel = statusText || (statusBucket === 'completed' ? 'Completed' : statusBucket === 'delayed' ? 'Delayed' : statusBucket === 'onTrack' ? 'On Track' : 'To Start');
                                                const statusKey = statusLabel.toLowerCase();
                                                return (
                                                  <tr key={`${programKey}-${projectName}-${i}`} className="border-t border-gray-100 bg-white">
                                                    <td className="px-3 py-1 font-medium text-[#374151]">{projectName}</td>
                                                    <td className="px-3 py-1">{priority}</td>
                                                    <td className="px-3 py-1">{sponsor}</td>
                                                    <td className="px-3 py-1">{projectType}</td>
                                                    <td className="px-3 py-1"><TableBudgetDisplay value={budget} /></td>
                                                    <td className="px-3 py-1">{strategicObj}</td>
                                                    <td className="px-3 py-1">{manager}</td>
                                                    <td className="px-3 py-1 text-[10px]">
                                                      <div className="space-y-0.5">
                                                        <div><span className="font-normal text-[#6B7280]">Start Date</span>{' '}<span className="font-medium text-[#111827]">{startDate}</span></div>
                                                        <div><span className="font-normal text-[#6B7280]">End Date</span>{' '}<span className="font-medium text-[#111827]">{endDate}</span></div>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-1 w-32">
                                                      <div className="flex items-center gap-2">
                                                        <div className="enj-table-progress-track flex-1">
                                                          <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <span className="w-7 text-right text-[10px] tabular-nums text-gray-600">{Math.round(progress)}%</span>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-1">
                                                      <span className={`enj-table-status ${portfolioProjectStatusBadgeClass(statusKey, statusBucket as string)}`}>{statusLabel}</span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-gray-100 px-3 py-2">
                    <PagerBar page={programPortfolioPage} pageSize={programPortfolioPageSize} total={programRows.length} onPrev={() => setProgramPortfolioPage((p) => Math.max(1, p - 1))} onNext={() => setProgramPortfolioPage((p) => Math.min(programPortfolioTotalPages, p + 1))} />
                  </div>
                </section>
              )}
            </div>
          ) : activeNav === 'Deliverables' ? (
            <>
              {showAddDeliverableForm ? (
                <AddDeliverableFormPanel
                  onClose={() => setShowAddDeliverableForm(false)}
                  onNotify={(type, message) => setProgramToast({ type, message })}
                  onSaved={() => setDeliverableListRefresh((k) => k + 1)}
                />
              ) : editingDeliverableRow ? (
                <EditDeliverableFormPanel
                  row={editingDeliverableRow}
                  onClose={() => setEditingDeliverableRow(null)}
                  onNotify={(type, message) => setProgramToast({ type, message })}
                  onSaved={() => { setEditingDeliverableRow(null); setDeliverableListRefresh((k) => k + 1); }}
                />
              ) : (
                <>
                  <DeliverablesListPanel
                    isActive={activeNav === 'Deliverables' && !showAddDeliverableForm && !editingDeliverableRow}
                    refreshKey={deliverableListRefresh}
                    onNotify={(type, message) => setProgramToast({ type, message })}
                    variant="program"
                    onNewDeliverable={() => setShowAddDeliverableForm(true)}
                    onEditRequest={(row) => setEditingDeliverableRow(row)}
                    onDeleteRequest={(row) => setDeletingDeliverableRow(row)}
                  />
                  {/* Delete confirm dialog */}
                  {deletingDeliverableRow && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold text-gray-900">Delete Deliverable</h3>
                        <p className="mb-1 text-sm text-gray-600">
                          Are you sure you want to delete the deliverable for{' '}
                          <span className="font-medium text-gray-800">{String(deletingDeliverableRow.new_projectname ?? '—')}</span>?
                        </p>
                        <p className="mb-5 text-xs text-gray-400">This action cannot be undone.</p>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setDeletingDeliverableRow(null)}
                            className={`${enj.btn} ${enj.btnDefault} text-sm`}
                            disabled={deletingDeliverableBusy}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const id = String(
                                (deletingDeliverableRow as unknown as Record<string, unknown>).new_deliverableid ??
                                (deletingDeliverableRow as unknown as Record<string, unknown>).new_deliverablesid ?? '',
                              );
                              if (!id) { setDeletingDeliverableRow(null); return; }
                              setDeletingDeliverableBusy(true);
                              try {
                                await New_deliverablesService.delete(id);
                                setProgramToast({ type: 'success', message: 'Deliverable deleted.' });
                                setDeletingDeliverableRow(null);
                                setDeliverableListRefresh((k) => k + 1);
                              } catch (e) {
                                setProgramToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to delete.' });
                              } finally {
                                setDeletingDeliverableBusy(false);
                              }
                            }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                            disabled={deletingDeliverableBusy}
                          >
                            {deletingDeliverableBusy ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : activeNav === 'Meetings' ? (
            <>
              {showAddMeetingForm ? (
                <AddMeetingFormPanel
                  parentLabel="Meetings"
                  onCancel={() => setShowAddMeetingForm(false)}
                  onNotify={(type, message) => setProgramToast({ type, message })}
                  onCreated={() => void loadProgramMeetings()}
                />
              ) : (
                <MeetingsBoardPanel
                  meetings={programMeetings}
                  loading={programMeetingsLoading}
                  onNewMeeting={() => setShowAddMeetingForm(true)}
                  onNotify={(type, message) => setProgramToast({ type, message })}
                />
              )}
            </>
          ) : activeNav === 'Projects' ? (
            <ProgramProjectsSection todayIso={todayIso} onToast={setProgramToast} />
          ) : (
            <>
          <section className="bg-white rounded-xl p-5 shadow-sm chart-card">
            <h2 className="enj-dashboard-header mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {overviewCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border-2 bg-white px-4 py-4"
                  style={{ borderColor: card.color }}
                >
                  <p className="text-sm text-gray-400 mb-3 leading-tight">{card.label}</p>
                  <p className="text-3xl font-extrabold text-primary">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="enj-dashboard-header">Insights</h2>
              <div className="flex items-center gap-2">
                <select
                  value={programInsightStatusFilter}
                  onChange={(e) => setProgramInsightStatusFilter(e.target.value as 'all' | 'onTrack' | 'completed' | 'delayed')}
                  className={`${enj.control} !w-auto min-w-[7.5rem] text-sm text-gray-600`}
                >
                  <option value="all">All Status</option>
                  <option value="onTrack">On Track</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
                <select
                  value={programInsightPeriodFilter}
                  onChange={(e) => setProgramInsightPeriodFilter(e.target.value as 'allTime' | 'thisMonth' | 'last3' | 'last6' | 'thisYear')}
                  className={`${enj.control} !w-auto min-w-[8.5rem] text-sm text-gray-600`}
                >
                  <option value="allTime">All Time</option>
                  <option value="thisMonth">This Month</option>
                  <option value="last3">Last 3 Months</option>
                  <option value="last6">Last 6 Months</option>
                  <option value="thisYear">This Year</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
              {/* Budget donut */}
              <DonutChartCard
                title="Budget"
                slices={programInsightBudgetSlices}
                ringWidth={32}
                chartSize="sm"
                className="h-[280px]"
              />

              {/* Projects progress bars */}
              <div className="flex flex-col bg-gray-50 rounded-lg border border-gray-200 p-4 h-[280px]">
                <h3 className="text-[11px] font-semibold text-gray-600 mb-2 shrink-0">Projects</h3>
                <div className="flex flex-1 flex-col justify-center gap-3 min-h-0">
                  {programInsightProjectBars.map((bar) => {
                    const v = Math.max(0, Math.min(100, bar.val));
                    return (
                      <div key={bar.label} className="flex items-center gap-2">
                        <div
                          className="relative h-6 min-w-0 w-full flex-1 overflow-hidden rounded-sm"
                          style={{ backgroundColor: bar.bg ?? `${bar.color}28` }}
                        >
                          <div
                            className="flex h-6 items-center px-2"
                            style={{
                              width: v < 1 ? '0%' : `${v}%`,
                              minWidth: v >= 1 ? '3.5rem' : '0',
                              backgroundColor: bar.color,
                              transition: 'width 0.7s ease',
                            }}
                          >
                            {v >= 1 && (
                              <span className="truncate text-[9px] font-bold uppercase tracking-wide text-white">{bar.label}</span>
                            )}
                          </div>
                          {v < 1 && (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide text-gray-400">{bar.label}</span>
                          )}
                        </div>
                        <span className="w-7 shrink-0 text-right text-[9px] font-semibold tabular-nums text-gray-500">{v}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deliverables area chart */}
              <div className="flex flex-col bg-gray-50 rounded-lg border border-gray-200 p-4 h-[280px]">
                <h3 className="text-[11px] font-semibold text-gray-600 mb-1 shrink-0">Deliverables</h3>
                <div className="flex flex-1 flex-col min-h-0">
                  {(() => {
                    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const CL = 28, CR = 6, CT = 8, CB = 18;
                    const VW = 320, VH = 160;
                    const chartW = VW - CL - CR, chartH = VH - CT - CB;
                    const chartX = CL, chartY = CT, chartBottom = CT + chartH;
                    const maxV = Math.max(1, ...programDeliverableDelayed, ...programDeliverableDelivered, ...programDeliverablePending);
                    const tickStep = Math.max(1, Math.ceil(maxV / 4));
                    const niceMax = tickStep * 4;
                    const yTicks = [0, 1, 2, 3, 4].map((t) => t * tickStep);
                    const yCoord = (v: number) => chartBottom - (v / niceMax) * chartH;
                    const n = 12;
                    const xCoord = (i: number) => chartX + i * (chartW / (n - 1));
                    const linePoints = (arr: number[]) => arr.map((v, i) => `${xCoord(i)},${yCoord(v)}`).join(' ');
                    const areaPoints = (arr: number[]) => `${xCoord(0)},${chartBottom} ${linePoints(arr)} ${xCoord(n - 1)},${chartBottom}`;
                    const isEmpty = programDeliverableDelivered.every((v) => v === 0) && programDeliverablePending.every((v) => v === 0) && programDeliverableDelayed.every((v) => v === 0);
                    return (
                      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                        {yTicks.map((tick) => {
                          const y = yCoord(tick);
                          return (
                            <g key={tick}>
                              <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
                              <text x={chartX - 4} y={y + 3} fontSize="7" fill="#9ca3af" textAnchor="end">{tick}</text>
                            </g>
                          );
                        })}
                        {isEmpty
                          ? <text x={chartX + chartW / 2} y={chartY + chartH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No deliverable data</text>
                          : <>
                            <polygon points={areaPoints(programDeliverableDelivered)} fill="#2563eb" opacity="0.8" />
                            <polygon points={areaPoints(programDeliverablePending)} fill="#f59e0b" opacity="0.8" />
                            <polygon points={areaPoints(programDeliverableDelayed)} fill="#dc2626" opacity="0.8" />
                            <polyline points={linePoints(programDeliverableDelivered)} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                            <polyline points={linePoints(programDeliverablePending)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                            <polyline points={linePoints(programDeliverableDelayed)} fill="none" stroke="#dc2626" strokeWidth="1.5" />
                            {programDeliverableDelivered.map((v, i) => <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r="2" fill="#2563eb" stroke="white" strokeWidth="0.8" />)}
                            {programDeliverablePending.map((v, i) => <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r="2" fill="#f59e0b" stroke="white" strokeWidth="0.8" />)}
                            {programDeliverableDelayed.map((v, i) => <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r="2" fill="#dc2626" stroke="white" strokeWidth="0.8" />)}
                          </>
                        }
                        {monthLabels.map((m, i) => (
                          <text key={m} x={xCoord(i)} y={chartBottom + 12} fontSize="6.5" fill="#9ca3af" textAnchor="middle">{m}</text>
                        ))}
                      </svg>
                    );
                  })()}
                  <div className="flex items-center justify-center gap-3 mt-1 shrink-0">
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb]" />Delivered</span>
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b]" />To Be Delivered</span>
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#dc2626]" />Delayed</span>
                  </div>
                </div>
              </div>
            </div>
          </section>


          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ── Actual VS Planned ── */}
            <div className="flex flex-col h-[280px] rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5 shrink-0">Budgeting</p>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h3 className="text-[11px] font-semibold text-gray-600">Actual VS Planned</h3>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#d4b06a]" />Actual</span>
                  <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#9b6f2c]" />Planned</span>
                </div>
              </div>
              {(() => {
                const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                const VW = 560, VH = 185;
                const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                const chartX = CL, chartY = CT, chartBottom = CT + chartH;
                const monthLabels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
                const maxV = Math.max(1, ...programChartActual, ...programChartPlanned);
                const tickStep = Math.max(1, Math.ceil(maxV / 5));
                const niceMax = tickStep * 5;
                const yTicks = [0, 1, 2, 3, 4, 5].map((t) => t * tickStep);
                const yCoord = (v: number) => chartBottom - (v / niceMax) * chartH;
                const slotW = chartW / 12;
                const barW = Math.max(4, Math.min(10, slotW / 3));
                const gap = 2;
                const groupW = barW * 2 + gap;
                const isEmpty = programChartActual.every((v, i) => v === 0 && (programChartPlanned[i] ?? 0) === 0);
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                    {yTicks.map((tick) => {
                      const y = yCoord(tick);
                      return (
                        <g key={tick}>
                          <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
                          <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                        </g>
                      );
                    })}
                    {isEmpty && <text x={chartX + chartW / 2} y={chartY + chartH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No budget data available</text>}
                    {monthLabels.map((label, i) => {
                      const slotX = chartX + i * slotW + (slotW - groupW) / 2;
                      const aH = Math.max(1, ((programChartActual[i] ?? 0) / niceMax) * chartH);
                      const pH = Math.max(1, ((programChartPlanned[i] ?? 0) / niceMax) * chartH);
                      return (
                        <g key={label}>
                          <rect x={slotX} y={chartBottom - aH} width={barW} height={aH} fill="#d4b06a" rx="1" className="chart-bar" />
                          <rect x={slotX + barW + gap} y={chartBottom - pH} width={barW} height={pH} fill="#9b6f2c" rx="1" className="chart-bar" />
                          <text x={slotX + groupW / 2} y={chartBottom + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{label.slice(0, 3)}</text>
                        </g>
                      );
                    })}
                    <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                  </svg>
                );
              })()}
            </div>

            {/* ── Deviation ── */}
            <div className="flex flex-col h-[280px] rounded-lg border border-gray-200 bg-gray-50 p-4 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5 shrink-0">Budgeting</p>
              <h3 className="text-[11px] font-semibold text-gray-600 mb-2 shrink-0">Deviation</h3>
              {(() => {
                const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                const VW = 560, VH = 185;
                const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                const chartX = CL, chartY = CT;
                const monthLabels = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
                const maxAbs = Math.max(1, ...programChartDeviation.map((x) => Math.abs(x)));
                const absStep = Math.max(1, Math.ceil(maxAbs / 3));
                const niceAbs = absStep * 3;
                const midY = chartY + chartH / 2;
                const halfH = chartH / 2;
                const yTicks = [-3, -2, -1, 0, 1, 2, 3].map((t) => t * absStep);
                const yCoord = (v: number) => midY - (v / niceAbs) * halfH;
                const slotW = chartW / 12;
                const barW = Math.max(4, Math.min(10, slotW / 2.5));
                return (
                  <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                    {yTicks.map((tick) => {
                      const y = yCoord(tick);
                      return (
                        <g key={tick}>
                          <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke={tick === 0 ? '#9ca3af' : '#e5e7eb'} strokeWidth={tick === 0 ? '1' : '0.6'} />
                          <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                        </g>
                      );
                    })}
                    {monthLabels.map((label, i) => {
                      const v = programChartDeviation[i] ?? 0;
                      const h = Math.max(1, (Math.abs(v) / niceAbs) * halfH);
                      const slotX = chartX + i * slotW + (slotW - barW) / 2;
                      return (
                        <g key={label}>
                          <rect x={slotX} y={v >= 0 ? yCoord(v) : midY} width={barW} height={h} fill={v >= 0 ? '#d4b06a' : '#9b6f2c'} rx="1" className="chart-bar" />
                          <text x={slotX + barW / 2} y={chartY + chartH + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{label.slice(0, 3)}</text>
                        </g>
                      );
                    })}
                    <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                  </svg>
                );
              })()}
            </div>
          </section>
          {programPortfolioLatestFive.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-gray-900">Portfolio</h2>
                <button
                  type="button"
                  onClick={() => setActiveNav('Portfolio')}
                  className="bg-transparent p-0 text-xs font-semibold text-[#A08149] hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto bg-transparent">
                <table className={`${enj.tableBrand} min-w-[980px] text-xs bg-transparent border-separate`}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-l-[11.9px]">Program</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">KPI</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Benefits</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Budget</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Program Manager</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">ROI</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)]">Start Date</th>
                      <th className="px-3 py-2 font-semibold bg-[rgba(225,227,236,1)] border-0 text-[rgba(118,131,150,1)] rounded-r-[11.9px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programPortfolioLatestFive.slice(0, 5).map((row) => {
                      const pid = String(row.new_programid ?? '');
                      const normalizedPid = normalizeDataverseId(pid);
                      const programName = readProgramPortfolioText(row, programColumns.name ?? 'new_name', ['new_name']);
                      const programKey = normalizedPid ? `id:${normalizedPid}` : `name:${programName.toLowerCase()}`;
                      const fallbackNameKey = `name:${programName.toLowerCase()}`;
                      const programProjects = (
                        portfolioProjectsByProgramKey.get(programKey)
                        ?? portfolioProjectsByProgramKey.get(fallbackNameKey)
                        ?? []
                      )
                        .slice()
                        .sort((a, b) => {
                          const aStart = parseTimelineDate(a.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                          const bStart = parseTimelineDate(b.new_startdate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                          return aStart - bStart;
                        });
                      const progressValue = row.new_progresslevel;
                      const rawPrgPct = typeof progressValue === 'number' ? progressValue : (typeof progressValue === 'string' ? Number(progressValue.trim()) : Number(progressValue ?? NaN));
                      const pPct = Number.isFinite(rawPrgPct) && rawPrgPct >= 0 && rawPrgPct <= 100 ? rawPrgPct : (portfolioProgramProgressById.get(normalizedPid) ?? 0);
                      const start = parseTimelineDate(row.new_startdate);
                      const isExpanded = programPortfolioExpandedKey === programKey;
                      const readProjectField = (project: Record<string, unknown>, keys: string[], fallback = '—') => {
                        for (const k of keys) {
                          const v = project[k];
                          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                        }
                        return fallback;
                      };

                      return (
                        <Fragment key={pid || programName}>
                          <tr className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0">
                            <td className="px-3 py-2 font-normal bg-white border-0 rounded-l-[11.9px]">
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 text-left ${enj.tableLink}`}
                                onClick={() => setProgramPortfolioExpandedKey((prev) => (prev === programKey ? null : programKey))}
                                aria-expanded={isExpanded}
                              >
                                <ChevronDown size={14} className={`transition-transform text-[#6B7280] ${isExpanded ? 'rotate-180' : ''}`} />
                                <span className="max-w-[18rem] truncate">{programName}</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.kpi, ['new_kpi', 'crcf8_kpi'])}</td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.benefits, ['new_benefits', 'crcf8_benefit'])}</td>
                            <td className="px-3 py-2 bg-white border-0"><TableBudgetDisplay value={getProgramBudgetDisplay(row) || '-'} /></td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.manager, ['new_programmanager', 'new_ownername', 'owneridname'])}</td>
                            <td className="px-3 py-2 bg-white border-0">{readProgramPortfolioText(row, programColumns.roi, ['new_roi', 'crcf8_roi'])}</td>
                            <td className="px-3 py-2 whitespace-nowrap bg-white border-0">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={12} className="shrink-0 text-[#9CA3AF]" />
                                <span className="font-medium text-[#111827]">{formatTimelineDateLabel(start)}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 w-40 bg-white border-0 rounded-r-[11.9px]">
                              <div className="flex items-center gap-2">
                                <div className="enj-table-progress-track flex-1">
                                  <div className="enj-table-progress-fill" style={{ width: `${Math.max(0, Math.min(100, pPct))}%` }} />
                                </div>
                                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-gray-600">{Math.round(pPct)}%</span>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <>
                              {programProjects.length === 0 ? (
                                <tr className="bg-gray-50 border-0">
                                  <td colSpan={8} className="px-3 py-3 text-[11px] text-gray-500 bg-gray-50 border-0">No projects found for this program.</td>
                                </tr>
                              ) : (
                                <tr className="bg-gray-50 border-0">
                                  <td colSpan={8} className="px-3 py-2.5 bg-gray-50 border-0">
                                    <div className="overflow-x-auto bg-transparent">
                                      <table className={`${enj.table} min-w-[1140px] text-left text-[11px]`}>
                                        <thead>
                                          <tr>
                                            <th className="px-3 py-1.5 font-semibold">Project</th>
                                            <th className="px-3 py-1.5 font-semibold">Priority</th>
                                            <th className="px-3 py-1.5 font-semibold">Sponsor</th>
                                            <th className="px-3 py-1.5 font-semibold">Type</th>
                                            <th className="px-3 py-1.5 font-semibold">Budget</th>
                                            <th className="px-3 py-1.5 font-semibold">Strat.goal</th>
                                            <th className="px-3 py-1.5 font-semibold">Project Manager</th>
                                            <th className="px-3 py-1.5 font-semibold">Timeline</th>
                                            <th className="px-3 py-1.5 font-semibold">Progress</th>
                                            <th className="px-3 py-1.5 font-semibold">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {programProjects.map((project, i) => {
                                            const projectName = String(project.new_projectname ?? project.new_name ?? 'Project').trim() || 'Project';
                                            const PRIORITY_MAP: Record<number, string> = { 100000000: 'Low', 100000001: 'Medium', 100000002: 'High' };
                                            const GOAL_MAP: Record<number, string> = { 100000000: 'Strategic Plan', 100000001: 'Sustainability', 100000002: 'Cost Reduction', 100000003: 'Customer Satisfaction' };
                                            const priorityRaw = readProjectField(project, ['new_priorityname', 'new_priority']);
                                            const priority = PRIORITY_MAP[Number(priorityRaw)] ?? priorityRaw;
                                            const sponsor = readProjectField(project, ['crcf8_projectsponsorname', 'crcf8_projectsponsor']);
                                            const projectType = readProjectField(project, ['new_projectcategoryname', 'new_projectcategory']);
                                            const budget = readProjectField(project, ['new_budget']);
                                            const goalRaw = readProjectField(project, ['new_strategicgoalname', 'new_strategicgoal']);
                                            const strategicObj = GOAL_MAP[Number(goalRaw)] ?? goalRaw;
                                            const manager = readProjectField(project, ['crcf8_projectmanagername', 'crcf8_projectmanager', 'owneridname']);
                                            const startDate = formatTimelineDateLabel(parseTimelineDate(project.new_startdate));
                                            const endDate = formatTimelineDateLabel(parseTimelineDate(project.new_enddate));
                                            const progressRaw = Number(project.new_progress ?? NaN);
                                            const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
                                            const statusText = String(project.new_projectstatusname ?? '').trim();
                                            const statusBucket = businessProjectStatusBucket(project);
                                            const statusLabel = statusText || (statusBucket === 'completed' ? 'Completed' : statusBucket === 'delayed' ? 'Delayed' : statusBucket === 'onTrack' ? 'On Track' : 'To Start');
                                            const statusKey = statusLabel.toLowerCase();
                                            return (
                                              <tr key={`${programKey}-${projectName}-${i}`} className="border-t border-gray-100 bg-white">
                                                <td className="px-3 py-1 font-medium text-[#374151]">{projectName}</td>
                                                <td className="px-3 py-1">{priority}</td>
                                                <td className="px-3 py-1">{sponsor}</td>
                                                <td className="px-3 py-1">{projectType}</td>
                                                <td className="px-3 py-1"><TableBudgetDisplay value={budget} /></td>
                                                <td className="px-3 py-1">{strategicObj}</td>
                                                <td className="px-3 py-1">{manager}</td>
                                                <td className="px-3 py-1 text-[10px]">
                                                  <div className="space-y-0.5">
                                                    <div><span className="font-normal text-[#6B7280]">Start Date</span>{' '}<span className="font-medium text-[#111827]">{startDate}</span></div>
                                                    <div><span className="font-normal text-[#6B7280]">End Date</span>{' '}<span className="font-medium text-[#111827]">{endDate}</span></div>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-1 w-32">
                                                  <div className="flex items-center gap-2">
                                                    <div className="enj-table-progress-track flex-1">
                                                      <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="w-7 text-right text-[10px] tabular-nums text-gray-600">{Math.round(progress)}%</span>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-1"><span className={`enj-table-status ${portfolioProjectStatusBadgeClass(statusKey, statusBucket as string)}`}>{statusLabel}</span></td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Due date (yyyy-mm-dd) from a Dataverse `new_enddate` for project task list filters. */
function projectTaskEndDateYmd(row: Record<string, unknown>): string {
  const raw = row.new_enddate;
  if (raw == null || raw === '') return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function projectTaskProjectNameLabel(row: Record<string, unknown>): string {
  return String(row.new_projectname ?? row.new_taskprojectname ?? '').trim();
}

function formatYmdToDdMmYyyy(ymd: string): string {
  if (!ymd) return '';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const PROJECT_TASK_STATUS_FILTER_LABELS = ['All', 'Future Tasks', 'In Progress', 'Delayed', 'Completed'] as const;

function ProjectDashboard({ onLogout }: { onLogout: () => void }) {
  const TEAM_TAB_PAGE_SIZE = 5;
  const todayIso = new Date().toISOString().slice(0, 10);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [teamTab, setTeamTab] = useState('Workload');
  const [teamWorkloadPage, setTeamWorkloadPage] = useState(1);
  const [teamPerformancePage, setTeamPerformancePage] = useState(1);
  const [teamEvaluationPage, setTeamEvaluationPage] = useState(1);
  const [showAddTeamMemberForm, setShowAddTeamMemberForm] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [editingTaskRow, setEditingTaskRow] = useState<Record<string, unknown> | null>(null);
  const [projectTaskDetailRow, setProjectTaskDetailRow] = useState<Record<string, unknown> | null>(null);
  const [projectTaskDeleteCandidate, setProjectTaskDeleteCandidate] = useState<Record<string, unknown> | null>(null);
  const [deletingProjectTask, setDeletingProjectTask] = useState(false);
  const [projectBoardTasks, setProjectBoardTasks] = useState<Array<Record<string, unknown>>>([]);
  const [projectBoardTasksLoading, setProjectBoardTasksLoading] = useState(false);
  const [projectTaskFilterDue, setProjectTaskFilterDue] = useState('All');
  const [projectTaskFilterAssign, setProjectTaskFilterAssign] = useState('All');
  const [projectTaskFilterProject, setProjectTaskFilterProject] = useState('All');
  const [projectTaskFilterStatus, setProjectTaskFilterStatus] = useState('All');
  const [taskListRefresh, setTaskListRefresh] = useState(0);
  const [showAddMeetingForm, setShowAddMeetingForm] = useState(false);
  const [showAddDeliverableForm, setShowAddDeliverableForm] = useState(false);
  const [deliverableListRefresh, setDeliverableListRefresh] = useState(0);
  const [showAddIssueForm, setShowAddIssueForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Record<string, unknown> | null>(null);
  const [issueDeleteCandidate, setIssueDeleteCandidate] = useState<{ id: string; title: string } | null>(null);
  const [deletingIssue, setDeletingIssue] = useState(false);
  const [issueRefreshKey, setIssueRefreshKey] = useState(0);
  const [issueRows, setIssueRows] = useState<Array<Record<string, unknown>>>([]);
  const [issueProjectOptions, setIssueProjectOptions] = useState<string[]>([]);
  const [issueProjectFilter, setIssueProjectFilter] = useState('All');
  const [issueOwnerFilter, setIssueOwnerFilter] = useState('All');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState('All');
  const [issueStatusFilter, setIssueStatusFilter] = useState('All');
  const [issueDateFilter, setIssueDateFilter] = useState('');
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [showProjectIssueDetails, setShowProjectIssueDetails] = useState(false);
  const [projectIssueDetailRow, setProjectIssueDetailRow] = useState<Record<string, unknown> | null>(null);
  const [showProjectSubIssueForm, setShowProjectSubIssueForm] = useState(false);
  const [projectSubIssueFromDetail, setProjectSubIssueFromDetail] = useState(false);
  const [showProjectSubTaskForm, setShowProjectSubTaskForm] = useState(false);
  const [projectSubTaskFromDetail, setProjectSubTaskFromDetail] = useState(false);
  const [projectDashToast, setProjectDashToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [dashboardProjects, setDashboardProjects] = useState<Array<Record<string, unknown>>>([]);
  const [dashboardTasks, setDashboardTasks] = useState<Array<Record<string, unknown>>>([]);
  const [dashboardDeliverables, setDashboardDeliverables] = useState<Array<Record<string, unknown>>>([]);
  const [dashboardProjectsLoading, setDashboardProjectsLoading] = useState(false);
  const [dashboardMeetings, setDashboardMeetings] = useState<Array<Record<string, unknown>>>([]);
  const [projectMeetingsLoading, setProjectMeetingsLoading] = useState(false);
  const [dashboardTeamMembers, setDashboardTeamMembers] = useState<Array<Record<string, unknown>>>([]);
  const [dashboardIssues, setDashboardIssues] = useState<Array<Record<string, unknown>>>([]);
  const [projectInboxData, setProjectInboxData] = useState<{
    team: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
  } | null>(null);
  const [showAllProjectsScreen, setShowAllProjectsScreen] = useState(false);
  const [projectSearchText, setProjectSearchText] = useState('');
  const [projectStatusFilterValue, setProjectStatusFilterValue] = useState('All');
  const [allProjectsPage, setAllProjectsPage] = useState(1);
  const ALL_PROJECTS_PAGE_SIZE = 6;
  /** Insights bar charts: All Projects or a single project (filters in-memory rows). */
  const [insightProjectFilter, setInsightProjectFilter] = useState<string>('all');
  const navItems = [
    { name: 'Dashboard', icon: <LayoutGrid size={16} /> },
    { name: 'Projects', icon: <Briefcase size={16} /> },
    { name: 'Team Management', icon: <Users size={16} /> },
    { name: 'Tasks', icon: <CheckSquare size={16} /> },
    { name: 'Issues', icon: <AlertCircle size={16} /> },
    { name: 'Meetings', icon: <Calendar size={16} /> },
    { name: 'Deliverables', icon: <FolderOpen size={16} /> },
  ];
  const teamTabs = ['Workload', 'Performance', 'Evaluation'];
  const teamWorkloadBarColors = [
    '#21c784', '#dc595f', '#f6be00', '#385a8f', '#7848aa', '#ff7a00', '#1f5fd6', '#1f8a56', '#88afea', '#9a5f1a', '#8b73d6',
  ];
  const issueSeverityLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_issueseverityname ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_issueseverity ?? NaN);
    const fallback = New_issuesnew_issueseverity[raw as keyof typeof New_issuesnew_issueseverity];
    return String(fallback ?? '—');
  };
  const issueStatusLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_issuestatusname ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_issuestatus ?? NaN);
    const fallback = New_issuesnew_issuestatus[raw as keyof typeof New_issuesnew_issuestatus];
    if (!fallback) return '—';
    return String(fallback).replace(/([a-z])([A-Z])/g, '$1 $2');
  };
  /** DD/MM/YYYY for issues data table (matches spec screenshots). */
  const issueTableDate = (value: unknown) => {
    const s = String(value ?? '').trim();
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const projectStatusLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_projectstatusname ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_projectstatus ?? NaN);
    if (raw === 100000003) return 'Completed';
    if (raw === 100000002) return 'Delayed';
    if (raw === 100000001) return 'On Track';
    return 'To Start';
  };
  const STRATEGIC_GOAL_MAP: Record<number, string> = { 100000000: 'Strategic Plan', 100000001: 'Sustainability', 100000002: 'Cost Reduction', 100000003: 'Customer Satisfaction' };
  const projectObjectiveLabel = (row: Record<string, unknown>) => {
    const raw = String(row.new_strategicgoalname ?? row.new_strategicgoal ?? '').trim();
    return (STRATEGIC_GOAL_MAP[Number(raw)] ?? raw) || '—';
  };
  const projectSponsorLabel = (row: Record<string, unknown>) =>
    String(row.crcf8_projectsponsorname ?? row.crcf8_projectsponsor ?? '—').trim() || '—';
  const projectCategoryLabel = (row: Record<string, unknown>) =>
    String(row.new_projectcategoryname ?? row.new_projectcategory ?? '—').trim() || '—';
  const readProjectName = (row: Record<string, unknown>) =>
    String(row.new_projectname ?? row.new_name ?? '').trim();
  const projectBudgetLabel = (row: Record<string, unknown>) => {
    const n = Number(row.new_budget ?? row.crcf8_budget ?? NaN);
    if (Number.isFinite(n)) return String(Math.round(n));
    const s = String(row.new_budget ?? row.crcf8_budget ?? '').trim();
    return s || '—';
  };
  const projectProgressPct = (row: Record<string, unknown>) => {
    const n = Number(row.new_progress ?? 0);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n);
  };
  const projectDateLabel = (value: unknown) => {
    const s = String(value ?? '').trim();
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 10);
    return d.toLocaleDateString();
  };
  const projectStatusClass = (status: string) => {
    const key = status.toLowerCase();
    if (key.includes('complet')) return 'bg-blue-100 text-blue-700';
    if (key.includes('delay')) return 'bg-rose-100 text-rose-700';
    if (key.includes('track') || key.includes('progress')) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };
  const memberUtilizationLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_utilizationname ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_utilization ?? NaN);
    const m: Record<number, string> = { 100000000: 'High', 100000001: 'Medium', 100000002: 'Low' };
    return m[raw] ?? '—';
  };
  const memberSpecializeLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_specializename ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_specialize ?? NaN);
    const m: Record<number, string> = { 100000000: 'Dev', 100000001: 'QA', 100000002: 'PM' };
    return m[raw] ?? '—';
  };
  const memberPerformanceLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_performancename ?? '').trim();
    if (named) return named.replace(/([a-z])([A-Z])/g, '$1 $2');
    const raw = Number(row.new_performance ?? NaN);
    const m: Record<number, string> = { 100000000: 'Outstanding', 100000001: 'Satisfactory', 100000002: 'Needs improvement' };
    return m[raw] ?? '—';
  };
  const memberEvaluationLabel = (row: Record<string, unknown>) => {
    const named = String(row.new_evaluationname ?? '').trim();
    if (named) return named;
    const raw = Number(row.new_evaluation ?? NaN);
    const m: Record<number, string> = { 100000000: 'Excellent', 100000001: 'Good', 100000002: 'Average', 100000003: 'Poor' };
    return m[raw] ?? '—';
  };
  const overview = useMemo(() => {
    const n = (v: number) => (dashboardProjectsLoading ? '—' : v) as string | number;
    return [
      { label: 'Meetings', value: n(dashboardMeetings.length), color: '#d4a759' },
      { label: 'Projects', value: n(dashboardProjects.length), color: '#34d399' },
      { label: 'Team Members', value: n(dashboardTeamMembers.length), color: '#60a5fa' },
      { label: 'Issues', value: n(dashboardIssues.length), color: '#2563eb' },
      { label: 'Tasks', value: n(dashboardTasks.length), color: '#f6be00' },
      { label: 'Deliverables', value: n(dashboardDeliverables.length), color: '#9ca3af' },
    ];
  }, [
    dashboardProjectsLoading,
    dashboardMeetings,
    dashboardTeamMembers,
    dashboardProjects,
    dashboardIssues,
    dashboardTasks,
    dashboardDeliverables,
  ]);
  const projectDashboardTrends = useMemo(() => {
    const months = 12;
    const now = new Date();
    const labels: string[] = [];
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), i, 1);
      labels.push(d.toLocaleDateString(undefined, { month: 'short' }));
    }
    const budgetPlanned = Array(months).fill(0) as number[];
    const budgetActual = Array(months).fill(0) as number[];
    for (const row of dashboardProjects) {
      const d = new Date(String(row.new_startdate ?? row.createdon ?? ''));
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== now.getFullYear()) continue;
      const mi = d.getMonth();
      const bu = Number(row.new_budget ?? 0);
      const act = Number(row.new_actualamount ?? 0);
      if (bu > 0) budgetPlanned[mi] += bu;
      if (act > 0) budgetActual[mi] += act;
    }
    const bmax = Math.max(1, ...budgetPlanned, ...budgetActual);
    const toScale = (v: number) => (v / bmax) * 600;
    const planned = budgetPlanned.map(toScale);
    const actual = budgetActual.map(toScale);
    const deviation = budgetPlanned.map((p, i) => {
      const a = budgetActual[i] ?? 0;
      const val = p > 0 ? ((a - p) / p) * 100 : a > 0 ? 30 : 0;
      return Math.max(-30, Math.min(30, val));
    });
    const allVals = [...planned, ...actual];
    const m = Math.max(1, ...allVals, 0);
    const barH = (v: number) => Math.min(100, Math.round((v / m) * 92));
    const maxAbs = Math.max(1, ...deviation.map((x) => Math.abs(x)));
    return { labels, planned, actual, plannedHeights: planned.map(barH), actualHeights: actual.map((v) => barH(v)), deviation, maxAbs };
  }, [dashboardProjects]);
  const workloadBars = useMemo(() => {
    const weeks = 11;
    const now = new Date();
    const startMonday = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = x.getDay();
      const diff = (day + 6) % 7;
      x.setDate(x.getDate() - diff);
      return x;
    };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const anchor = startMonday(today);
    const counts: { name: string; value: number; color: string }[] = [];
    for (let w = 0; w < weeks; w += 1) {
      const ws = new Date(anchor);
      ws.setDate(ws.getDate() - (weeks - 1 - w) * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      let c = 0;
      for (const row of dashboardTasks) {
        const ref = parseTimelineDate(row.new_enddate) ?? parseTimelineDate(row.new_startdate) ?? parseTimelineDate(row.modifiedon);
        if (ref && ref >= ws && ref <= we) c += 1;
      }
      counts.push({
        name: `WEEK ${w + 1}`,
        value: c,
        color: teamWorkloadBarColors[w % teamWorkloadBarColors.length]!,
      });
    }
    return counts;
  }, [dashboardTasks]);
  const teamManagementDonut = useMemo(() => {
    let uh = 0;
    let um = 0;
    let ul = 0;
    for (const row of dashboardTeamMembers) {
      const lab = memberUtilizationLabel(row).toLowerCase();
      if (lab.includes('high')) uh += 1;
      else if (lab.includes('medium')) um += 1;
      else if (lab.includes('low')) ul += 1;
    }
    const utilTotal = uh + um + ul;
    const utilSlices = utilTotal > 0
      ? [
        { label: 'High', value: uh, color: '#1667de' as const },
        { label: 'Medium', value: um, color: '#d3525a' as const },
        { label: 'Low', value: ul, color: '#3b3a80' as const },
      ]
      : [{ label: 'No Data', value: 1, color: '#e5e7eb' as const }];
    const perCounts = { Outstanding: 0, Satisfactory: 0, NeedsImprov: 0 };
    for (const row of dashboardTeamMembers) {
      const lab = memberPerformanceLabel(row);
      if (lab.includes('Outstanding')) perCounts.Outstanding += 1;
      else if (lab.includes('Satisfactory')) perCounts.Satisfactory += 1;
      else if (lab.includes('improv')) perCounts.NeedsImprov += 1;
    }
    const perTotal = perCounts.Outstanding + perCounts.Satisfactory + perCounts.NeedsImprov;
    const perSlices = perTotal > 0
      ? [
        { label: 'Strong', value: perCounts.Outstanding, color: '#1667de' as const },
        { label: 'Weak', value: perCounts.NeedsImprov, color: '#d3525a' as const },
        { label: 'Avg', value: perCounts.Satisfactory, color: '#3b3a80' as const },
      ]
      : [{ label: 'No Data', value: 1, color: '#e5e7eb' as const }];
    const ev = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
    for (const row of dashboardTeamMembers) {
      const lab = memberEvaluationLabel(row);
      if (lab.includes('Excellent')) ev.Excellent += 1;
      else if (lab.includes('Good')) ev.Good += 1;
      else if (lab.includes('Average')) ev.Average += 1;
      else if (lab.includes('Poor')) ev.Poor += 1;
    }
    const evTotal = ev.Excellent + ev.Good + ev.Average + ev.Poor;
    const evSlices = evTotal > 0
      ? [
        { label: 'Qualified', value: ev.Excellent + ev.Good, color: '#1667de' as const },
        { label: 'Weak', value: ev.Poor, color: '#d3525a' as const },
        { label: 'Medium', value: ev.Average, color: '#3b3a80' as const },
      ]
      : [{ label: 'No Data', value: 1, color: '#e5e7eb' as const }];
    return { utilSlices, perSlices, evSlices, utilEmpty: utilTotal === 0, perEmpty: perTotal === 0, evEmpty: evTotal === 0 };
  }, [dashboardTeamMembers]);
  const teamChartMaxWorkload = useMemo(
    () => Math.max(1, ...workloadBars.map((b) => b.value)),
    [workloadBars],
  );
  const teamPerformanceLines = useMemo(() => {
    const months = 12;
    const now = new Date();
    const monthStarts: Date[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const inRange = (d: Date | null, start: Date, end: Date) => d && d >= start && d <= end;
    const completed: number[] = [];
    const open: number[] = [];
    for (let mi = 0; mi < months; mi += 1) {
      const start = monthStarts[mi]!;
      const end = monthEnd(start);
      let cl = 0;
      let op = 0;
      for (const row of dashboardTasks) {
        const st = String(row.new_taskstatusname ?? '').toLowerCase();
        const stn = Number(row.new_taskstatus ?? NaN);
        const isDone = st.includes('complet') || stn === 100000002;
        const isHold = st.includes('hold') || stn === 100000003;
        const doneDate = parseTimelineDate(row.new_taskcompleteddate) ?? (isDone ? parseTimelineDate(row.modifiedon) : null);
        if (isDone && inRange(doneDate, start, end)) cl += 1;
        else if (!isDone && !isHold) {
          const startT = parseTimelineDate(row.new_startdate) ?? parseTimelineDate(row.createdon);
          if (startT && startT <= end) op += 1;
        }
      }
      completed.push(cl);
      open.push(op);
    }
    const m = Math.max(0.1, ...completed, ...open);
    const y = (v: number) => Math.round(194 - (v / m) * 150);
    const pointsA = completed.map((v, i) => `${52 + i * 48},${y(v)}`).join(' ');
    const pointsB = open.map((v, i) => `${52 + i * 48},${y(v)}`).join(' ');
    const hasData = completed.some((x) => x > 0) || open.some((x) => x > 0);
    return { pointsA, pointsB, hasData };
  }, [dashboardTasks]);
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of dashboardProjects) {
      const id = normalizeDataverseId(String(p.new_projectid ?? p._new_project_value ?? '').trim());
      const name = String(p.new_projectname ?? p.new_name ?? '').trim();
      if (id && name) m.set(id, name);
    }
    return m;
  }, [dashboardProjects]);
  const teamMemberProjectName = useCallback((row: Record<string, unknown>) => {
    const direct = String(row.new_projectname ?? row.crcf8_projectname ?? '').trim();
    if (direct) return direct;
    const idRaw = row._new_project_value ?? row.new_project ?? row.new_projectid;
    const id = normalizeDataverseId(String(idRaw ?? '').trim());
    if (id && projectNameById.has(id)) return projectNameById.get(id)!;
    return '—';
  }, [projectNameById]);
  const taskCountByAssignee = useMemo(() => {
    const m = new Map<string, number>();
    const costByAssignee = new Map<string, number>();
    const workedDaysByAssignee = new Map<string, Set<string>>();
    for (const t of dashboardTasks) {
      const a = String(t.new_assigntoteammember ?? '').trim().toLowerCase();
      if (!a) continue;
      m.set(a, (m.get(a) ?? 0) + 1);
      const c = Number(t.new_cost);
      if (Number.isFinite(c)) {
        costByAssignee.set(a, (costByAssignee.get(a) ?? 0) + c);
      }
      const touched = parseTimelineDate(t.new_taskcompleteddate)
        ?? parseTimelineDate(t.modifiedon)
        ?? parseTimelineDate(t.createdon);
      if (touched) {
        const ymd = `${touched.getFullYear()}-${String(touched.getMonth() + 1).padStart(2, '0')}-${String(touched.getDate()).padStart(2, '0')}`;
        const bucket = workedDaysByAssignee.get(a) ?? new Set<string>();
        bucket.add(ymd);
        workedDaysByAssignee.set(a, bucket);
      }
    }
    return { m, costByAssignee, workedDaysByAssignee };
  }, [dashboardTasks]);
  const teamRows = useMemo(() => {
    return dashboardTeamMembers.map((row) => {
      const name = String(row.new_fullname ?? '—').trim() || '—';
      const key = name.toLowerCase();
      const tcount = taskCountByAssignee.m.get(key) ?? 0;
      const hrs = taskCountByAssignee.costByAssignee.get(key) ?? 0;
      const goalK = row.new_achivedkpi != null || row.new_kpi != null
        ? `${String(row.new_achivedkpi ?? '—')} / ${String(row.new_kpi ?? '—')}`
        : '—';
      const kpi = Number(row.new_kpi);
      const achieved = Number(row.new_achivedkpi);
      const prodPct = Number.isFinite(kpi) && kpi > 0 && Number.isFinite(achieved)
        ? Math.min(100, Math.round((achieved / kpi) * 100))
        : tcount > 0 ? Math.min(100, tcount * 10) : 0;
      const cap = row.new_score != null && String(row.new_score).trim() !== '' ? `${row.new_score}%` : '—';
      const util = memberUtilizationLabel(row);
      const workedDays = taskCountByAssignee.workedDaysByAssignee.get(key)?.size ?? 0;
      return [name, `${Math.round(hrs) || 0}hrs`, goalK, String(tcount), String(workedDays), cap, util, prodPct] as [string, string, string, string, string, string, string, number];
    });
  }, [dashboardTeamMembers, taskCountByAssignee]);
  const evaluationRows = useMemo(() => {
    return dashboardTeamMembers.map((row) => {
      const name = String(row.new_fullname ?? '—').trim() || '—';
      return [
        name,
        teamMemberProjectName(row),
        memberSpecializeLabel(row),
        String(row.new_score ?? memberEvaluationLabel(row) ?? '—'),
        projectDateLabel(row.modifiedon),
      ] as [string, string, string, string, string];
    });
  }, [dashboardTeamMembers, teamMemberProjectName]);
  const performanceMembers = useMemo(() => {
    return dashboardTeamMembers.slice(0, 12).map((row) => {
      const name = String(row.new_fullname ?? '—').trim() || '—';
      const tier = memberSpecializeLabel(row);
      const sc = row.new_score;
      const pct = Number.isFinite(Number(sc)) ? `${Math.min(100, Math.max(0, Math.round(Number(sc))))}%` : '—';
      return [name, tier, pct] as [string, string, string];
    });
  }, [dashboardTeamMembers]);
  const pagedTeamRows = useMemo(() => {
    const start = (teamWorkloadPage - 1) * TEAM_TAB_PAGE_SIZE;
    return teamRows.slice(start, start + TEAM_TAB_PAGE_SIZE);
  }, [teamRows, teamWorkloadPage, TEAM_TAB_PAGE_SIZE]);
  const pagedEvaluationRows = useMemo(() => {
    const start = (teamEvaluationPage - 1) * TEAM_TAB_PAGE_SIZE;
    return evaluationRows.slice(start, start + TEAM_TAB_PAGE_SIZE);
  }, [evaluationRows, teamEvaluationPage, TEAM_TAB_PAGE_SIZE]);
  const pagedPerformanceMembers = useMemo(() => {
    const start = (teamPerformancePage - 1) * TEAM_TAB_PAGE_SIZE;
    return performanceMembers.slice(start, start + TEAM_TAB_PAGE_SIZE);
  }, [performanceMembers, teamPerformancePage, TEAM_TAB_PAGE_SIZE]);
  useEffect(() => {
    const maxWorkloadPage = Math.max(1, Math.ceil(teamRows.length / TEAM_TAB_PAGE_SIZE));
    if (teamWorkloadPage > maxWorkloadPage) setTeamWorkloadPage(maxWorkloadPage);
  }, [teamRows.length, teamWorkloadPage, TEAM_TAB_PAGE_SIZE]);
  useEffect(() => {
    const maxEvaluationPage = Math.max(1, Math.ceil(evaluationRows.length / TEAM_TAB_PAGE_SIZE));
    if (teamEvaluationPage > maxEvaluationPage) setTeamEvaluationPage(maxEvaluationPage);
  }, [evaluationRows.length, teamEvaluationPage, TEAM_TAB_PAGE_SIZE]);
  useEffect(() => {
    const maxPerformancePage = Math.max(1, Math.ceil(performanceMembers.length / TEAM_TAB_PAGE_SIZE));
    if (teamPerformancePage > maxPerformancePage) setTeamPerformancePage(maxPerformancePage);
  }, [performanceMembers.length, teamPerformancePage, TEAM_TAB_PAGE_SIZE]);
  const latestFiveProjects = useMemo(() => dashboardProjects.slice(0, 5), [dashboardProjects]);
  const allProjectStatusOptions = useMemo(() => {
    const vals = Array.from(new Set(dashboardProjects.map(projectStatusLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return ['All', ...vals];
  }, [dashboardProjects]);
  const filteredAllProjects = useMemo(() => {
    const q = projectSearchText.trim().toLowerCase();
    return dashboardProjects.filter((row) => {
      const name = String(row.new_projectname ?? row.new_name ?? '').trim();
      const status = projectStatusLabel(row);
      const start = projectDateLabel(row.new_startdate);
      const end = projectDateLabel(row.new_enddate);
      if (projectStatusFilterValue !== 'All' && status !== projectStatusFilterValue) return false;
      if (!q) return true;
      return [name, status, start, end].some((v) => v.toLowerCase().includes(q));
    });
  }, [dashboardProjects, projectSearchText, projectStatusFilterValue]);
  const allProjectsTotalPages = Math.max(1, Math.ceil(filteredAllProjects.length / ALL_PROJECTS_PAGE_SIZE));
  const pagedAllProjects = filteredAllProjects.slice((allProjectsPage - 1) * ALL_PROJECTS_PAGE_SIZE, allProjectsPage * ALL_PROJECTS_PAGE_SIZE);
  useEffect(() => { setAllProjectsPage(1); }, [projectSearchText, projectStatusFilterValue]);
  const insightProjectNames = useMemo(
    () => Array.from(new Set(dashboardProjects.map((p) => readProjectName(p)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [dashboardProjects],
  );
  const insightScopedProjects = useMemo(() => {
    if (insightProjectFilter === 'all') return dashboardProjects;
    return dashboardProjects.filter((p) => readProjectName(p) === insightProjectFilter);
  }, [dashboardProjects, insightProjectFilter]);
  const insightScopedTasks = useMemo(() => {
    if (insightProjectFilter === 'all') return dashboardTasks;
    return dashboardTasks.filter(
      (t) => String(t.new_taskprojectname ?? t.new_projectname ?? '').trim() === insightProjectFilter,
    );
  }, [dashboardTasks, insightProjectFilter]);
  const projectInsights = useMemo(() => {
    const P = {
      gray:   { fg: '#6b7280', bg: '#f3f4f6' },
      green:  { fg: '#059669', bg: '#d1fae5' },
      blue:   { fg: '#1d4ed8', bg: '#dbeafe' },
      red:    { fg: '#dc2626', bg: '#fee2e2' },
      yellow: { fg: '#b45309', bg: '#fef3c7' },
    } as const;
    const projectStatus = { toStart: 0, onTrack: 0, completed: 0, delayed: 0 };
    insightScopedProjects.forEach((row) => {
      const s = projectStatusLabel(row).toLowerCase();
      if (s.includes('complet')) projectStatus.completed += 1;
      else if (s.includes('delay')) projectStatus.delayed += 1;
      else if (s.includes('on track') || (s.includes('track') && !s.includes('not'))) projectStatus.onTrack += 1;
      else projectStatus.toStart += 1;
    });
    const projectTotal = Math.max(1, insightScopedProjects.length);
    const progressBars = [
      { label: 'TO START',  value: Math.round((projectStatus.toStart   / projectTotal) * 100), ...P.gray  },
      { label: 'ON TRACK',  value: Math.round((projectStatus.onTrack   / projectTotal) * 100), ...P.green },
      { label: 'COMPLETED', value: Math.round((projectStatus.completed / projectTotal) * 100), ...P.blue  },
      { label: 'DELAYED',   value: Math.round((projectStatus.delayed   / projectTotal) * 100), ...P.red   },
    ];

    const taskStatus = { inProgress: 0, newTasks: 0, completed: 0, delayed: 0 };
    insightScopedTasks.forEach((row) => {
      const s = String(row.new_taskstatusname ?? row.new_statusname ?? '').toLowerCase();
      const stn = Number(row.new_taskstatus ?? NaN);
      if (stn === 100000002 || s.includes('complet') || s.includes('done')) taskStatus.completed += 1;
      else if (stn === 100000001 || s.includes('progress')) taskStatus.inProgress += 1;
      else if (stn === 100000003 || s.includes('hold') || s.includes('delay')) taskStatus.delayed += 1;
      else if (stn === 100000000 || s.includes('not')) taskStatus.newTasks += 1;
      else taskStatus.newTasks += 1;
    });
    const taskTotal = Math.max(1, insightScopedTasks.length);
    const taskBars = [
      { label: 'TO DO', value: Math.round((taskStatus.newTasks / taskTotal) * 100), ...P.green },
      { label: 'IN PROGRESS', value: Math.round((taskStatus.inProgress / taskTotal) * 100), ...P.blue },
      { label: 'DELAYED', value: Math.round((taskStatus.delayed / taskTotal) * 100), ...P.red },
      { label: 'DONE', value: Math.round((taskStatus.completed / taskTotal) * 100), ...P.yellow },
    ];

    const categoryMap = new Map<string, number>();
    insightScopedProjects.forEach((row) => {
      const cat = projectCategoryLabel(row);
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    });
    const categoryColors = ['#1667de', '#d3525a', '#3b3a80', '#f6be00'];
    const categorySlicesRaw = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value], i) => ({ label, value, color: categoryColors[i % categoryColors.length] }));
    const categorySlices = categorySlicesRaw.length > 0
      ? categorySlicesRaw
      : [{ label: 'No Data', value: 1, color: '#cbd5e1' }];

    const deliverableTotal = [0, 0, 0, 0, 0];
    const deliverableDone = [0, 0, 0, 0, 0];
    const deliverablePending = [0, 0, 0, 0, 0];
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const monthNames: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      monthNames.push(d.toLocaleDateString(undefined, { month: 'short' }));
    }
    const toIdx = (raw: unknown) => {
      const d = parseTimelineDate(raw);
      if (!d) return -1;
      const idx = (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth());
      return idx >= 0 && idx < 5 ? idx : -1;
    };
    dashboardDeliverables.forEach((row) => {
      const idx = toIdx(row.new_duedate ?? row.new_deliverydate ?? row.createdon);
      if (idx < 0) return;
      deliverableTotal[idx] += 1;
      const s = String(row.new_statusname ?? row.new_deliverablestatusname ?? row.new_status ?? '').toLowerCase();
      if (s.includes('deliver') || s.includes('complete') || s.includes('done')) deliverableDone[idx] += 1;
      else deliverablePending[idx] += 1;
    });
    return {
      progressBars,
      taskBars,
      categorySlices,
      monthNames,
      deliverableTotal,
      deliverableDone,
      deliverablePending,
    };
  }, [insightScopedProjects, insightScopedTasks, dashboardDeliverables]);
  const issueDateIso = (value: unknown) => {
    const s = String(value ?? '').trim();
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const normalizeIssueSeverity = (row: Record<string, unknown>) => {
    const named = issueSeverityLabel(row).toLowerCase();
    if (named.includes('high')) return 'High';
    if (named.includes('medium')) return 'Medium';
    return 'Low';
  };
  const normalizeIssueStatus = (row: Record<string, unknown>) => {
    const named = issueStatusLabel(row).trim().toLowerCase();
    if (named.includes('resolved') || named.includes('solved') || named.includes('closed')) return 'Closed';
    if (named.includes('progress')) return 'In Progress';
    return 'Open';
  };
  const issueFilterOptions = useMemo(() => {
    const owners = Array.from(
      new Set(
        issueRows
          .map((r) => String(r.new_issueowner ?? '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return { projects: issueProjectOptions, owners };
  }, [issueRows, issueProjectOptions]);
  const filteredIssueRows = useMemo(() => {
    return issueRows.filter((row) => {
      const projectName = String(row.new_projectname ?? '').trim();
      const owner = String(row.new_issueowner ?? '').trim();
      const severity = normalizeIssueSeverity(row);
      const status = normalizeIssueStatus(row);
      const raisedIso = issueDateIso(row.new_issuedate ?? row.createdon);
      if (issueProjectFilter !== 'All' && projectName !== issueProjectFilter) return false;
      if (issueOwnerFilter !== 'All' && owner !== issueOwnerFilter) return false;
      if (issueSeverityFilter !== 'All' && severity !== issueSeverityFilter) return false;
      if (issueStatusFilter !== 'All' && status !== issueStatusFilter) return false;
      if (issueDateFilter && raisedIso !== issueDateFilter) return false;
      return true;
    });
  }, [issueRows, issueProjectFilter, issueOwnerFilter, issueSeverityFilter, issueStatusFilter, issueDateFilter]);
  const issueCharts = useMemo(() => {
    const severityCounts = { High: 0, Medium: 0, Low: 0 };
    const projectMap = new Map<string, number>();
    let openCount = 0;
    let closedCount = 0;
    for (const row of filteredIssueRows) {
      const sevNamed = String(row.new_issueseverityname ?? '').trim().toLowerCase();
      const sevRaw = Number(row.new_issueseverity ?? NaN);
      // Severity chart supports only High/Medium/Low.
      if (sevNamed.includes('critical') || sevRaw === 100000003) severityCounts.High += 1;
      else if (sevNamed.includes('high') || sevRaw === 100000002) severityCounts.High += 1;
      else if (sevNamed.includes('medium') || sevRaw === 100000001) severityCounts.Medium += 1;
      else severityCounts.Low += 1;

      const statusNamed = String(row.new_issuestatusname ?? issueStatusLabel(row)).trim().toLowerCase();
      const statusRaw = Number(row.new_issuestatus ?? NaN);
      const isSolved = statusNamed.includes('solved') || statusNamed.includes('resolved') || statusNamed.includes('closed')
        || statusRaw === 100000002 || statusRaw === 100000003;
      if (isSolved) closedCount += 1;
      else openCount += 1;

      const projectName = String(row.new_projectname ?? 'Unassigned').trim() || 'Unassigned';
      projectMap.set(projectName, (projectMap.get(projectName) ?? 0) + 1);
    }
    const projectBars = Array.from(projectMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({
        name,
        shortName: name.length > 12 ? `${name.slice(0, 12)}...` : name,
        value,
        color: ['#d4a759', '#6ea3ef', '#d35b66', '#6b7280', '#b8872e'][i % 5],
      }));
    const projectMax = Math.max(1, ...projectBars.map((p) => p.value));
    const projectTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(projectMax * step));
    const severitySlices = [
      { label: 'High', value: severityCounts.High, color: '#dc595f' },
      { label: 'Medium', value: severityCounts.Medium, color: '#efb4b8' },
      { label: 'Low', value: severityCounts.Low, color: '#d4a759' },
    ];
    const rawStatusSlices = [
      { label: 'Open', value: openCount, color: '#dc4f56' },
      { label: 'Closed', value: closedCount, color: '#1f67e0' },
    ];
    // Keep donut render stable even when only one status bucket has values.
    const statusSlices = (openCount > 0 && closedCount === 0)
      ? [
        { label: 'Open', value: openCount, color: '#dc4f56' },
        { label: 'Closed', value: 0.0001, color: '#1f67e0' },
      ]
      : (closedCount > 0 && openCount === 0)
        ? [
          { label: 'Open', value: 0.0001, color: '#dc4f56' },
          { label: 'Closed', value: closedCount, color: '#1f67e0' },
        ]
        : rawStatusSlices;
    const hasSeverityData = severitySlices.some((s) => s.value > 0);
    const hasStatusData = statusSlices.some((s) => s.value > 0);
    return {
      total: filteredIssueRows.length,
      openCount,
      closedCount,
      severityCounts,
      severitySlices: hasSeverityData ? severitySlices : [{ label: 'No Data', value: 1, color: '#e5e7eb' }],
      hasSeverityData,
      projectBars,
      projectMax,
      projectTicks,
      statusSlices: hasStatusData ? statusSlices : [{ label: 'No Data', value: 1, color: '#e5e7eb' }],
      hasStatusData,
      hasBothStatusBuckets: openCount > 0 && closedCount > 0,
    };
  }, [filteredIssueRows]);

  const loadIssueRows = async () => {
    setIssuesLoading(true);
    try {
      const res = await New_issuesService.getAll({ top: 1000, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load issues');
      setIssueRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
    } catch (error) {
      setProjectDashToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load issues' });
      setIssueRows([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  const deleteIssue = async (id: string) => {
    if (!id) return;
    try {
      await New_issuesService.delete(id);
      setProjectDashToast({ type: 'success', message: 'Issue deleted successfully.' });
      void loadIssueRows();
    } catch (error) {
      setProjectDashToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to delete issue' });
    }
  };

  const confirmDeleteIssue = async () => {
    if (!issueDeleteCandidate?.id) return;
    setDeletingIssue(true);
    try {
      await deleteIssue(issueDeleteCandidate.id);
      setIssueDeleteCandidate(null);
    } finally {
      setDeletingIssue(false);
    }
  };

  useEffect(() => {
    if (activeNav !== 'Issues' || showAddIssueForm) return;
    void loadIssueRows();
  }, [activeNav, showAddIssueForm, issueRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    if (activeNav !== 'Issues') return () => { cancelled = true; };
    (async () => {
      try {
        const res = await New_projectsService.getAll({ top: 1000, orderBy: ['createdon desc'] });
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to load projects');
        if (cancelled) return;
        const projects = Array.from(
          new Set(((res.data ?? []) as unknown as Array<Record<string, unknown>>).map(readProjectName).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));
        setIssueProjectOptions(projects);
      } catch {
        if (!cancelled) setIssueProjectOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== 'Tasks') return;
    let cancelled = false;
    (async () => {
      setProjectBoardTasksLoading(true);
      try {
        const res = await New_tasksService.getAll({ top: 2000, orderBy: ['modifiedon desc'] });
        if (cancelled) return;
        if (res.success) {
          setProjectBoardTasks((res.data ?? []) as unknown as Array<Record<string, unknown>>);
        } else {
          setProjectBoardTasks([]);
        }
      } catch {
        if (!cancelled) setProjectBoardTasks([]);
      } finally {
        if (!cancelled) setProjectBoardTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav, taskListRefresh]);

  useEffect(() => {
    if (activeNav !== 'Meetings') return;
    void loadProjectMeetings();
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== 'Dashboard' && activeNav !== 'Team Management') return;
    let cancelled = false;
    (async () => {
      setDashboardProjectsLoading(true);
      try {
        const [
          projectsRes,
          tasksRes,
          deliverablesRes,
          issuesRes,
          meetingsRes,
          teamRes,
        ] = await Promise.all([
          New_projectsService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
          New_tasksService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_deliverablesService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_issuesService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_meetingdetailsService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_teammembersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;
        if (!projectsRes.success) throw new Error(projectsRes.error?.message ?? 'Failed to load projects');
        setDashboardProjects((projectsRes.data ?? []) as unknown as Array<Record<string, unknown>>);
        setDashboardTasks(tasksRes.success ? ((tasksRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setDashboardDeliverables(
          deliverablesRes.success ? ((deliverablesRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [],
        );
        setDashboardIssues(issuesRes.success ? ((issuesRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setDashboardMeetings(meetingsRes.success ? ((meetingsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
        setDashboardTeamMembers(teamRes.success ? ((teamRes.data ?? []) as unknown as Array<Record<string, unknown>>) : []);
      } catch (error) {
        if (!cancelled) {
          setDashboardProjects([]);
          setDashboardTasks([]);
          setDashboardDeliverables([]);
          setDashboardIssues([]);
          setDashboardMeetings([]);
          setDashboardTeamMembers([]);
          setProjectDashToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load dashboard data' });
        }
      } finally {
        if (!cancelled) setDashboardProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  const requestDeleteProjectTask = (row: Record<string, unknown>) => {
    if (!String(row.new_taskid ?? '').trim()) return;
    setProjectTaskDeleteCandidate(row);
  };

  const confirmDeleteProjectTask = async () => {
    const row = projectTaskDeleteCandidate;
    if (!row) return;
    const id = String(row.new_taskid ?? '').trim();
    if (!id) {
      setProjectTaskDeleteCandidate(null);
      return;
    }
    setDeletingProjectTask(true);
    try {
      await New_tasksService.delete(id);
      setTaskListRefresh((k) => k + 1);
      setProjectDashToast({ type: 'success', message: 'Task deleted.' });
      setProjectTaskDeleteCandidate(null);
    } catch (e) {
      setProjectDashToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to delete task' });
    } finally {
      setDeletingProjectTask(false);
    }
  };

  const loadProjectMeetings = async () => {
    setProjectMeetingsLoading(true);
    try {
      const res = await New_meetingdetailsService.getAll({ top: 2000, orderBy: ['new_meetingdate desc', 'createdon desc'] });
      if (!res.success) {
        setDashboardMeetings([]);
      } else {
        const sessionEmail = (getSessionUserEmail() ?? '').trim().toLowerCase();
        const local = sessionEmail.split('@')[0] ?? '';
        const rows = ((res.data ?? []) as unknown as Array<Record<string, unknown>>).filter((row) => {
          if (!sessionEmail) return true;
          const invited = String(row.new_invitememberemails ?? '').toLowerCase();
          return invited.includes(sessionEmail) || (local.length > 1 && invited.includes(local));
        });
        setDashboardMeetings(rows);
      }
    } catch {
      setDashboardMeetings([]);
    } finally {
      setProjectMeetingsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tm, pr, ts] = await Promise.all([
          New_teammembersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_projectsService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
          New_tasksService.getAll({ top: 2000, orderBy: ['modifiedon desc'] }),
        ]);
        if (cancelled) return;
        setProjectInboxData({
          team: tm.success ? ((tm.data ?? []) as unknown as Array<Record<string, unknown>>) : [],
          projects: pr.success ? ((pr.data ?? []) as unknown as Array<Record<string, unknown>>) : [],
          tasks: ts.success ? ((ts.data ?? []) as unknown as Array<Record<string, unknown>>) : [],
        });
      } catch {
        if (!cancelled) setProjectInboxData({ team: [], projects: [], tasks: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskListRefresh]);

  const projectNotifications = useMemo(() => {
    if (!projectInboxData) return [];
    const scoped = new Set(
      (projectInboxData.projects ?? [])
        .map((r) => String(r.new_projectname ?? r.new_name ?? '').trim())
        .filter(Boolean),
    );
    return buildInboxNotifications('project', {
      teamMembers: projectInboxData.team,
      projects: projectInboxData.projects,
      tasks: projectInboxData.tasks,
      scopedProjectNames: scoped,
    });
  }, [projectInboxData]);

  const projectTaskDueDateOptions = useMemo(() => {
    const ymds = new Set<string>();
    for (const r of projectBoardTasks) {
      const y = projectTaskEndDateYmd(r);
      if (y) ymds.add(y);
    }
    return ['All', ...Array.from(ymds).sort((a, b) => a.localeCompare(b))];
  }, [projectBoardTasks]);

  const projectTaskAssignOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of projectBoardTasks) {
      const a = String(r.new_assigntoteammember ?? '').trim();
      if (a) set.add(a);
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, [projectBoardTasks]);

  const projectTaskProjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of projectBoardTasks) {
      const p = projectTaskProjectNameLabel(r);
      if (p) set.add(p);
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, [projectBoardTasks]);

  const projectBoardTasksFiltered = useMemo(() => {
    let list = projectBoardTasks;
    if (projectTaskFilterProject !== 'All') {
      list = list.filter((r) => projectTaskProjectNameLabel(r) === projectTaskFilterProject);
    }
    if (projectTaskFilterAssign !== 'All') {
      list = list.filter(
        (r) => String(r.new_assigntoteammember ?? '').trim().toLowerCase() === projectTaskFilterAssign.toLowerCase(),
      );
    }
    if (projectTaskFilterDue !== 'All') {
      list = list.filter((r) => projectTaskEndDateYmd(r) === projectTaskFilterDue);
    }
    if (projectTaskFilterStatus !== 'All') {
      const want: 'todo' | 'inprogress' | 'delayed' | 'done' =
        projectTaskFilterStatus === 'Future Tasks'
          ? 'todo'
          : projectTaskFilterStatus === 'In Progress'
            ? 'inprogress'
            : projectTaskFilterStatus === 'Delayed'
              ? 'delayed'
              : 'done';
      list = list.filter((r) => taskStatusBucket(r) === want);
    }
    return list;
  }, [projectBoardTasks, projectTaskFilterProject, projectTaskFilterAssign, projectTaskFilterDue, projectTaskFilterStatus]);

  useEffect(() => {
    if (activeNav !== 'Tasks') return;
    if (projectTaskFilterProject !== 'All' && !projectTaskProjectOptions.includes(projectTaskFilterProject)) {
      setProjectTaskFilterProject('All');
    }
  }, [activeNav, projectTaskProjectOptions, projectTaskFilterProject]);

  useEffect(() => {
    if (activeNav !== 'Tasks') return;
    if (projectTaskFilterAssign !== 'All' && !projectTaskAssignOptions.includes(projectTaskFilterAssign)) {
      setProjectTaskFilterAssign('All');
    }
  }, [activeNav, projectTaskAssignOptions, projectTaskFilterAssign]);

  useEffect(() => {
    if (activeNav !== 'Tasks') return;
    if (projectTaskFilterDue !== 'All' && !projectTaskDueDateOptions.includes(projectTaskFilterDue)) {
      setProjectTaskFilterDue('All');
    }
  }, [activeNav, projectTaskDueDateOptions, projectTaskFilterDue]);

  const showTaskFormPanel = showAddTaskForm || editingTaskRow != null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="z-[60] w-52 bg-white border-r border-gray-100 flex min-h-0 flex-col flex-shrink-0 pb-8">
        <div className="h-14 border-b border-gray-100 px-4 flex items-center gap-3">
          <LogoMark />
          <span className="text-base sm:text-lg font-bold tracking-wide text-[#232360]">ENJAZ</span>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ name, icon }) => (
            <div key={name}>
              <button
                type="button"
                onClick={() => {
                  setActiveNav(name);
                  if (name !== 'Team Management') {
                    setTeamTab('Workload');
                    setShowAddTeamMemberForm(false);
                  }
                  if (name !== 'Tasks') {
                    setShowAddTaskForm(false);
                    setEditingTaskRow(null);
                    setProjectTaskDetailRow(null);
                    setProjectTaskFilterDue('All');
                    setProjectTaskFilterAssign('All');
                    setProjectTaskFilterProject('All');
                    setProjectTaskFilterStatus('All');
                  }
                  if (name !== 'Meetings') setShowAddMeetingForm(false);
                  if (name !== 'Deliverables') setShowAddDeliverableForm(false);
                  if (name !== 'Issues') {
                    setShowAddIssueForm(false);
                    setShowProjectIssueDetails(false);
                    setProjectIssueDetailRow(null);
                    setShowProjectSubIssueForm(false);
                    setProjectSubIssueFromDetail(false);
                  }
                }}
                className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeNav === name ? 'text-[#A08149] font-semibold' : 'text-[#344054] hover:bg-gray-50 hover:text-[#344054]'
                }`}
              >
                {activeNav === name && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#A08149]" />
                )}
                <span className="flex min-w-0 items-center gap-3 text-left">
                  {icon}
                  <span className="truncate whitespace-nowrap">{name}</span>
                </span>
                {name === 'Team Management' && <ChevronDown size={12} className={`shrink-0 ${activeNav === 'Team Management' ? 'text-[#A08149]' : 'text-gray-400'}`} />}
              </button>
              {name === 'Team Management' && activeNav === 'Team Management' && (
                <div className="ml-9 mt-1 space-y-1">
                  {teamTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTeamTab(tab)}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-md ${
                        teamTab === tab ? 'text-primary font-semibold bg-white border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <ThemeModeToggle />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell items={projectNotifications} />
            <ProfileDropdown onLogout={onLogout} roleLabel="Project" />
          </div>
        </header>

        <main
          className={`enj-app-main flex-1 min-h-0 min-w-0 flex flex-col ${
            activeNav === 'Projects' || (activeNav === 'Tasks' && !showTaskFormPanel && !projectTaskDetailRow) || (activeNav === 'Dashboard' && showAllProjectsScreen)
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          }`}
        >
          {projectDashToast && (
            <div className="shrink-0">
              <NotificationToast
                type={projectDashToast.type}
                message={projectDashToast.message}
                onClose={() => setProjectDashToast(null)}
              />
            </div>
          )}
          <div
            className={
              activeNav === 'Projects' || (activeNav === 'Tasks' && !showTaskFormPanel && !projectTaskDetailRow) || (activeNav === 'Dashboard' && showAllProjectsScreen)
                ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-0'
                : 'space-y-4'
            }
          >
          {issueDeleteCandidate && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                <h3 className="enj-screen-subheader">Delete issue?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete
                  {' '}
                  <span className="font-semibold text-gray-800">{issueDeleteCandidate.title || 'this issue'}</span>
                  ?
                </p>
                <p className="mt-1 text-xs text-rose-600">This action cannot be undone.</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="h-9 px-4 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    onClick={() => setIssueDeleteCandidate(null)}
                    disabled={deletingIssue}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-md bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    onClick={() => void confirmDeleteIssue()}
                    disabled={deletingIssue}
                  >
                    {deletingIssue ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {projectTaskDeleteCandidate && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                <h3 className="enj-screen-subheader">Delete task?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete
                  {' '}
                  <span className="font-semibold text-gray-800">
                    {String(projectTaskDeleteCandidate.new_tasktitle ?? 'this task').trim() || 'this task'}
                  </span>
                  ?
                </p>
                <p className="mt-1 text-xs text-rose-600">This action cannot be undone.</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="h-9 px-4 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    onClick={() => setProjectTaskDeleteCandidate(null)}
                    disabled={deletingProjectTask}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-md bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    onClick={() => void confirmDeleteProjectTask()}
                    disabled={deletingProjectTask}
                  >
                    {deletingProjectTask ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeNav === 'Tasks' ? (
            <section className={`${enj.screenContainer} min-w-0 flex min-h-0 flex-1 flex-col overflow-hidden`}>
              {showTaskFormPanel ? (
                <div className="min-h-0 max-h-[min(calc(100dvh-7rem),48rem)] overflow-y-auto">
                  <AddNewTaskFormPanel
                    editingTask={editingTaskRow}
                    onClose={() => {
                      setShowAddTaskForm(false);
                      setEditingTaskRow(null);
                    }}
                    onNotify={(type, message) => setProjectDashToast({ type, message })}
                    onSaved={() => setTaskListRefresh((k) => k + 1)}
                  />
                </div>
              ) : showProjectSubTaskForm && projectTaskDetailRow ? (
                <TeamSubTaskFormPanel
                  parentTask={projectTaskDetailRow}
                  onBack={() => {
                    setShowProjectSubTaskForm(false);
                    if (projectSubTaskFromDetail) {
                      setProjectTaskDetailRow(projectTaskDetailRow);
                    } else {
                      setProjectTaskDetailRow(null);
                    }
                    setProjectSubTaskFromDetail(false);
                  }}
                  onRefresh={() => { setTaskListRefresh((k) => k + 1); }}
                  onNotify={(type, message) => {
                    setProjectDashToast({ type, message });
                  }}
                  onSaved={() => {
                    setTaskListRefresh((k) => k + 1);
                  }}
                />
              ) : projectTaskDetailRow ? (
                <div className="min-h-0 w-full min-w-0 max-h-[min(calc(100dvh-7rem),56rem)] flex-1 overflow-y-auto pr-0.5">
                  <ProjectTaskDetailView
                    task={projectTaskDetailRow}
                    onBack={() => {
                      setProjectTaskDetailRow(null);
                      setProjectSubTaskFromDetail(false);
                    }}
                    onTaskRefreshed={setProjectTaskDetailRow}
                    onListRefresh={() => setTaskListRefresh((k) => k + 1)}
                    onNotify={(type, message) => setProjectDashToast({ type, message })}
                  />
                </div>
              ) : (
                <div className="relative min-w-0 flex w-full flex-col">
                  {projectBoardTasksLoading && <ScreenLoader overlay className="rounded-xl" />}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="enj-screen-header">Tasks List</h2>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Due date</span>
                        <select
                          className={`${enj.control} !w-auto min-w-[8.5rem] max-w-[11rem] text-sm text-gray-700`}
                          value={projectTaskFilterDue}
                          onChange={(e) => setProjectTaskFilterDue(e.target.value)}
                        >
                          {projectTaskDueDateOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt === 'All' ? 'All' : formatYmdToDdMmYyyy(opt)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Assign to</span>
                        <select
                          className={`${enj.control} !w-auto min-w-[7rem] max-w-[12rem] text-sm text-gray-700`}
                          value={projectTaskFilterAssign}
                          onChange={(e) => setProjectTaskFilterAssign(e.target.value)}
                        >
                          {projectTaskAssignOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt === 'All' ? 'All' : opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Project</span>
                        <select
                          className={`${enj.control} !w-auto min-w-[7rem] max-w-[12rem] text-sm text-gray-700`}
                          value={projectTaskFilterProject}
                          onChange={(e) => setProjectTaskFilterProject(e.target.value)}
                        >
                          {projectTaskProjectOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Status</span>
                        <select
                          className={`${enj.control} !w-auto min-w-[8.5rem] max-w-[11rem] text-sm text-gray-700`}
                          value={projectTaskFilterStatus}
                          onChange={(e) => setProjectTaskFilterStatus(e.target.value)}
                        >
                          {PROJECT_TASK_STATUS_FILTER_LABELS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddTaskForm(true);
                        setEditingTaskRow(null);
                        setProjectTaskDetailRow(null);
                      }}
                      className={`${enj.btn} ${enj.btnPrimary} text-xs font-semibold shadow-sm hover:bg-[#9a7638]`}
                    >
                      + New Task
                    </button>
                  </div>
                  <div className="w-full min-w-0 shrink-0">
                    <TasksScreenBoard
                      variant="project"
                      tasks={projectBoardTasksFiltered}
                      onTaskOpen={(row) => {
                        setProjectTaskDetailRow(row as Record<string, unknown>);
                        setShowAddTaskForm(false);
                        setEditingTaskRow(null);
                      }}
                      onTaskEdit={(row) => {
                        setProjectTaskDetailRow(null);
                        setEditingTaskRow(row as Record<string, unknown>);
                        setShowAddTaskForm(false);
                      }}
                      onTaskDelete={requestDeleteProjectTask}
                    />
                  </div>
                </div>
              )}
            </section>
          ) : activeNav === 'Meetings' ? (
            <section className={enj.screenContainer}>
              {showAddMeetingForm ? (
                <AddMeetingFormPanel
                  parentLabel="Meetings"
                  onCancel={() => setShowAddMeetingForm(false)}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  onCreated={() => void loadProjectMeetings()}
                />
              ) : (
                <MeetingsBoardPanel
                  meetings={dashboardMeetings}
                  loading={projectMeetingsLoading}
                  onNewMeeting={() => setShowAddMeetingForm(true)}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                />
              )}
            </section>
          ) : activeNav === 'Deliverables' ? (
            <>
              {showAddDeliverableForm ? (
                <AddDeliverableFormPanel
                  onClose={() => setShowAddDeliverableForm(false)}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  onSaved={() => setDeliverableListRefresh((k) => k + 1)}
                  sectionClassName="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto w-full"
                />
              ) : (
                <DeliverablesListPanel
                  isActive={activeNav === 'Deliverables' && !showAddDeliverableForm}
                  refreshKey={deliverableListRefresh}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  variant="project"
                  onNewDeliverable={() => setShowAddDeliverableForm(true)}
                />
              )}
            </>
          ) : activeNav === 'Issues' ? (
            <section className={`relative min-w-0 max-w-full ${enj.screenContainer}`}>
              {!showAddIssueForm &&
                !showProjectIssueDetails &&
                !showProjectSubIssueForm &&
                issuesLoading && <ScreenLoader overlay />}
              {showProjectSubIssueForm && projectIssueDetailRow ? (
                <TeamSubIssueFormPanel
                  parentIssue={projectIssueDetailRow}
                  onBack={() => {
                    setShowProjectSubIssueForm(false);
                    if (projectSubIssueFromDetail) {
                      setShowProjectIssueDetails(true);
                    } else {
                      setProjectIssueDetailRow(null);
                    }
                    setProjectSubIssueFromDetail(false);
                  }}
                  onRefresh={() => {
                    setIssueRefreshKey((k) => k + 1);
                  }}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  onSaved={() => {
                    setIssueRefreshKey((k) => k + 1);
                  }}
                />
              ) : showProjectIssueDetails && projectIssueDetailRow ? (
                <TeamIssueDetailPanel
                  issue={projectIssueDetailRow}
                  onBack={() => {
                    setShowProjectIssueDetails(false);
                    setProjectIssueDetailRow(null);
                  }}
                  onRefreshWorkspace={() => {
                    setIssueRefreshKey((k) => k + 1);
                  }}
                  onOpenSubIssue={() => {
                    setProjectSubIssueFromDetail(true);
                    setShowProjectSubIssueForm(true);
                  }}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  onIssueUpdated={(row) => {
                    setProjectIssueDetailRow(row);
                    setIssueRefreshKey((k) => k + 1);
                  }}
                />
              ) : showAddIssueForm ? (
                <AddIssueFormPanel
                  onClose={() => {
                    setShowAddIssueForm(false);
                    setEditingIssue(null);
                  }}
                  onNotify={(type, message) => setProjectDashToast({ type, message })}
                  onSaved={() => setIssueRefreshKey((k) => k + 1)}
                  issueToEdit={editingIssue}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="enj-screen-header">Issue Tracking Dashboard</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIssue(null);
                        setShowAddIssueForm(true);
                        setShowProjectIssueDetails(false);
                        setProjectIssueDetailRow(null);
                        setShowProjectSubIssueForm(false);
                        setProjectSubIssueFromDetail(false);
                      }}
                      className={`${enj.btn} ${enj.btnPrimary} text-xs font-semibold`}
                    >
                      + Create Issue
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <label className="block">
                      <span className="text-xs text-primary mb-1 block">Project</span>
                      <select className={enj.control} value={issueProjectFilter} onChange={(e) => setIssueProjectFilter(e.target.value)}>
                        <option value="All">All</option>
                        {issueFilterOptions.projects.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-primary mb-1 block">Issue Owner</span>
                      <select className={enj.control} value={issueOwnerFilter} onChange={(e) => setIssueOwnerFilter(e.target.value)}>
                        <option value="All">All</option>
                        {issueFilterOptions.owners.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-primary mb-1 block">Severity</span>
                      <select className={enj.control} value={issueSeverityFilter} onChange={(e) => setIssueSeverityFilter(e.target.value)}>
                        <option value="All">All</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-primary mb-1 block">Date</span>
                      <input type="date" className={enj.control} value={issueDateFilter} onChange={(e) => setIssueDateFilter(e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-primary mb-1 block">Status</span>
                      <select className={enj.control} value={issueStatusFilter} onChange={(e) => setIssueStatusFilter(e.target.value)}>
                        <option value="All">All</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {[
                      ['Total Issues', String(issueCharts.total), 'border-[#d4a759]'],
                      ['Open Issues', String(issueCharts.openCount), 'border-[#ef4444]'],
                      ['Closed Issues', String(issueCharts.closedCount), 'border-[#2563eb]'],
                    ].map(([label, value, border]) => (
                      <div key={String(label)} className={`bg-white rounded-xl border-2 ${border} p-3 text-center`}>
                        <p className="text-[11px] text-gray-500">{label}</p>
                        <p className="text-4xl font-bold text-primary mt-1">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <DonutChartCard
                      title="Issues Severity"
                      subtitle="Live distribution of High, Medium, and Low issues"
                      ringWidth={32}
                      chartSize="sm"
                      centerText={String(issueCharts.total)}
                      centerSubtext="Total"
                      slices={issueCharts.severitySlices}
                    />

                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Issues vs Projects</h3>
                      <p className="text-[10px] text-gray-500 mb-2">Top projects by number of issues</p>
                      <svg viewBox="0 0 220 140" className="w-full h-40 chart-svg">
                        {issueCharts.projectTicks.map((v) => (
                          <g key={v}>
                            <line x1="24" x2="210" y1={108 - ((v / issueCharts.projectMax) * 80)} y2={108 - ((v / issueCharts.projectMax) * 80)} stroke="#eef2f7" />
                            <text x="6" y={111 - ((v / issueCharts.projectMax) * 80)} fontSize="7" fill="#9ca3af">{v}</text>
                          </g>
                        ))}
                        {issueCharts.projectBars.map((item, i) => {
                          const scaledHeight = (item.value / issueCharts.projectMax) * 80;
                          return (
                            <g key={item.name}>
                              <rect x={34 + i * 34} y={108 - scaledHeight} width="12" height={scaledHeight} rx="3" className="chart-bar" fill={item.color} />
                              <text x={40 + i * 34} y="126" textAnchor="middle" fontSize="7.5" fill="#9ca3af" transform={`rotate(-60 ${40 + i * 34} 126)`}>
                                {item.shortName}
                              </text>
                              <text x={40 + i * 34} y={102 - scaledHeight} textAnchor="middle" fontSize="8.5" fill="#6b7280">{item.value}</text>
                            </g>
                          );
                        })}
                        {issueCharts.projectBars.length === 0 && (
                          <text x="110" y="72" textAnchor="middle" fontSize="9" fill="#9ca3af">
                            No issue data
                          </text>
                        )}
                      </svg>
                    </div>

                    <DonutChartCard
                      title="Issue Status Overview"
                      subtitle="Open vs Closed issues"
                      ringWidth={32}
                      chartSize="sm"
                      centerText={String(issueCharts.total)}
                      centerSubtext="Issues"
                      slices={issueCharts.statusSlices}
                    />
                  </div>

                  <section className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm">
                    <div className="w-full min-w-0">
                      <table className={`${enj.table} w-full min-w-0 table-fixed text-left`}>
                        <colgroup>
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '5%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '7%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '7%' }} />
                          <col style={{ width: '4%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '7%' }} />
                        </colgroup>
                        <thead className="bg-[#F0F2F5]">
                          <tr className="text-[10px] text-gray-600 sm:text-[11px]">
                            <th className="px-2 py-3 font-semibold tracking-tight first:pl-3 sm:px-2.5 sm:pl-4">Issue Title</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Severity</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Project Name</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Issue Owner</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Assigned To</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Issue Description</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Issue Response</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Impacted Areas</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Progress</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Status</th>
                            <th className="px-2 py-3 font-semibold tracking-tight sm:px-2.5">Issue Date</th>
                            <th className="px-2 py-3 text-center font-semibold tracking-tight sm:px-2.5 last:pr-3 sm:pr-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {issuesLoading ? (
                            <tr>
                              <td colSpan={12} className="px-5 py-10 text-sm text-gray-500 text-center">
                                Loading issues...
                              </td>
                            </tr>
                          ) : filteredIssueRows.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-5 py-10 text-sm text-gray-500 text-center">
                                No issues found for the selected filters.
                              </td>
                            </tr>
                          ) : (
                            filteredIssueRows.map((row) => {
                              const id = String(row.new_issueid ?? '');
                              const statusText = issueStatusLabel(row);
                              const statusUp = statusText.toUpperCase();
                              const isResolvedStatus =
                                statusUp.includes('SOLVED') || statusUp.includes('RESOLVED') || statusUp.includes('CLOSED');
                              return (
                                <tr
                                  key={id || String(row.new_issuetitle ?? Math.random())}
                                  className="border-b border-gray-200/90 text-[11px] text-gray-800 last:border-b-0 sm:text-[12px]"
                                >
                                  <td className="min-w-0 overflow-wrap-anywhere px-2 py-2.5 align-top first:pl-3 sm:px-2.5 sm:pl-4">
                                    <button
                                      type="button"
                                      className="w-full min-w-0 break-words text-left text-blue-600 underline decoration-blue-500/50 underline-offset-2 hover:text-blue-800"
                                      onClick={() => {
                                        setProjectIssueDetailRow(row);
                                        setShowProjectIssueDetails(true);
                                        setShowAddIssueForm(false);
                                        setEditingIssue(null);
                                        setShowProjectSubIssueForm(false);
                                        setProjectSubIssueFromDetail(false);
                                      }}
                                    >
                                      {String(row.new_issuetitle ?? '—')}
                                    </button>
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5">
                                    {issueSeverityLabel(row)}
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5" title={String(row.new_projectname ?? '')}>
                                    <span className="line-clamp-3">{String(row.new_projectname ?? '—')}</span>
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5">
                                    {String(row.new_issueowner ?? '—')}
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5" title={String(row.new_assigntoteammember ?? '')}>
                                    {String(row.new_assigntoteammember ?? '—')}
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5" title={String(row.new_description ?? '')}>
                                    <span className="line-clamp-3">{String(row.new_description ?? '—')}</span>
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5" title={String(row.new_issueresponse ?? '')}>
                                    <span className="line-clamp-2">{String(row.new_issueresponse ?? '—')}</span>
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-800 sm:px-2.5" title={String(row.new_issueimpactedarea ?? '')}>
                                    <span className="line-clamp-2">{String(row.new_issueimpactedarea ?? '—')}</span>
                                  </td>
                                  <td className="min-w-0 px-2 py-2.5 align-top tabular-nums text-gray-800 sm:px-2.5">
                                    {String(row.new_progress ?? '0')}
                                  </td>
                                  <td className="min-w-0 break-words px-2 py-2.5 align-top font-medium text-gray-800 sm:px-2.5">
                                    {statusText}
                                  </td>
                                  <td className="min-w-0 px-2 py-2.5 align-top text-gray-800 sm:px-2.5">
                                    <div className="w-full min-w-0 text-[9px] leading-tight sm:text-[10px] sm:leading-snug">
                                      <div className="grid w-full min-w-0 grid-cols-2 gap-1 sm:gap-0">
                                        <div className="min-w-0 pr-1 sm:pr-1.5">
                                          <p className="text-[9px] font-semibold text-gray-600 sm:text-[10px]">Date Raised</p>
                                          <p className="mt-0.5 flex min-w-0 items-start gap-0.5 text-gray-700 sm:gap-1">
                                            <Calendar className="mt-0.5 h-3 w-3 shrink-0 text-gray-500" strokeWidth={2} />
                                            <span className="min-w-0 break-words tabular-nums">
                                              {issueTableDate(row.new_issuedate ?? row.createdon)}
                                            </span>
                                          </p>
                                        </div>
                                        <div className="min-w-0 border-l border-dotted border-gray-300 pl-1.5 sm:pl-2">
                                          <p className="text-[9px] font-semibold text-gray-600 sm:text-[10px]">Date Resolved</p>
                                          <p className="mt-0.5 flex min-h-[1.1rem] min-w-0 items-start gap-0.5 sm:gap-1">
                                            <Calendar
                                              className={`mt-0.5 h-3 w-3 shrink-0 ${isResolvedStatus ? 'text-gray-500' : 'text-gray-300'}`}
                                              strokeWidth={2}
                                            />
                                            <span className="min-w-0 break-words tabular-nums text-gray-600">
                                              {isResolvedStatus ? issueTableDate(row.modifiedon) : '—'}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2.5 align-top text-center last:pr-3 sm:px-2.5 sm:pr-4">
                                    <div className="inline-flex items-center justify-center gap-3 text-gray-500">
                                      <button
                                        type="button"
                                        className="rounded p-0.5 hover:bg-gray-100 hover:text-gray-800"
                                        title="Edit"
                                        onClick={() => {
                                          setShowProjectIssueDetails(false);
                                          setProjectIssueDetailRow(null);
                                          setShowProjectSubIssueForm(false);
                                          setProjectSubIssueFromDetail(false);
                                          setEditingIssue(row);
                                          setShowAddIssueForm(true);
                                        }}
                                      >
                                        <Pencil size={16} strokeWidth={1.75} className="text-gray-600" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded p-0.5 hover:bg-rose-50 hover:text-rose-600"
                                        title="Delete"
                                        onClick={() => {
                                          if (!id) return;
                                          setIssueDeleteCandidate({
                                            id,
                                            title: String(row.new_issuetitle ?? 'this issue'),
                                          });
                                        }}
                                      >
                                        <Trash2 size={16} strokeWidth={1.75} className="text-gray-500" />
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
                  </section>
                </>
              )}
            </section>
          ) : activeNav === 'Team Management' ? (
            <section className={enj.screenContainer}>
              {showAddTeamMemberForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddTeamMemberForm(false)}>Team Member</button>
                    {' > '}Add New Team Member
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-4">
                    {[
                      ['Full Name', 'Enter First Name'],
                      ['Specialize', 'Select Specialize'],
                      ['Project Category', 'Select Project Category'],
                      ['Project Name', 'Select Project Name'],
                      ['KPI', 'Enter KPI'],
                      ['Score', 'Select score rate'],
                    ].map(([label, placeholder], i) => (
                      <label key={label} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{label}</span>
                        {i % 2 === 1 || label.includes('Category') || label === 'Project Name' || label === 'Score' ? (
                          <select className={`${enj.control} text-xs text-gray-500`}>
                            <option>{placeholder}</option>
                          </select>
                        ) : (
                          <input className={`${enj.control} text-xs text-gray-600`} placeholder={placeholder} />
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">Photo</p>
                      <button className="w-full h-20 rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">Resume</p>
                      <button className="w-full h-20 rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddTeamMemberForm(false)}
                      className={`${enj.btn} ${enj.btnOutline} px-7 text-xs font-semibold`}
                    >
                      Cancel
                    </button>
                    <button type="button" className={`${enj.btn} ${enj.btnPrimary} px-7 text-xs font-semibold`}>+ Save</button>
                  </div>
                </section>
              ) : (
                <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="enj-screen-header">Team Management Dashboard</h2>
                <button
                  type="button"
                  onClick={() => setShowAddTeamMemberForm(true)}
                  className={`${enj.btn} ${enj.btnPrimary} px-3 text-xs font-semibold`}
                >
                  + Add New Member
                </button>
              </div>

              <section className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-primary">{teamTab === 'Evaluation' ? 'Team Evaluation' : 'Team Workload'}</h3>
                      <button className="text-[10px] text-gray-400">{teamTab === 'Workload' ? 'Day/week/months' : teamTab}</button>
                    </div>
                    {teamTab === 'Performance' ? (
                      <svg viewBox="0 0 640 240" className="w-full h-44 chart-svg">
                        {[0, 2, 4, 6, 8, 10].map((v) => (
                          <g key={v}>
                            <line x1="40" y1={194 - v * 16} x2="622" y2={194 - v * 16} stroke="#ecedf2" />
                            <text x="28" y={197 - v * 16} fontSize="9" fill="#a1a1aa">0.{v}</text>
                          </g>
                        ))}
                        {projectDashboardTrends.labels.map((m, i) => (
                          <text key={m} x={52 + i * 48} y="214" fontSize="8" fill="#9ca3af">{m}</text>
                        ))}
                        {teamPerformanceLines.hasData ? (
                          <>
                            <polyline
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2"
                              points={teamPerformanceLines.pointsA}
                            />
                            <polyline
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2"
                              points={teamPerformanceLines.pointsB}
                            />
                          </>
                        ) : (
                          <text x="320" y="120" textAnchor="middle" fontSize="9" fill="#9ca3af">No team task data for this range</text>
                        )}
                      </svg>
                    ) : (
                      <svg viewBox="0 0 640 240" className="w-full h-44 chart-svg">
                        {[0, 10, 20, 30, 40, 50].map((v) => (
                          <g key={v}>
                            <line x1="46" y1={190 - v * 3} x2="620" y2={190 - v * 3} stroke="#ecedf2" />
                            <text x="36" y={194 - v * 3} fontSize="9" fill="#a1a1aa">{v}</text>
                          </g>
                        ))}
                        {workloadBars.map((bar, wi) => {
                          const x = 56 + wi * 48;
                          const h = Math.min(150, (bar.value / teamChartMaxWorkload) * 150);
                          return (
                            <g key={bar.name}>
                              <rect x={x} y={190 - h} width="24" height={h || 0.5} rx="4" className="chart-bar" fill={bar.color} />
                              <text x={x + 12} y="210" fontSize="8" textAnchor="middle" fill="#6b7280" transform={`rotate(-90 ${x + 12} 210)`}>{bar.name}</text>
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                  <DonutChartCard
                    title={teamTab === 'Evaluation' ? 'Evaluation Category' : 'Utilization Category'}
                    ringWidth={32}
                    chartSize="sm"
                    slices={teamTab === 'Workload' ? teamManagementDonut.utilSlices
                      : teamTab === 'Performance' ? teamManagementDonut.perSlices
                        : teamManagementDonut.evSlices}
                  />
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                {teamTab === 'Performance' ? (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {performanceMembers.length === 0 && (
                        <p className="col-span-full text-center text-sm text-gray-500 py-8">No team members to display.</p>
                      )}
                      {pagedPerformanceMembers.map((member, idx) => (
                        <div key={member[0] + idx} className="border border-gray-100 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{member[0][0]}</div>
                              <div>
                                <p className="text-xs font-semibold text-primary">{member[0]}</p>
                                <p className="text-[9px] text-gray-400">{member[1]}</p>
                              </div>
                            </div>
                            <span className="text-gray-300">:</span>
                          </div>
                          <div className="space-y-1 text-[9px] text-gray-500">
                            <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Done on time</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Open and test</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Completed</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[9px] text-gray-400">
                            <span>{member[2]}</span>
                            <span>Completion rate</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200 mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full enj-progress-fill"
                              style={{ width: /^\d+%$/.test(member[2]) ? member[2] : '0%' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="py-4 flex items-center justify-center gap-2 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="w-2 h-2 rounded-full bg-secondary" />
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                    </div>
                    <div className="px-1">
                      <PagerBar
                        page={teamPerformancePage}
                        pageSize={TEAM_TAB_PAGE_SIZE}
                        total={performanceMembers.length}
                        onPrev={() => setTeamPerformancePage((p) => Math.max(1, p - 1))}
                        onNext={() =>
                          setTeamPerformancePage((p) =>
                            Math.min(Math.max(1, Math.ceil(performanceMembers.length / TEAM_TAB_PAGE_SIZE)), p + 1),
                          )}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <table className={`${enj.table} w-full`}>
                      <thead className="bg-gray-50 border-b border-gray-100">
                        {teamTab === 'Evaluation' ? (
                          <tr className="text-[11px] text-gray-400 text-left">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Project Name</th>
                            <th className="px-4 py-3">Specialize</th>
                            <th className="px-4 py-3">Evolution</th>
                            <th className="px-4 py-3">Last Activity</th>
                            <th className="px-4 py-3" />
                          </tr>
                        ) : (
                          <tr className="text-[11px] text-gray-400 text-left">
                            <th className="px-4 py-3">Active Team Member</th>
                            <th className="px-4 py-3">Productivity (Hrs/Days)</th>
                            <th className="px-4 py-3">Goal Productivity</th>
                            <th className="px-4 py-3">Total Assigned Tasks (Hrs)</th>
                            <th className="px-4 py-3">Worked days</th>
                            <th className="px-4 py-3">Member Capacity</th>
                            <th className="px-4 py-3">Utilization</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {teamTab === 'Evaluation'
                          ? (evaluationRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">No team members to display.</td>
                            </tr>
                            ) : pagedEvaluationRows.map((row, eri) => (
                              <tr key={`${row[0]}-${eri}`} className="border-b border-gray-100 text-xs text-gray-700">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{row[0][0]}</div>
                                    <span>{row[0]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-indigo-700 font-semibold">{row[1]}</td>
                                <td className="px-4 py-3 text-gray-500">{row[2]}</td>
                                <td className="px-4 py-3">{row[3]}</td>
                                <td className="px-4 py-3 text-gray-500">{row[4]}</td>
                                <td className="px-4 py-3 text-gray-400 text-lg leading-none">:</td>
                              </tr>
                            )))
                          : teamRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">No team members to display.</td>
                            </tr>
                            )
                          : pagedTeamRows.map((row, tri) => (
                              <tr key={`${row[0]}-${tri}`} className="border-b border-gray-100 text-xs text-gray-700">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{row[0][0]}</div>
                                    <span>{row[0]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                      <div
                                        className="h-full bg-blue-600 rounded-full max-w-full enj-progress-fill"
                                        style={{ width: `${Math.min(100, Math.max(0, Number(row[7])))}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-gray-400">{row[1]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">{row[2]}</td>
                                <td className="px-4 py-3">{row[3]}</td>
                                <td className="px-4 py-3">{row[4]}</td>
                                <td className="px-4 py-3">{row[5]}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                    row[6] === 'Low' ? 'bg-emerald-100 text-emerald-700'
                                      : row[6] === 'High' ? 'bg-rose-100 text-rose-700'
                                        : row[6] === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {row[6]}
                                  </span>
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3">
                      <PagerBar
                        page={teamTab === 'Evaluation' ? teamEvaluationPage : teamWorkloadPage}
                        pageSize={TEAM_TAB_PAGE_SIZE}
                        total={teamTab === 'Evaluation' ? evaluationRows.length : teamRows.length}
                        onPrev={() => {
                          if (teamTab === 'Evaluation') setTeamEvaluationPage((p) => Math.max(1, p - 1));
                          else setTeamWorkloadPage((p) => Math.max(1, p - 1));
                        }}
                        onNext={() => {
                          if (teamTab === 'Evaluation') {
                            const maxPage = Math.max(1, Math.ceil(evaluationRows.length / TEAM_TAB_PAGE_SIZE));
                            setTeamEvaluationPage((p) => Math.min(maxPage, p + 1));
                          } else {
                            const maxPage = Math.max(1, Math.ceil(teamRows.length / TEAM_TAB_PAGE_SIZE));
                            setTeamWorkloadPage((p) => Math.min(maxPage, p + 1));
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </section>
                </>
              )}
            </section>
          ) : activeNav === 'Projects' ? (
            <ProgramProjectsSection todayIso={todayIso} onToast={setProjectDashToast} />
          ) : activeNav === 'Dashboard' && showAllProjectsScreen ? (
            <section className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h3 className="text-base font-bold text-gray-900">All Projects</h3>
                <div className="flex items-center gap-3">
                  <input
                    value={projectSearchText}
                    onChange={(e) => setProjectSearchText(e.target.value)}
                    placeholder="Search project…"
                    className="h-7 w-48 rounded border border-gray-200 px-2 text-xs outline-none focus:border-secondary"
                  />
                  <select
                    value={projectStatusFilterValue}
                    onChange={(e) => setProjectStatusFilterValue(e.target.value)}
                    className="h-7 rounded border border-gray-200 px-2 text-xs text-gray-700 outline-none focus:border-secondary"
                  >
                    {allProjectStatusOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAllProjectsScreen(false)}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 h-7"
                  >
                    Back
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <table className={`${enj.table} w-full`}>
                  <thead className="bg-[#eaecf3] border-b border-gray-100">
                    <tr className="text-xs font-semibold text-[#6d7488] text-left">
                      <th className="px-3 py-1.5">Project Name</th>
                      <th className="px-3 py-1.5">Strategic Objective</th>
                      <th className="px-3 py-1.5">Project Sponsor</th>
                      <th className="px-3 py-1.5">Budget</th>
                      <th className="px-3 py-1.5">Category</th>
                      <th className="px-3 py-1.5">Start Date</th>
                      <th className="px-3 py-1.5">Progress Level</th>
                      <th className="px-3 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAllProjects.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">No matching projects found.</td>
                      </tr>
                    )}
                    {pagedAllProjects.map((row) => {
                      const name = String(row.new_projectname ?? row.new_name ?? 'Project').trim() || 'Project';
                      const status = projectStatusLabel(row);
                      const progress = projectProgressPct(row);
                      return (
                        <tr key={`screen-${String(row.new_projectid ?? row.createdon ?? name)}`} className="border-b border-[#ececf3] text-xs text-[#4c556d]">
                          <td className="px-3 py-1.5">{name}</td>
                          <td className="px-3 py-1.5">{projectObjectiveLabel(row)}</td>
                          <td className="px-3 py-1.5">{projectSponsorLabel(row)}</td>
                          <td className="px-3 py-1.5">{projectBudgetLabel(row)}</td>
                          <td className="px-3 py-1.5">{projectCategoryLabel(row)}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-[10px] text-[#40475d]">Start</p>
                                <p className="text-[10px] text-[#7b8193] flex items-center gap-0.5">
                                  <Calendar size={10} className="text-[#9aa1b4]" />
                                  {projectDateLabel(row.new_startdate)}
                                </p>
                              </div>
                              <div className="w-px h-6 bg-[#d9dbe5]" />
                              <div>
                                <p className="text-[10px] text-[#40475d]">End</p>
                                <p className="text-[10px] text-[#7b8193] flex items-center gap-0.5">
                                  <Calendar size={10} className="text-[#9aa1b4]" />
                                  {projectDateLabel(row.new_enddate)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="w-[120px]">
                              <p className="text-[10px] text-[#8c93a6] text-right mb-0.5">{progress}%</p>
                              <div className="enj-table-progress-track">
                                <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`enj-table-status ${projectStatusClass(status)}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PagerBar
                page={allProjectsPage}
                pageSize={ALL_PROJECTS_PAGE_SIZE}
                total={filteredAllProjects.length}
                onPrev={() => setAllProjectsPage((p) => Math.max(1, p - 1))}
                onNext={() => setAllProjectsPage((p) => Math.min(allProjectsTotalPages, p + 1))}
              />
            </section>
          ) : (
            <>
          <section className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="enj-dashboard-header mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
              {overview.map((item) => (
                <div key={item.label} className="rounded-xl border-2 bg-white px-4 py-4" style={{ borderColor: item.color }}>
                  <p className="text-sm text-gray-400 mb-3 leading-tight">{item.label}</p>
                  <p className="text-3xl font-extrabold text-primary">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* ── Actual VS Planned ── */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Budgeting</p>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900">Actual VS Planned</h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />Actual</span>
                    <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#2563eb]" />Planned</span>
                  </div>
                </div>
                {(() => {
                  const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                  const VW = 560, VH = 185;
                  const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                  const chartX = CL, chartY = CT, chartBottom = CT + chartH;
                  const { planned, actual, labels, deviation: _d, maxAbs: _m } = projectDashboardTrends;
                  const maxV = Math.max(1, ...planned, ...actual);
                  const tickStep = Math.max(1, Math.ceil(maxV / 5));
                  const niceMax = tickStep * 5;
                  const yTicks = [0, 1, 2, 3, 4, 5].map((t) => t * tickStep);
                  const yCoord = (v: number) => chartBottom - (v / niceMax) * chartH;
                  const slotW = chartW / 12;
                  const barW = Math.max(4, Math.min(10, slotW / 3));
                  const gap = 2;
                  const groupW = barW * 2 + gap;
                  const isEmpty = planned.every((p, i) => p === 0 && (actual[i] ?? 0) === 0);
                  return (
                    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                      {yTicks.map((tick) => {
                        const y = yCoord(tick);
                        return (
                          <g key={tick}>
                            <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
                            <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                          </g>
                        );
                      })}
                      {isEmpty && <text x={chartX + chartW / 2} y={chartY + chartH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No task data available</text>}
                      {labels.map((label, i) => {
                        const slotX = chartX + i * slotW + (slotW - groupW) / 2;
                        const aH = Math.max(1, ((actual[i] ?? 0) / niceMax) * chartH);
                        const pH = Math.max(1, ((planned[i] ?? 0) / niceMax) * chartH);
                        return (
                          <g key={label}>
                            <rect x={slotX} y={chartBottom - aH} width={barW} height={aH} fill="#ef4444" rx="1" className="chart-bar" />
                            <rect x={slotX + barW + gap} y={chartBottom - pH} width={barW} height={pH} fill="#2563eb" rx="1" className="chart-bar" />
                            <text x={slotX + groupW / 2} y={chartBottom + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{label.toUpperCase().slice(0, 3)}</text>
                          </g>
                        );
                      })}
                      <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                    </svg>
                  );
                })()}
              </div>

              {/* ── Deviation ── */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Budgeting</p>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Deviation</h3>
                {(() => {
                  const CL = 40, CR = 12, CT = 8, CB = 22, TL = 12;
                  const VW = 560, VH = 185;
                  const chartW = VW - CL - CR - TL, chartH = VH - CT - CB;
                  const chartX = CL, chartY = CT;
                  const { labels, deviation } = projectDashboardTrends;
                  const maxAbs = Math.max(1, ...deviation.map((x) => Math.abs(x)));
                  const absStep = Math.max(1, Math.ceil(maxAbs / 3));
                  const niceAbs = absStep * 3;
                  const midY = chartY + chartH / 2;
                  const halfH = chartH / 2;
                  const yTicks = [-3, -2, -1, 0, 1, 2, 3].map((t) => t * absStep);
                  const yCoord = (v: number) => midY - (v / niceAbs) * halfH;
                  const slotW = chartW / 12;
                  const barW = Math.max(4, Math.min(10, slotW / 2.5));
                  return (
                    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full chart-svg">
                      {yTicks.map((tick) => {
                        const y = yCoord(tick);
                        return (
                          <g key={tick}>
                            <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke={tick === 0 ? '#9ca3af' : '#e5e7eb'} strokeWidth={tick === 0 ? '1' : '0.6'} />
                            <text x={chartX - 4} y={y + 3} fontSize="8" fill="#9ca3af" textAnchor="end">{tick}</text>
                          </g>
                        );
                      })}
                      {labels.map((label, i) => {
                        const v = deviation[i] ?? 0;
                        const h = Math.max(1, (Math.abs(v) / niceAbs) * halfH);
                        const slotX = chartX + i * slotW + (slotW - barW) / 2;
                        return (
                          <g key={label}>
                            <rect x={slotX} y={v >= 0 ? yCoord(v) : midY} width={barW} height={h} fill={v >= 0 ? '#ef4444' : '#2563eb'} rx="1" className="chart-bar" />
                            <text x={slotX + barW / 2} y={chartY + chartH + 14} fontSize="7" fill="#9ca3af" textAnchor="middle">{label.toUpperCase().slice(0, 3)}</text>
                          </g>
                        );
                      })}
                      <text x={VW - 6} y={chartY + chartH / 2} fontSize="7" fill="#9ca3af" textAnchor="middle" transform={`rotate(90 ${VW - 6} ${chartY + chartH / 2})`}>TIMELINE</text>
                    </svg>
                  );
                })()}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="enj-dashboard-header">Insights</h2>
              <label className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="sr-only">Filter by project</span>
                <select
                  className={`${enj.control} !w-auto min-w-[8rem] text-sm font-medium text-gray-700`}
                  value={insightProjectFilter}
                  onChange={(e) => {
                    setInsightProjectFilter(e.target.value);
                  }}
                >
                  <option value="all">All Projects</option>
                  {insightProjectNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              {/* Projects progress bars */}
              <div className="flex h-[280px] flex-col rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-2 shrink-0 text-[11px] font-semibold text-gray-600">Projects</h3>
                <div className="flex flex-1 flex-col min-h-0">
                  {(() => {
                    const VW = 320, VH = 160;
                    const CL = 4, CR = 34, CT = 8, CB = 8;
                    const chartW = VW - CL - CR, chartH = VH - CT - CB;
                    const bars = projectInsights.progressBars;
                    const n = Math.max(1, bars.length);
                    const gap = 8;
                    const barH = Math.min(18, Math.floor((chartH - (n - 1) * gap) / n));
                    const totalH = n * barH + (n - 1) * gap;
                    const startY = CT + (chartH - totalH) / 2;
                    return (
                      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                        {bars.length === 0 && (
                          <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No data</text>
                        )}
                        {bars.map(({ label, value, fg, bg }, i) => {
                          const v = Math.max(0, Math.min(100, Number(value)));
                          const y = startY + i * (barH + gap);
                          const bw = (v / 100) * chartW;
                          const lbl = String(label).toUpperCase().slice(0, 14);
                          return (
                            <g key={String(label)}>
                              <rect x={CL} y={y} width={chartW} height={barH} fill={String(bg)} rx="3" />
                              {v > 0 && <rect x={CL} y={y} width={bw} height={barH} fill={String(fg)} rx="3" />}
                              {v >= 25
                                ? <text x={CL + 5} y={y + barH * 0.5 + 3} fontSize="8" fill="white" fontWeight="bold">{lbl}</text>
                                : <text x={CL + bw + 5} y={y + barH * 0.5 + 3} fontSize="8" fill="#9ca3af">{lbl}</text>
                              }
                              <text x={VW - CR + 2} y={y + barH * 0.5 + 3} fontSize="8" fill="#6b7280">{v}%</text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                  <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-1 shrink-0">
                    {projectInsights.progressBars.map(({ label, fg }) => (
                      <span key={String(label)} className="flex items-center gap-1 text-[8px] text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: String(fg) }} />
                        {String(label)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tasks vertical bars */}
              <div className="flex h-[280px] flex-col rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-2 shrink-0 text-[11px] font-semibold text-gray-600">Tasks</h3>
                <div className="flex flex-1 flex-col min-h-0">
                  {(() => {
                    const VW = 320, VH = 160;
                    const CL = 6, CR = 6, CT = 18, CB = 22;
                    const chartW = VW - CL - CR, chartH = VH - CT - CB;
                    const chartBottom = CT + chartH;
                    const bars = projectInsights.taskBars;
                    const n = Math.max(1, bars.length);
                    const slotW = chartW / n;
                    const barW = Math.max(12, Math.min(36, slotW * 0.5));
                    return (
                      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                        {bars.length === 0 && (
                          <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No data</text>
                        )}
                        {bars.map(({ label, value: rawV, fg, bg }, i) => {
                          const v = Math.max(0, Math.min(100, Number(rawV)));
                          const bh = Math.max(v > 0 ? 1 : 0, (v / 100) * chartH);
                          const slotX = CL + i * slotW;
                          const barX = slotX + (slotW - barW) / 2;
                          return (
                            <g key={String(label)}>
                              <rect x={barX} y={CT} width={barW} height={chartH} fill={String(bg)} rx="3" />
                              {v > 0 && <rect x={barX} y={chartBottom - bh} width={barW} height={bh} fill={String(fg)} rx="3" />}
                              <text x={barX + barW / 2} y={CT - 5} fontSize="8" fill="#6b7280" textAnchor="middle">{v}%</text>
                              <text x={barX + barW / 2} y={chartBottom + 14} fontSize="7.5" fill="#9ca3af" textAnchor="middle">{String(label).slice(0, 10)}</text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                  <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-1 shrink-0">
                    {projectInsights.taskBars.map(({ label, fg }) => (
                      <span key={String(label)} className="flex items-center gap-1 text-[8px] text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: String(fg) }} />
                        {String(label)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Projects Category donut */}
              <DonutChartCard
                title="Projects Category"
                slices={projectInsights.categorySlices}
                ringWidth={32}
                chartSize="sm"
                className="h-[280px]"
              />

              {/* Deliverables area chart */}
              <div className="flex h-[280px] flex-col rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-2 shrink-0 text-[11px] font-semibold text-gray-600">Deliverables</h3>
                <div className="flex flex-1 flex-col min-h-0">
                  {(() => {
                    const monthLabels = projectInsights.monthNames;
                    const CL = 28, CR = 6, CT = 6, CB = 18;
                    const VW = 320, VH = 160;
                    const chartW = VW - CL - CR, chartH = VH - CT - CB;
                    const chartX = CL, chartY = CT, chartBottom = CT + chartH;
                    const maxV = Math.max(1, ...projectInsights.deliverableTotal, ...projectInsights.deliverableDone, ...projectInsights.deliverablePending);
                    const tickStep = Math.max(1, Math.ceil(maxV / 4));
                    const niceMax = tickStep * 4;
                    const yTicks = [0, 1, 2, 3, 4].map((t) => t * tickStep);
                    const yCoord = (v: number) => chartBottom - (v / niceMax) * chartH;
                    const n = monthLabels.length || 1;
                    const xCoord = (i: number) => chartX + (n > 1 ? i * (chartW / (n - 1)) : chartW / 2);
                    const linePoints = (arr: number[]) => arr.map((v, i) => `${xCoord(i)},${yCoord(v)}`).join(' ');
                    const areaPoints = (arr: number[]) => `${xCoord(0)},${chartBottom} ${linePoints(arr)} ${xCoord(arr.length - 1)},${chartBottom}`;
                    const isEmpty = projectInsights.deliverableTotal.every((v) => v === 0);
                    return (
                      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full flex-1 chart-svg">
                        {yTicks.map((tick) => {
                          const y = yCoord(tick);
                          return (
                            <g key={tick}>
                              <line x1={chartX} x2={chartX + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.6" />
                              <text x={chartX - 4} y={y + 3} fontSize="7" fill="#9ca3af" textAnchor="end">{tick}</text>
                            </g>
                          );
                        })}
                        {isEmpty
                          ? <text x={chartX + chartW / 2} y={chartY + chartH / 2} textAnchor="middle" fontSize="9" fill="#d1d5db">No data</text>
                          : <>
                            <polygon points={areaPoints(projectInsights.deliverableTotal)} fill="#ef4444" opacity="0.75" />
                            <polygon points={areaPoints(projectInsights.deliverableDone)} fill="#2563eb" opacity="0.85" />
                            <polygon points={areaPoints(projectInsights.deliverablePending)} fill="#f6be00" opacity="0.9" />
                            <polyline points={linePoints(projectInsights.deliverableTotal)} fill="none" stroke="#ef4444" strokeWidth="1.5" />
                            <polyline points={linePoints(projectInsights.deliverableDone)} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                            <polyline points={linePoints(projectInsights.deliverablePending)} fill="none" stroke="#f6be00" strokeWidth="1.5" />
                            {projectInsights.deliverableDone.map((v, i) => <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r="2" fill="#2563eb" stroke="white" strokeWidth="0.8" />)}
                            {projectInsights.deliverablePending.map((v, i) => <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r="2" fill="#f6be00" stroke="white" strokeWidth="0.8" />)}
                          </>
                        }
                        {monthLabels.map((m, i) => (
                          <text key={m} x={xCoord(i)} y={chartBottom + 12} fontSize="6.5" fill="#9ca3af" textAnchor="middle">{m}</text>
                        ))}
                      </svg>
                    );
                  })()}
                  <div className="flex items-center justify-center gap-3 mt-1 shrink-0">
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" />Total</span>
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb]" />Delivered</span>
                    <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-[#f6be00]" />To Be Delivered</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <h3 className="enj-screen-header">Projects List</h3>
              <button
                type="button"
                className="bg-transparent p-0 text-xs font-semibold text-[#A08149] hover:underline"
                onClick={() => setShowAllProjectsScreen(true)}
              >
                View All
              </button>
            </div>
            <table className={`${enj.table} w-full`}>
              <thead className="bg-[#eaecf3] border-y border-gray-100">
                <tr className="text-xs font-semibold text-[#6d7488] text-left">
                  <th className="px-3 py-2">Project Name</th>
                  <th className="px-3 py-2">Strategic Objective</th>
                  <th className="px-3 py-2">Project Sponsor</th>
                  <th className="px-3 py-2">Budget</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Start Date</th>
                  <th className="px-3 py-2">Progress Level</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardProjectsLoading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">Loading projects...</td>
                  </tr>
                )}
                {!dashboardProjectsLoading && latestFiveProjects.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">No projects found.</td>
                  </tr>
                )}
                {!dashboardProjectsLoading && latestFiveProjects.map((row) => {
                  const name = String(row.new_projectname ?? row.new_name ?? 'Project').trim() || 'Project';
                  const status = projectStatusLabel(row);
                  const progress = projectProgressPct(row);
                  return (
                    <tr key={String(row.new_projectid ?? row.createdon ?? name)} className="border-b border-[#ececf3] text-sm text-[#4c556d]">
                      <td className="px-3 py-3">
                        <span className="block max-w-[220px] truncate">{name}</span>
                      </td>
                      <td className="px-3 py-3">{projectObjectiveLabel(row)}</td>
                      <td className="px-3 py-3">{projectSponsorLabel(row)}</td>
                      <td className="px-3 py-3">{projectBudgetLabel(row)}</td>
                      <td className="px-3 py-3">{projectCategoryLabel(row)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[10px] text-[#40475d]">Start Date</p>
                            <p className="text-[10px] text-[#7b8193] flex items-center gap-1">
                              <Calendar size={12} className="text-[#9aa1b4]" />
                              {projectDateLabel(row.new_startdate)}
                            </p>
                          </div>
                          <div className="w-px h-8 bg-[#d9dbe5]" />
                          <div>
                            <p className="text-[10px] text-[#40475d]">End Date</p>
                            <p className="text-[10px] text-[#7b8193] flex items-center gap-1">
                              <Calendar size={12} className="text-[#9aa1b4]" />
                              {projectDateLabel(row.new_enddate)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="w-[180px]">
                          <p className="text-[12px] text-[#8c93a6] text-right mb-1">{progress}%</p>
                          <div className="enj-table-progress-track">
                            <div className="enj-table-progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`enj-table-status ${projectStatusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

function PlaceholderRoleDashboard({ role, onLogout }: { role: AppRole; onLogout: () => void }) {
  return (
    <div className="h-screen overflow-hidden bg-[#f5f6fb] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{ROLE_LABELS[role]} workspace</span>
        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 text-center max-w-md">
          Signed in as <span className="font-semibold text-gray-800">{ROLE_LABELS[role]}</span>.
          A dedicated dashboard for this role can be added next.
        </p>
      </main>
    </div>
  );
}

function RoleDashboard({ role, onLogout }: { role: AppRole; onLogout: () => void }) {
  if (role === 'admin') return <AdminDashboard onLogout={onLogout} />;
  if (role === 'team') return <TeamDashboard onLogout={onLogout} />;
  if (role === 'business') return <BusinessDashboard onLogout={onLogout} />;
  if (role === 'program') return <ProgramDashboard onLogout={onLogout} />;
  if (role === 'project') return <ProjectDashboard onLogout={onLogout} />;
  return <PlaceholderRoleDashboard role={role} onLogout={onLogout} />;
}

// ─── App (login page — unchanged) ─────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRole, setLoginRole] = useState<AppRole>('business');

  useEffect(() => {
    const getPickerInput = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const direct = target instanceof HTMLInputElement ? target : null;
      const resolved =
        direct?.matches('input[type="date"], input[type="datetime-local"]')
          ? direct
          : (target.closest('input[type="date"], input[type="datetime-local"]') as HTMLInputElement | null);
      if (!resolved || resolved.disabled || resolved.readOnly) return null;
      return resolved as HTMLInputElement & { showPicker?: () => void };
    };

    const openNativePicker = (target: EventTarget | null) => {
      const pickerInput = getPickerInput(target);
      if (!pickerInput) return;
      if (typeof pickerInput.showPicker !== 'function') return;
      try {
        pickerInput.focus();
        pickerInput.showPicker();
      } catch {
        // Ignore browser restrictions and fallback behavior.
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      openNativePicker(event.target);
    };
    const onClick = (event: MouseEvent) => {
      openNativePicker(event.target);
    };
    const onFocusIn = (event: FocusEvent) => {
      openNativePicker(event.target);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, []);

  if (isLoggedIn) {
    return (
      <div className="relative h-screen">
        <RoleDashboard role={loginRole} onLogout={() => setIsLoggedIn(false)} />
        <p className="fixed inset-x-0 bottom-0 z-50 bg-white/90 py-2 text-center text-[11px] text-gray-500 backdrop-blur-sm">
          Copyright @2026 Enjaz Management Tool. All rights reserved.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Full Screen Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          alt="Login background illustration"
          src={saudiHeroImage}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Login Form - Positioned on Left White Space */}
      <main className="relative h-screen w-full flex flex-col justify-center z-10">
        <div className="w-full max-w-sm flex flex-col items-center gap-8 px-8" style={{ marginLeft: '13%' }}>
          {/* Brand Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="shadow-md rounded-lg p-2 bg-white">
              <LogoMark sizeClass="w-16 h-16" />
            </div>
            <span className="text-lg font-bold tracking-wide text-[#232360]">ENJAZ</span>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center space-y-3 w-full"
          >
            <h1 className="text-4xl font-bold text-[#232360]">Welcome to Enjaz</h1>
            <p className="text-gray-500 text-base font-normal">
              Your workspace for efficient team collaboration and task tracking.
            </p>
          </motion.div>

          {/* Form */}
          <form className="w-full space-y-5" onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full"
            >
              <select
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value as AppRole)}
                className="w-full px-4 py-3 bg-white border-2 border-[#b8a876] rounded-lg focus:outline-none focus:border-[#b8a876] text-[#232360] text-base font-medium font-sans cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23b8a876' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                  paddingRight: '2.5rem'
                }}
              >
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-[#b8a876] hover:bg-[#a59766] text-white font-bold text-base rounded-lg shadow-md transition-all duration-200"
              type="submit"
            >
              Get Started
            </motion.button>
          </form>
        </div>
      </main>

      <p className="fixed inset-x-0 bottom-0 z-50 bg-white/90 py-2 text-center text-[11px] text-gray-500 backdrop-blur-sm">
        Copyright @2026 Enjaz Management Tool. All rights reserved.
      </p>
    </div>
  );
}

/** Timeline date parsing and month-scale axis for Business role Gantt view. */

import { resolveProjectProgramName } from './programNameResolve';

export function parseTimelineDate(rawValue: unknown): Date | null {
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
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]);
    const d = Number(dateOnlyMatch[3]);
    const localDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  const msJson = raw.match(/\/Date\((-?\d+)\)\//);
  if (msJson) {
    const ms = Number(msJson[1]);
    if (!Number.isFinite(ms)) return null;
    const parsed = new Date(ms);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

export function exclusiveEndAfterInclusiveDate(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

export function formatTimelineDateLabel(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export type TimelineHeaderBand = { text: string; span: number };

export type BusinessMonthTimelineRange = {
  start: Date;
  endExclusive: Date;
  monthYearLabel: string;
  quarterBands: TimelineHeaderBand[];
  monthBands: TimelineHeaderBand[];
  weekBands: TimelineHeaderBand[];
  bottomLabels: string[];
  dayCount: number;
};

function weekOfYearLabel(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
  const w = Math.ceil(dayOfYear / 7);
  return `W ${String(w).padStart(2, '0')}`;
}

function buildBands<T>(items: T[], getKey: (item: T) => string, getLabel: (item: T) => string): TimelineHeaderBand[] {
  const out: TimelineHeaderBand[] = [];
  let i = 0;
  while (i < items.length) {
    const key = getKey(items[i]);
    let j = i + 1;
    while (j < items.length && getKey(items[j]) === key) j += 1;
    out.push({ text: getLabel(items[i]), span: j - i });
    i = j;
  }
  return out;
}

/** One calendar month; each column is a day (matches reference Timeline scale). */
export function businessMonthDayTimelineModel(year: number, month: number): BusinessMonthTimelineRange {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, month + 1, 1, 0, 0, 0, 0);
  const days: Date[] = [];
  for (let t = start.getTime(); t < endExclusive.getTime(); t += 86400000) {
    days.push(new Date(t));
  }
  const dayCount = Math.max(1, days.length);
  const quarter = `Q${Math.floor(month / 3) + 1}`;
  const monthShort = start.toLocaleDateString(undefined, { month: 'long' });
  return {
    start,
    endExclusive,
    monthYearLabel: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    quarterBands: [{ text: quarter, span: dayCount }],
    monthBands: [{ text: monthShort, span: dayCount }],
    weekBands: buildBands(days, (d) => weekOfYearLabel(d), (d) => weekOfYearLabel(d)),
    bottomLabels: days.map((d) => String(d.getDate())),
    dayCount,
  };
}

export const TIMELINE_BAR_COLORS = [
  '#232360',
  '#19c37d',
  '#5b4fc7',
  '#f4b400',
  '#1766e5',
  '#d35b66',
  '#0d9488',
] as const;

export type TimelineProjectItem = {
  id: string;
  programName: string;
  projectName: string;
  start: Date;
  end: Date;
  progress: string;
  progressNum: number;
  color: string;
};

export function buildTimelineProjects(
  rows: ReadonlyArray<Record<string, unknown>>,
  programIdToName: ReadonlyMap<string, string>,
): TimelineProjectItem[] {
  const items: TimelineProjectItem[] = [];
  let colorIdx = 0;
  for (const p of rows) {
    const start = parseTimelineDate(p.new_startdate);
    const end = parseTimelineDate(p.new_enddate) ?? start;
    if (!start || !end) continue;
    const prog = resolveProjectProgramName(p, programIdToName);
    const name = String(p.new_projectname ?? p.new_name ?? 'Project').trim() || 'Project';
    const n = Number(p.new_progress ?? NaN);
    const progressNum = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
    items.push({
      id: String(p.new_projectid ?? `${name}-${start.getTime()}`),
      programName: prog,
      projectName: name,
      start,
      end,
      progress: `${progressNum}%`,
      progressNum,
      color: TIMELINE_BAR_COLORS[colorIdx % TIMELINE_BAR_COLORS.length],
    });
    colorIdx += 1;
  }
  return items;
}

export type TimelineBarPlacement = {
  rowIndex: number;
  label: string;
  color: string;
  progress: string;
  progressNum: number;
  startPct: number;
  widthPct: number;
};

export function placementForProject(
  item: TimelineProjectItem,
  range: BusinessMonthTimelineRange,
  rowIndex: number,
): TimelineBarPlacement | null {
  const rangeStart = range.start.getTime();
  const rangeEndExcl = range.endExclusive.getTime();
  const totalMs = Math.max(1, rangeEndExcl - rangeStart);
  const projectStartMs = item.start.getTime();
  const projectEndExcl = exclusiveEndAfterInclusiveDate(item.end);
  if (projectEndExcl <= projectStartMs) return null;
  const s = Math.max(rangeStart, projectStartMs);
  const e = Math.min(rangeEndExcl, projectEndExcl);
  if (e <= rangeStart || s >= rangeEndExcl) return null;
  const startPct = ((s - rangeStart) / totalMs) * 100;
  const endPct = ((e - rangeStart) / totalMs) * 100;
  return {
    rowIndex,
    label: item.projectName,
    color: item.color,
    progress: item.progress,
    progressNum: item.progressNum,
    startPct,
    widthPct: Math.max(1.5, endPct - startPct),
  };
}

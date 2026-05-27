import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Folder,
  RefreshCw,
} from 'lucide-react';
import { ScreenLoader } from './ScreenLoader';
import { normalizeDataverseId } from './programNameResolve';
import {
  buildTimelineProjects,
  businessMonthDayTimelineModel,
  placementForProject,
  type TimelineProjectItem,
} from './businessTimelineUtils';
import { enj } from './ui/enjForm';

const ROW_H = 44;
const LEFT_W = 168;
const HEADER_H = 88;
const PANEL_MIN_H = 'min(36rem, 72vh)';

type ProgramGroup = {
  key: string;
  name: string;
  projects: TimelineProjectItem[];
};

type VisibleRow =
  | { kind: 'program'; key: string; name: string; projectCount: number }
  | { kind: 'project'; item: TimelineProjectItem; rowIndex: number };

function timelineTrackTint(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 'rgba(148, 163, 184, 0.22)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
}

function TimelineGanttBar({
  label,
  color,
  progress,
  progressNum,
  startPct,
  widthPct,
}: {
  label: string;
  color: string;
  progress: string;
  progressNum: number;
  startPct: number;
  widthPct: number;
}) {
  const pct = Math.max(0, Math.min(100, progressNum));
  const progressLabel = progress || `${pct}%`;
  const trackBg = timelineTrackTint(color);

  return (
    <div
      className="enj-timeline-gantt-bar absolute inset-y-0 my-auto flex h-8 min-w-[4.5rem] items-stretch overflow-hidden rounded-full shadow-sm"
      style={{
        left: `${startPct}%`,
        width: `${widthPct}%`,
        backgroundColor: trackBg,
      }}
      title={`${label} — ${progressLabel}`}
    >
      {pct >= 100 ? (
        <div
          className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full px-2.5"
          style={{ backgroundColor: color }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-white" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold leading-none text-white">
            {label}
          </span>
          <span
            className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold tabular-nums leading-none shadow-sm"
            style={{ color }}
          >
            {progressLabel}
          </span>
        </div>
      ) : (
        <>
          {pct > 0 && (
            <div
              className="flex h-full shrink-0 items-center gap-2 overflow-hidden rounded-full px-2.5"
              style={{
                width: `${pct}%`,
                minWidth: 0,
                backgroundColor: color,
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-white" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold leading-none text-white">
                {label}
              </span>
            </div>
          )}

          {pct === 0 && (
            <div className="flex h-full min-w-0 flex-1 items-center px-2.5">
              <span className="min-w-0 truncate text-left text-[10px] font-semibold leading-none text-gray-700">
                {label}
              </span>
            </div>
          )}

          {pct > 0 && <div className="h-full min-w-0 flex-1" aria-hidden />}

          <div className="flex h-full shrink-0 items-center px-2">
            <span
              className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold tabular-nums leading-none shadow-sm"
              style={{ color }}
            >
              {progressLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function TimelineAxisHeader({ range }: { range: ReturnType<typeof businessMonthDayTimelineModel> }) {
  return (
    <div className="shrink-0 border-b border-gray-100 bg-white px-2 py-2" style={{ minHeight: HEADER_H }}>
      <div
        className="grid w-full border-b border-slate-100 text-[9px] font-bold uppercase tracking-wide text-slate-600"
        style={{ gridTemplateColumns: `repeat(${range.dayCount}, minmax(0, 1fr))` }}
      >
        {range.quarterBands.map((b, i) => (
          <div
            key={`q-${b.text}-${i}`}
            className="border-l border-slate-100 py-1 text-center first:border-l-0"
            style={{ gridColumn: `span ${b.span}` }}
          >
            {b.text}
          </div>
        ))}
      </div>
      <div
        className="grid w-full border-b border-indigo-100/90 text-[9px] font-semibold text-indigo-900"
        style={{ gridTemplateColumns: `repeat(${range.dayCount}, minmax(0, 1fr))` }}
      >
        {range.monthBands.map((b, i) => (
          <div
            key={`m-${b.text}-${i}`}
            className="border-l border-indigo-100 py-0.5 text-center first:border-l-0"
            style={{ gridColumn: `span ${b.span}` }}
          >
            {b.text}
          </div>
        ))}
      </div>
      <div
        className="grid w-full border-b border-slate-100 text-[8px] font-medium text-slate-600"
        style={{ gridTemplateColumns: `repeat(${range.dayCount}, minmax(0, 1fr))` }}
      >
        {range.weekBands.map((b, i) => (
          <div
            key={`w-${b.text}-${i}`}
            className="border-l border-slate-100 py-0.5 text-center first:border-l-0"
            style={{ gridColumn: `span ${b.span}` }}
          >
            {b.text}
          </div>
        ))}
      </div>
      <div
        className="grid w-full text-gray-500"
        style={{ gridTemplateColumns: `repeat(${range.dayCount}, minmax(0, 1fr))` }}
      >
        {range.bottomLabels.map((day, i) => (
          <span
            key={`d-${day}-${i}`}
            className="border-l border-gray-100 py-0.5 text-center text-[8px] tabular-nums first:border-l-0"
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BusinessTimelineScreen({
  projects,
  programRows,
  programIdToName,
  loading,
  onRefresh,
}: {
  projects: ReadonlyArray<Record<string, unknown>>;
  programRows: ReadonlyArray<Record<string, unknown>>;
  programIdToName: ReadonlyMap<string, string>;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const range = useMemo(() => businessMonthDayTimelineModel(viewYear, viewMonth), [viewYear, viewMonth]);

  const allProjects = useMemo(
    () => buildTimelineProjects(projects, programIdToName),
    [projects, programIdToName],
  );

  const programGroups = useMemo((): ProgramGroup[] => {
    const byProgram = new Map<string, TimelineProjectItem[]>();
    for (const item of allProjects) {
      const list = byProgram.get(item.programName) ?? [];
      list.push(item);
      byProgram.set(item.programName, list);
    }
    const orderedNames: string[] = [];
    for (const row of programRows) {
      const name = String(row.new_name ?? '').trim();
      if (name && !orderedNames.includes(name)) orderedNames.push(name);
    }
    for (const name of byProgram.keys()) {
      if (!orderedNames.includes(name)) orderedNames.push(name);
    }
    return orderedNames.map((name) => {
      const id = programRows.find((r) => String(r.new_name ?? '').trim() === name);
      const key = id?.new_programid
        ? `id:${normalizeDataverseId(String(id.new_programid))}`
        : `name:${name.toLowerCase()}`;
      return {
        key,
        name,
        projects: (byProgram.get(name) ?? []).sort((a, b) =>
          a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }),
        ),
      };
    });
  }, [allProjects, programRows]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of programGroups) {
        if (next[g.key] === undefined) next[g.key] = true;
      }
      return next;
    });
  }, [programGroups]);

  const { visibleRows, barsByRowIndex } = useMemo(() => {
    const rows: VisibleRow[] = [];
    const barMap = new Map<number, ReturnType<typeof placementForProject>>();
    let rowIndex = 0;
    for (const group of programGroups) {
      const isOpen = expanded[group.key] !== false;
      rows.push({
        kind: 'program',
        key: group.key,
        name: group.name,
        projectCount: group.projects.length,
      });
      rowIndex += 1;
      if (isOpen) {
        for (const item of group.projects) {
          rows.push({ kind: 'project', item, rowIndex });
          const bar = placementForProject(item, range, rowIndex);
          if (bar) barMap.set(rowIndex, bar);
          rowIndex += 1;
        }
      }
    }
    return { visibleRows: rows, barsByRowIndex: barMap };
  }, [programGroups, expanded, range]);

  const chartMinWidth = Math.max(720, range.dayCount * 28);
  const bodyMinHeight = Math.max(ROW_H * 4, visibleRows.length * ROW_H);

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (scrollSyncLock.current) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    scrollSyncLock.current = true;
    if (source === 'left') right.scrollTop = left.scrollTop;
    else left.scrollTop = right.scrollTop;
    scrollSyncLock.current = false;
  }, []);

  const goToday = useCallback(() => setViewDate(new Date()), []);
  const goPrevMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);
  const goNextMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const toggleProgram = (key: string) => {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  };

  return (
    <div className={`${enj.stack} enj-business-timeline flex min-h-0 w-full flex-1 flex-col`}>
      <div className={enj.screenToolbar}>
        <h2 className="enj-screen-header">Timeline</h2>
        <div className={`${enj.screenToolbarActions} text-xs`}>
          <button
            type="button"
            onClick={onRefresh}
            className={`${enj.btn} ${enj.btnOutline} !h-9 !w-9 !min-h-0 !px-0`}
            title="Refresh timeline"
            aria-label="Refresh timeline"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={goToday} className={`${enj.btn} ${enj.btnOutline} px-3 text-sm`}>
            Today
          </button>
          <div className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-600 shadow-sm">
            <button
              type="button"
              onClick={goPrevMonth}
              className={`${enj.btn} ${enj.btnGhost} !h-7 !w-7 !min-h-0 !px-0`}
              aria-label="Previous month"
            >
              {'<'}
            </button>
            <span className="min-w-[7rem] text-center font-semibold text-primary">{range.monthYearLabel}</span>
            <button
              type="button"
              onClick={goNextMonth}
              className={`${enj.btn} ${enj.btnGhost} !h-7 !w-7 !min-h-0 !px-0`}
              aria-label="Next month"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 gap-3"
        style={{ minHeight: PANEL_MIN_H }}
      >
        {/* Left: program / project tree — separate panel */}
        <aside
          className="enj-business-timeline-tree flex w-[168px] shrink-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
          style={{ width: LEFT_W, minHeight: PANEL_MIN_H }}
        >
          <div
            ref={leftScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
            onScroll={() => syncScroll('left')}
          >
            {programGroups.length === 0 && !loading ? (
              <p className="px-3 py-6 text-[11px] text-gray-500">No programs to show.</p>
            ) : (
              <div style={{ minHeight: bodyMinHeight }}>
                {programGroups.map((group, groupIdx) => {
                  const isOpen = expanded[group.key] !== false;
                  return (
                    <div
                      key={group.key}
                      className={groupIdx > 0 ? 'border-t border-gray-200' : ''}
                    >
                      <div
                        className="flex items-center border-b border-gray-100 bg-[#eef0f6]"
                        style={{ minHeight: ROW_H, height: ROW_H }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleProgram(group.key)}
                          className="flex w-full min-w-0 items-center gap-1 px-2 py-1 text-left hover:opacity-90"
                        >
                          <ChevronDown
                            size={12}
                            className={`shrink-0 text-gray-500 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                          />
                          <Folder size={12} className="shrink-0 text-[#b28a44]" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#232360]">
                            {group.name}
                          </span>
                          <span className="shrink-0 text-[9px] tabular-nums text-gray-500">{group.projects.length}</span>
                        </button>
                      </div>
                      {isOpen &&
                        group.projects.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center border-b border-gray-50 bg-white"
                            style={{ minHeight: ROW_H, height: ROW_H }}
                          >
                            <span
                              className="ml-5 flex min-w-0 items-center gap-1 border-l-2 border-[#e8e6ef] py-1 pl-2 pr-1"
                              title={item.projectName}
                            >
                              <Folder size={11} className="shrink-0 text-gray-400" strokeWidth={1.5} />
                              <span className="truncate text-[10px] font-medium text-[#6b7280]">{item.projectName}</span>
                            </span>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right: Gantt timeline — separate panel */}
        <section
          className="enj-business-timeline-chart flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
          style={{ minHeight: PANEL_MIN_H }}
        >
          <TimelineAxisHeader range={range} />
          <div
            ref={rightScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
            onScroll={() => syncScroll('right')}
          >
            <div style={{ minWidth: chartMinWidth, minHeight: bodyMinHeight }}>
              {visibleRows.map((row) => {
                const bar = row.kind === 'project' ? barsByRowIndex.get(row.rowIndex) : undefined;
                return (
                  <div
                    key={row.kind === 'program' ? `c-p-${row.key}` : `c-j-${row.item.id}`}
                    className={`relative border-b border-gray-50 ${
                      row.kind === 'program' ? 'bg-[#fafbfc]' : 'bg-white'
                    }`}
                    style={{
                      minHeight: ROW_H,
                      height: ROW_H,
                      backgroundImage:
                        row.kind === 'project'
                          ? `repeating-linear-gradient(to right, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent calc(100% / ${range.dayCount}))`
                          : undefined,
                    }}
                  >
                    {bar && (
                      <TimelineGanttBar
                        label={bar.label}
                        color={bar.color}
                        progress={bar.progress}
                        progressNum={bar.progressNum}
                        startPct={bar.startPct}
                        widthPct={bar.widthPct}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {loading && <ScreenLoader overlay className="rounded-xl" />}
      </div>
    </div>
  );
}

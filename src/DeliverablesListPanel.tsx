import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { New_deliverablesService } from './generated/services/New_deliverablesService';
import { New_deliverablesnew_status } from './generated/models/New_deliverablesModel';
import type { New_deliverables } from './generated/models/New_deliverablesModel';
import { type ToastType } from './NotificationToast';
import { PagerBar } from './PagerBar';
import { ScreenLoader } from './ScreenLoader';
import { enj } from './ui/enjForm';

const PAGE_SIZE = 5;
const FETCH_TOP = 5000;

function statusBadgeClass(statusLabel: string): string {
  const u = statusLabel.toUpperCase();
  if (u.includes('DELIVERED') && !u.includes('TO') && !u.includes('BE')) return 'enj-table-status--completed';
  if (u.includes('DELAY')) return 'enj-table-status--delayed';
  if (u.includes('TO') && (u.includes('DELIVER') || u.includes('BE'))) return 'enj-table-status--neutral';
  if (u.includes('TRACK')) return 'enj-table-status--ontrack';
  return 'enj-table-status--neutral';
}

function rowStatusLabel(row: New_deliverables): string {
  const n = row.new_statusname;
  if (n !== undefined && n !== null && String(n).trim() !== '') return String(n);
  if (row.new_status !== undefined && row.new_status !== null) {
    const s = New_deliverablesnew_status[row.new_status as keyof typeof New_deliverablesnew_status];
    if (s) return s.replace(/([a-z])([A-Z])/g, '$1 $2');
    return String(row.new_status);
  }
  return '—';
}

type Props = {
  isActive: boolean;
  refreshKey: number;
  onNotify: (type: ToastType, message: string) => void;
  variant: 'program' | 'project';
  onNewDeliverable: () => void;
  onEditRequest?: (row: New_deliverables) => void;
  onDeleteRequest?: (row: New_deliverables) => void;
};

export function DeliverablesListPanel({
  isActive,
  refreshKey,
  onNotify,
  variant,
  onNewDeliverable,
  onEditRequest,
  onDeleteRequest,
}: Props) {
  const [page, setPage] = useState(1);
  const [allRows, setAllRows] = useState<New_deliverables[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await New_deliverablesService.getAll({ top: FETCH_TOP, orderBy: ['createdon desc'] });
      if (!res.success) {
        const msg = res.error?.message ?? 'Failed to load deliverables';
        setAllRows([]);
        setTotal(0);
        setLoadError(msg);
        onNotifyRef.current('error', msg);
        return;
      }
      const data = (res.data ?? []) as New_deliverables[];
      setAllRows(data);
      setTotal(data.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load deliverables';
      setAllRows([]);
      setTotal(0);
      setLoadError(msg);
      onNotifyRef.current('error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    setPage(1);
  }, [isActive, refreshKey]);

  useEffect(() => {
    if (!isActive) return;
    void loadAll();
  }, [isActive, refreshKey, loadAll]);

  const totalPages = Math.max(1, total === null || total === 0 ? 1 : Math.ceil((total as number) / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const rows = (() => {
    const n = (total ?? 0) || 0;
    if (n === 0) return [] as New_deliverables[];
    return allRows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  })();

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const count = total ?? 0;
  const showRange = !loading && !loadError && count > 0;
  const emptyLeft = showRange ? undefined : loading ? '…' : loadError ? '—' : '0 records';

  const chartSample = allRows;
  const statusCounts = (() => {
    const c = { delivered: 0, toDeliver: 0, delayed: 0 };
    chartSample.forEach((r) => {
      if (r.new_status === 100000000) c.delivered += 1;
      else if (r.new_status === 100000001) c.toDeliver += 1;
      else if (r.new_status === 100000002) c.delayed += 1;
    });
    return c;
  })();

  const byProject = (() => {
    const m = new Map<string, number>();
    chartSample.forEach((r) => {
      const n = String(r.new_projectname ?? '').trim() || '—';
      m.set(n, (m.get(n) ?? 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  const stTotal = statusCounts.delivered + statusCounts.toDeliver + statusCounts.delayed || 1;
  const wDelivered = (statusCounts.delivered / stTotal) * 100;
  const wTo = (statusCounts.toDeliver / stTotal) * 100;
  const wDelayed = (statusCounts.delayed / stTotal) * 100;
  const maxBar = byProject.length ? Math.max(...byProject.map(([, c]) => c), 1) : 1;

  const showActions = !!(onEditRequest || onDeleteRequest);
  const colSpan = showActions ? 5 : 4;

  const h2 = 'enj-screen-header';
  const h3 = variant === 'program' ? 'enj-screen-subheader' : 'enj-screen-header';
  const btnNew = `${enj.btn} ${enj.btnPrimary} px-4 ${variant === 'program' ? 'text-sm font-medium' : 'text-xs font-semibold'}`;

  const tableBlock = (
    <div className="relative bg-transparent overflow-hidden flex flex-col gap-0">
      {loading && <ScreenLoader className="min-h-[220px]" />}
      {!loading && (
        <table className={`${enj.table} w-full text-xs bg-transparent border-separate`}>
          <thead>
            <tr className="bg-[rgba(225,227,236,1)]">
              <th className="px-3 py-2 text-[11px] font-semibold border-0 text-[rgba(118,131,150,1)]">Project</th>
              <th className="px-3 py-2 text-[11px] font-semibold border-0 text-[rgba(118,131,150,1)]">Project Manager</th>
              <th className="px-3 py-2 text-[11px] font-semibold border-0 text-[rgba(118,131,150,1)]">Deliverables</th>
              <th className="px-3 py-2 text-[11px] font-semibold border-0 text-[rgba(118,131,150,1)]">Status</th>
              {showActions && <th className="w-[5rem] text-center px-3 py-2 text-[11px] font-semibold border-0 text-[rgba(118,131,150,1)]">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="bg-transparent">
                <td colSpan={colSpan} className="px-3 py-6 text-sm text-center bg-transparent">
                  {loadError ? (
                    <span className="text-rose-600">{loadError}</span>
                  ) : (
                    <span className="text-gray-500">No deliverable records found.</span>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const st = rowStatusLabel(row);
                const rowKey = String(
                  (row as unknown as Record<string, unknown>).new_deliverableid ??
                  (row as unknown as Record<string, unknown>).new_deliverablesid ??
                  `row-${(pageSafe - 1) * PAGE_SIZE + rowIdx}`,
                );
                return (
                  <tr key={rowKey} className="bg-white rounded-[11.9px] hover:shadow-md transition-shadow border-0 text-xs">
                    <td className="px-3 py-2 font-medium text-[#374151] bg-white border-0 rounded-l-[11.9px]">{String(row.new_projectname ?? '—')}</td>
                    <td className="px-3 py-2 bg-white border-0">{String(row.new_projectmanager ?? '—')}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate bg-white border-0" title={row.new_thedeliverablesinclude ?? row.new_notes ?? ''}>
                      {String(row.new_thedeliverablesinclude ?? row.new_notes ?? '—')}
                    </td>
                    <td className="px-3 py-2 bg-white border-0">
                      <span className={`enj-table-status ${statusBadgeClass(st)}`}>{st}</span>
                    </td>
                    {showActions && (
                      <td className="px-3 py-2 bg-white border-0 rounded-r-[11.9px]">
                        <div className="flex items-center justify-center gap-1.5">
                          {onEditRequest && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => onEditRequest(row)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-[#A08149] hover:text-[#A08149] transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {onDeleteRequest && (
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => onDeleteRequest(row)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-rose-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
      <div className="shrink-0 px-3 py-2">
        <PagerBar
          page={showRange ? pageSafe : 1}
          pageSize={PAGE_SIZE}
          total={showRange ? count : 0}
          emptyStateLabel={emptyLeft}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={loading}
        />
      </div>
    </div>
  );

  const charts = (
    <aside className="space-y-3">
      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
        <h3 className={`${h3} mb-2`}>Deliverables Status</h3>
        <p className="text-[9px] text-gray-500 mb-2">
          Delivered: {statusCounts.delivered}, To deliver: {statusCounts.toDeliver}, Delayed: {statusCounts.delayed}
        </p>
        <div className="flex h-3 rounded overflow-hidden w-full max-w-full">
          <div className="h-full bg-blue-600" style={{ width: `${wDelivered}%` }} title="Delivered" />
          <div className="h-full bg-amber-400" style={{ width: `${wTo}%` }} title="To be delivered" />
          <div className="h-full bg-rose-500" style={{ width: `${wDelayed}%` }} title="Delayed" />
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
        <h3 className={`${h3} mb-2`}>Deliverables via Projects</h3>
        <div className="flex items-end justify-between gap-1 h-32 px-1">
          {byProject.length === 0 ? (
            <p className="text-[10px] text-gray-400">No data</p>
          ) : (
            byProject.map(([name, cnt], i) => {
              const h = (cnt / maxBar) * 100;
              const colors = ['#59628a', '#e4bf7f', '#bf9650', '#6fa0e4', '#d65257'];
              return (
                <div key={name + i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <div
                    className="w-full max-w-[28px] rounded-t chart-bar mx-auto"
                    style={{ height: `${Math.max(8, h * 0.9)}px`, backgroundColor: colors[i % colors.length] }}
                    title={`${name}: ${cnt}`}
                  />
                  <span className="text-[6px] text-gray-500 text-center line-clamp-2 leading-tight">{name}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );

  if (!isActive) return null;

  const headerRow = (
    <div className="flex items-center justify-between">
      <h2 className={h2}>Display List Of Deliverables</h2>
      <button type="button" className={btnNew} onClick={onNewDeliverable}>
        {variant === 'program' ? '+ New Deliverable' : '+ New List'}
      </button>
    </div>
  );

  const body = (
    <section className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-3 mt-3">
      {tableBlock}
      {charts}
    </section>
  );

  if (variant === 'project') {
    return (
      <section className={enj.screenContainer}>
        <div className="mb-4">{headerRow}</div>
        {body}
      </section>
    );
  }

  return (
    <>
      {headerRow}
      {body}
    </>
  );
}

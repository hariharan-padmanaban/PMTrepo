import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { New_taskdetailsService } from './generated/services/New_taskdetailsService';
import { ScreenLoader } from './ScreenLoader';

type Props = {
  taskId: string;
  onClose: () => void;
};

function normalizeGuid(s: string): string {
  return String(s).replace(/[{}]/g, '').toLowerCase().trim();
}

function rowMatchesParentTask(row: Record<string, unknown>, parentGuidNorm: string): boolean {
  const candidates = [
    row.new_taskid,
    row._new_task_value,
    row._new_taskid_value,
    (row as { new_task?: unknown }).new_task,
  ];
  for (const c of candidates) {
    if (c != null && c !== '' && normalizeGuid(String(c)) === parentGuidNorm) return true;
  }
  return false;
}

function sortByDetailIdDesc(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...rows].sort((a, b) => {
    const ida = String(a.new_taskdetailid ?? '');
    const idb = String(b.new_taskdetailid ?? '');
    return idb.localeCompare(ida, undefined, { sensitivity: 'base' });
  });
}

/** Best-effort attachment from row if a Dataverse field exists (schema may not list it in codegen). */
function displayAttachment(row: Record<string, unknown>): string {
  for (const k of Object.keys(row)) {
    if (!/attach|file|document|url|filename|blob/i.test(k)) continue;
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '—';
}

/**
 * Task Details (`new_taskdetails`) for the parent task, equivalent to:
 * SortByColumns(Filter(TaskDetails, TaskID = …), "ID", Descending)
 */
export function TaskLogsModal({ taskId, onClose }: Props) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const guidRaw = taskId.replace(/[{}]/g, '').trim();
    if (!guidRaw) {
      setRows([]);
      setLoading(false);
      return;
    }
    const parentNorm = normalizeGuid(guidRaw);
    setLoading(true);
    setLoadNote(null);
    try {
      const orderBy = ['new_taskdetailid desc'] as string[];
      const filterAttempts = [
        `new_taskid eq '${guidRaw}'`,
        `_new_task_value eq ${guidRaw}`,
        `_new_task_value eq '${guidRaw}'`,
        `_new_taskid_value eq ${guidRaw}`,
        `_new_taskid_value eq '${guidRaw}'`,
      ];

      for (const filter of filterAttempts) {
        const res = await New_taskdetailsService.getAll({ top: 500, orderBy, filter });
        if (res.success && res.data && res.data.length > 0) {
          setRows(sortByDetailIdDesc(res.data as unknown as Array<Record<string, unknown>>));
          setLoading(false);
          return;
        }
      }

      const all = await New_taskdetailsService.getAll({ top: 2000, orderBy: ['createdon desc'] });
      if (!all.success || !all.data?.length) {
        setRows([]);
        setLoadNote('No log rows returned from Dataverse.');
        setLoading(false);
        return;
      }
      const filtered = (all.data as unknown as Array<Record<string, unknown>>).filter((r) =>
        rowMatchesParentTask(r, parentNorm),
      );
      if (filtered.length === 0) {
        setLoadNote(
          'No Task Details rows linked to this task. If your environment uses a different lookup field, extend the filter in TaskLogsModal.',
        );
      }
      setRows(sortByDetailIdDesc(filtered));
    } catch {
      setRows([]);
      setLoadNote('Failed to load task logs.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-logs-title"
    >
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div className="relative flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="relative flex items-center border-b border-gray-100 px-4 py-3 shrink-0 min-h-[48px]">
          <h2
            id="task-logs-title"
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 text-center text-base font-semibold text-primary pointer-events-none"
          >
            Task logs
          </h2>
          <div className="ml-auto relative z-10">
            <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && <ScreenLoader overlay className="min-h-[120px] rounded-lg" />}
          {!loading && loadNote && rows.length === 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{loadNote}</p>
          )}
          {!loading && rows.length === 0 && !loadNote && (
            <p className="text-sm text-gray-500 text-center py-8">No task log entries for this task.</p>
          )}
          <ul className="space-y-4">
            {rows.map((row, idx) => {
              const key = String(row.new_taskdetailid ?? `task-log-${idx}`);
              const estimation = String(row.new_estimationtime ?? '—').trim() || '—';
              const status = String(row.new_taskstatusname ?? '—');
              const createdBy = String(row.createdbyname ?? row.owneridname ?? '—').trim() || '—';
              const desc = String(row.new_description ?? '—');
              const attach = displayAttachment(row);
              return (
                <li
                  key={key}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-4 text-[12px] text-gray-800 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:grid-rows-2 sm:items-start">
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">Estimation</p>
                      <p className="mt-0.5 text-[12px] text-gray-800 tabular-nums">{estimation}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">Task Status</p>
                      <p className="mt-0.5 text-[12px] text-gray-800">{status}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">Attachment</p>
                      <p className="mt-0.5 text-[12px] text-gray-800 break-words whitespace-pre-wrap">{attach}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">Created By</p>
                      <p className="mt-0.5 text-[12px] text-gray-800">{createdBy}</p>
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900">Description</p>
                      <p className="mt-0.5 text-[12px] text-gray-800 whitespace-pre-wrap break-words" dir="auto">
                        {desc}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

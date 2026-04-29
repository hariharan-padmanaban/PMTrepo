import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { New_issuedetailsService } from './generated/services/New_issuedetailsService';
import { ScreenLoader } from './ScreenLoader';

type Props = {
  issueId: string;
  onClose: () => void;
};

function normalizeGuid(s: string): string {
  return String(s).replace(/[{}]/g, '').toLowerCase().trim();
}

function formatLogWhen(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function rowMatchesParentIssue(row: Record<string, unknown>, parentGuidNorm: string): boolean {
  const candidates = [
    row.new_issueid,
    row._new_issue_value,
    row._new_issueid_value,
    (row as { new_issue?: unknown }).new_issue,
  ];
  for (const c of candidates) {
    if (c != null && c !== '' && normalizeGuid(String(c)) === parentGuidNorm) return true;
  }
  return false;
}

function sortByDetailIdDesc(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...rows].sort((a, b) => {
    const ida = String(a.new_issuedetailid ?? '');
    const idb = String(b.new_issuedetailid ?? '');
    return idb.localeCompare(ida, undefined, { sensitivity: 'base' });
  });
}

/**
 * Loads IssueDetails (`new_issuedetails`) for the parent issue, equivalent to:
 * SortByColumns(Filter(IssueDetails, IssueID = IssueId1), "ID", Descending)
 */
export function IssueLogsModal({ issueId, onClose }: Props) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const guidRaw = issueId.replace(/[{}]/g, '').trim();
    if (!guidRaw) {
      setRows([]);
      setLoading(false);
      return;
    }
    const parentNorm = normalizeGuid(guidRaw);
    setLoading(true);
    setLoadNote(null);
    try {
      const orderBy = ['new_issuedetailid desc'] as string[];
      const filterAttempts = [
        `new_issueid eq '${guidRaw}'`,
        `_new_issue_value eq ${guidRaw}`,
        `_new_issue_value eq '${guidRaw}'`,
      ];

      for (const filter of filterAttempts) {
        const res = await New_issuedetailsService.getAll({ top: 500, orderBy, filter });
        if (res.success && res.data && res.data.length > 0) {
          setRows(sortByDetailIdDesc(res.data as unknown as Array<Record<string, unknown>>));
          setLoading(false);
          return;
        }
      }

      const all = await New_issuedetailsService.getAll({ top: 2000, orderBy: ['createdon desc'] });
      if (!all.success || !all.data?.length) {
        setRows([]);
        setLoadNote('No log rows returned from Dataverse.');
        setLoading(false);
        return;
      }
      const filtered = (all.data as unknown as Array<Record<string, unknown>>).filter((r) =>
        rowMatchesParentIssue(r, parentNorm),
      );
      if (filtered.length === 0) {
        setLoadNote(
          'No Issue Details rows linked to this issue. If your environment uses a different lookup field, extend the filter in IssueLogsModal.',
        );
      }
      setRows(sortByDetailIdDesc(filtered));
    } catch {
      setRows([]);
      setLoadNote('Failed to load issue logs.');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="issue-logs-title">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div className="relative flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
          <h2 id="issue-logs-title" className="text-base font-semibold text-primary">
            Issue logs
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && <ScreenLoader overlay className="min-h-[120px] rounded-lg" />}
          {!loading && loadNote && rows.length === 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{loadNote}</p>
          )}
          {!loading && rows.length === 0 && !loadNote && (
            <p className="text-sm text-gray-500 text-center py-8">No issue log entries for this issue.</p>
          )}
          <ul className="space-y-3">
            {rows.map((row) => {
              const key = String(row.new_issuedetailid ?? Math.random());
              const by = String(row.createdbyname ?? row.owneridname ?? '—').trim() || '—';
              const when = formatLogWhen(row.new_issueraiseddate ?? row.createdon);
              const st = String(row.new_issuestatusname ?? '—');
              const ia = String(row.new_issueimpactedarea ?? '—');
              const resp = String(row.new_issueresponse ?? '—');
              const desc = String(row.new_description ?? '—');
              return (
                <li
                  key={key}
                  className="rounded-lg border-2 border-[#d4b06a]/70 bg-white px-3 py-3 text-[12px] text-gray-800 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="font-medium text-primary underline decoration-secondary/50">{by}</span>
                    <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">{when}</span>
                  </div>
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Issue Status</p>
                      <p className="text-[11px] text-gray-800">{st}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Issue Impacted Area</p>
                      <p className="text-[11px] text-gray-800 break-words">{ia}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Issue Response</p>
                      <p className="text-[11px] text-gray-800 break-words">{resp}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Issue Description</p>
                    <p className="text-[11px] text-gray-800 whitespace-pre-wrap break-words">{desc}</p>
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

import { useCallback, useEffect, useState } from 'react';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';

const CATEGORIES = [
  'Program Code',
  'KPI',
  'Benefits',
  'Project Category',
  'Sector',
  'Milestone',
  'Project Code',
  'Stage',
  'Report Type',
  'Specialization',
  'Meeting Category',
  'Deliverables',
  'Industry',
  'Country',
  'Region',
  'Currency',
  'Time',
  'Shift',
  'Holiday',
  'Methodology',
] as const;

const CATEGORY_BY_VALUE = new Map<number, string>(
  CATEGORIES.map((label, idx) => [100000000 + idx, label]),
);

function categoryText(row: EnjazMasterDataRow): string {
  const named = String(row.new_categoryname ?? '').trim();
  if (named) return named;
  const raw = row.new_category;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isNaN(num) && CATEGORY_BY_VALUE.has(num)) return CATEGORY_BY_VALUE.get(num)!;
  return String(raw ?? '-');
}

function statusText(row: EnjazMasterDataRow): string {
  const raw = String(row.new_statusname ?? row.new_status ?? '').toLowerCase();
  if (raw.includes('inactive') || raw === '100000001' || raw === '1') return 'Inactive';
  return 'Active';
}

export default function DummyMasterDataScreen() {
  const [rows, setRows] = useState<EnjazMasterDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await EnjazMasterDataService.getAll({
        top: 500,
        orderBy: ['new_code asc'],
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load master data');
      setRows(res.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-[#2d356b]">Dummy - ENJAZ Master Data</h2>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="h-9 px-4 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {message && <p className="text-sm text-gray-700 mb-3">{message}</p>}
      <div className="overflow-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-[760px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-left text-[11px] uppercase text-gray-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Code (ID)</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>Loading records...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>No records found.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.new_enjazmasterdataid ?? `${row.new_enjazmasterdata1}-${row.new_code}`)} className="border-b border-gray-100 text-sm text-gray-700">
                  <td className="px-3 py-2">{String(row.new_enjazmasterdata1 ?? '-')}</td>
                  <td className="px-3 py-2">{categoryText(row)}</td>
                  <td className="px-3 py-2">{String(row.new_code ?? '-')}</td>
                  <td className="px-3 py-2">{statusText(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

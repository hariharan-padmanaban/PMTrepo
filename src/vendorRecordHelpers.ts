import type { VendorRow } from './services/VendorsService';

const V_RE = /^V(\d+)$/i;

export function vendorDisplayId(r: VendorRow): string {
  const a = String(r.new_appstatus ?? '').trim();
  if (V_RE.test(a)) return a;
  if (a) return a;
  const id = String(r.new_vendorid ?? '').replace(/[{}]/g, '');
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function isVendorRowActive(r: VendorRow): boolean {
  const n = Number(r.statecode);
  if (n === 1) return false;
  const name = String(r.statecodename ?? '').toLowerCase();
  if (name === 'inactive') return false;
  return true;
}

export function vendorAuditLines(r: VendorRow): { label: string; value: string }[] {
  return [
    { label: 'Record ID', value: String(r.new_vendorid ?? '—') },
    { label: 'Vendor code', value: vendorDisplayId(r) },
    { label: 'Created on', value: formatDt(r.createdon) },
    { label: 'Modified on', value: formatDt(r.modifiedon) },
  ];
}

function formatDt(v: unknown): string {
  if (v == null || v === '') return '—';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

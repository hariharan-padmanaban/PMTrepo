import type { ClientRow } from './services/ClientsService';

const CL_RE = /^CL(\d+)$/i;

export function clientDisplayId(r: ClientRow): string {
  const a = String(r.new_appstatus ?? '').trim();
  if (CL_RE.test(a)) return a;
  if (a) return a;
  const id = String(r.new_clientid ?? '').replace(/[{}]/g, '');
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

/** Dataverse: statecode 0 = Active, 1 = Inactive. */
export function isClientRowActive(r: ClientRow): boolean {
  const n = Number(r.statecode);
  if (n === 1) return false;
  const name = String(r.statecodename ?? '').toLowerCase();
  if (name === 'inactive') return false;
  return true;
}

export function clientAuditLines(r: ClientRow): { label: string; value: string }[] {
  return [
    { label: 'Record ID', value: String(r.new_clientid ?? '—') },
    { label: 'Client code', value: clientDisplayId(r) },
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

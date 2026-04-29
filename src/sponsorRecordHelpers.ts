import type { SponsorRow } from './services/SponsorsService';

export function sponsorDisplayId(r: SponsorRow): string {
  const id = String(r.new_sponsorid ?? '').replace(/[{}]/g, '');
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function isSponsorRowActive(r: SponsorRow): boolean {
  const n = Number(r.statecode);
  if (n === 1) return false;
  const name = String(r.statecodename ?? '').toLowerCase();
  if (name === 'inactive') return false;
  return true;
}

export function sponsorAuditLines(r: SponsorRow): { label: string; value: string }[] {
  return [
    { label: 'Record ID', value: String(r.new_sponsorid ?? '—') },
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

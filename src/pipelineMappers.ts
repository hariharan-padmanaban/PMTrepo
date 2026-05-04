/**
 * new_pipeline (Dataverse) ↔ Business Pipeline UI row shape.
 */
import type { New_pipelines } from './generated/models/New_pipelinesModel';

export type BusinessPipelineTableRow = {
  id: string;
  /**
   * “Pipeline name” in the grid — from `new_pipelinename` if the environment has that column;
   * otherwise the first part of `new_opportunityname` when it uses the ` — ` join (see
   * `mapFormToPipelineFields`), or the full primary name for legacy single-field rows.
   */
  pipelineName: string;
  /** Opportunity (second part of `new_opportunityname` after the join, or the full name if unsplit). */
  name: string;
  benefit: string;
  /** `new_potentialvalue` for display (e.g. 80, 100, 0.6). */
  potentialValue: string;
  /** Raw value for `<input type="text">` (empty if unset). */
  potentialValueInput: string;
  /** `YYYY-MM-DD` for `type="date"`; empty if unknown. */
  startDateYyyyMmDd: string;
  /** `YYYY-MM-DD` for tentative closure. */
  tentativeClosureYyyyMmDd: string;
  startDateLabel: string;
  endDateLabel: string;
  stage: string;
  /** Used for filters (e.g. client or category). */
  categoryName: string;
  /** From start date; 0 = unknown. */
  year: number;
};

function parseApiDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatLabel(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateToYyyyMmDd(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function splitProspectAndOpportunity(r: New_pipelines, idx: number): { pipelineName: string; opportunityName: string } {
  const rawOp = (r.new_opportunityname ?? '').trim();
  const sep = ' — ';
  const j = rawOp.indexOf(sep);
  if (j > 0) {
    return {
      pipelineName: rawOp.slice(0, j).trim() || '—',
      opportunityName: rawOp.slice(j + sep.length).trim() || rawOp,
    };
  }
  if (rawOp) {
    return { pipelineName: rawOp, opportunityName: rawOp };
  }
  return { pipelineName: '—', opportunityName: `Opportunity ${idx + 1}` };
}

function formatPotentialValueDisplay(n: number): string {
  const t = Math.trunc(n);
  if (n === t || Math.abs(n - t) < 1e-6) return String(t);
  return String(n);
}

export function newPipelineToTableRow(r: New_pipelines, idx: number): BusinessPipelineTableRow {
  const start = parseApiDate(r.new_startdate);
  const end = parseApiDate(r.new_tentativeclosure);
  const n = r.new_potentialvalue != null ? Number(r.new_potentialvalue) : NaN;
  const hasNum = Number.isFinite(n);
  const potentialValue = hasNum ? formatPotentialValueDisplay(n) : '—';
  const { pipelineName, opportunityName: name } = splitProspectAndOpportunity(r, idx);
  return {
    id: String(r.new_pipelineid ?? `pipe-${idx}`),
    pipelineName,
    name,
    benefit: (r.new_benefits ?? '—').trim() || '—',
    potentialValue,
    potentialValueInput: hasNum ? formatPotentialValueDisplay(n) : '',
    startDateYyyyMmDd: dateToYyyyMmDd(start),
    tentativeClosureYyyyMmDd: dateToYyyyMmDd(end),
    startDateLabel: formatLabel(start),
    endDateLabel: formatLabel(end),
    stage: (r.new_stageofopportunity ?? '—').trim() || '—',
    categoryName: (r.new_clientname ?? '—').trim() || '—',
    year: start ? start.getFullYear() : 0,
  };
}

function dateYyyyMmDdToIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/** Digits and at most one `.` (for potential value, millions). */
export function sanitizePotentialValueInput(raw: string): string {
  let t = raw.replace(/[^0-9.]/g, '');
  const i = t.indexOf('.');
  if (i !== -1) {
    t = `${t.slice(0, i + 1)}${t.slice(i + 1).replace(/\./g, '')}`;
  }
  return t;
}

function parsePotentialValueMillions(s: string): number {
  const t = s.trim();
  if (t === '' || t === '.') {
    throw new Error('Enter a potential value (number, millions).');
  }
  if (!/^\d+(\.\d*)?$|^\d*\.\d+$/.test(t)) {
    throw new Error('Potential value may only include digits and a decimal point.');
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Potential value must be a valid non-negative number.');
  }
  return n;
}

function mapFormToPipelineFields(form: {
  pipelineName: string;
  opportunityName: string;
  potentialValue: string;
  benefits: string;
  clientName: string;
  stage: string;
  startDate: string;
  tentativeClosure: string;
}): Record<string, unknown> {
  const pipe = form.pipelineName.trim();
  const opportunity = form.opportunityName.trim();
  // Many `new_pipeline` tables do not expose a separate `new_pipelinename` column. Store both
  // labels in the primary name `new_opportunityname` so create/update work across orgs.
  const new_opportunityname =
    pipe && opportunity
      ? `${pipe} — ${opportunity}`.slice(0, 850)
      : (opportunity || pipe).slice(0, 850);

  const n = parsePotentialValueMillions(sanitizePotentialValueInput(form.potentialValue));

  return {
    new_opportunityname,
    new_benefits: form.benefits.trim().slice(0, 100) || '—',
    new_clientname: form.clientName.trim().slice(0, 100),
    new_stageofopportunity: form.stage.trim().slice(0, 100),
    new_potentialvalue: n,
    new_startdate: dateYyyyMmDdToIso(form.startDate),
    new_tentativeclosure: dateYyyyMmDdToIso(form.tentativeClosure),
  };
}

/**
 * Map Add Pipeline form to Dataverse. Pipeline name + opportunity are stored in
 * `new_opportunityname` as `Pipeline — Opportunity` (primary name) unless one part is
 * empty. `clientName` is `new_clientname` from the selected **Clients** row.
 * Does not set `new_pipelinename` (often missing on the table; avoid OData errors).
 */
export function buildNewPipelineCreateBody(form: {
  pipelineName: string;
  opportunityName: string;
  potentialValue: string;
  benefits: string;
  clientName: string;
  stage: string;
  startDate: string;
  tentativeClosure: string;
}): Record<string, unknown> {
  return { ...mapFormToPipelineFields(form), statecode: 0 };
}

/** Update existing row in `new_pipeline` (no `statecode` override). */
export function buildNewPipelineUpdateBody(form: {
  pipelineName: string;
  opportunityName: string;
  potentialValue: string;
  benefits: string;
  clientName: string;
  stage: string;
  startDate: string;
  tentativeClosure: string;
}): Record<string, unknown> {
  return mapFormToPipelineFields(form);
}

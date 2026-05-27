import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

/** Figma table spec: positive budget = green + downward arrow; negative = red + upward. */
export function TableBudgetDisplay({ value }: { value: string }): ReactNode {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—' || raw === '-') {
    return <span className="tabular-nums text-[#374151]">{raw || '—'}</span>;
  }
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  const hasNum = Number.isFinite(n) && /[0-9]/.test(raw);
  const isNeg = hasNum && n < 0;
  const isPos = hasNum && n > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 tabular-nums ${
        isNeg ? 'text-[#DC2626]' : isPos ? 'text-[#16A34A]' : 'text-[#374151]'
      }`}
    >
      {isPos ? <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
      {isNeg ? <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
      <span>{raw}</span>
    </span>
  );
}

/**
 * Maps portfolio / project row status to `.enj-table-status--*` modifiers (see index.css).
 */
export function portfolioProjectStatusBadgeClass(statusKey: string, statusBucket: string): string {
  if (statusKey.includes('delay')) return 'enj-table-status--delayed';
  if (statusBucket === 'completed') return 'enj-table-status--completed';
  if (statusBucket === 'onTrack') return 'enj-table-status--ontrack';
  return 'enj-table-status--neutral';
}

/** Program list table (status label text only, no project bucket). */
export function programTableStatusBadgeClass(statusLabel: string): string {
  const s = statusLabel.toLowerCase();
  if (s.includes('delayed')) return 'enj-table-status--delayed';
  if (s.includes('on hold')) return 'enj-table-status--neutral';
  return 'enj-table-status--ontrack';
}

/** Feedback list — satisfaction level column (matches Projects status pills). */
export function feedbackSatisfactionStatusClass(label: string): string {
  const s = label.toLowerCase();
  if (s.includes('unsatisfied')) return 'enj-table-status--delayed';
  if (s.includes('very')) return 'enj-table-status--completed';
  return 'enj-table-status--ontrack';
}

/** Feedback list — project phase column (matches Projects status pills). */
export function feedbackPhaseStatusClass(label: string): string {
  const s = label.toLowerCase();
  if (s === 'live') return 'enj-table-status--ontrack';
  return 'enj-table-status--neutral';
}

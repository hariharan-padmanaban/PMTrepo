import { Calendar } from 'lucide-react';

/** Light lavender header bar — Portfolio accordion project table Timeline column. */
const TIMELINE_HEADER_BG = '#E8E4EF';

export function formatPortfolioTimelineDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** Column header cell for nested Portfolio project tables. */
export function PortfolioProjectTimelineTh() {
  return (
    <th
      className="border-0 p-0 align-middle"
      style={{
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
        backgroundColor: TIMELINE_HEADER_BG,
        height: '44px',
        verticalAlign: 'middle',
      }}
    >
      <div className="px-4 py-2.5 text-left text-xs font-medium text-[#4B5563]">Timeline</div>
    </th>
  );
}

/** Start / end dates body — white panel with dotted divider (matches design). */
export function PortfolioProjectTimelineDates({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  return (
    <div className="flex min-w-[220px] items-stretch bg-white">
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="text-xs font-bold leading-tight text-[#111827]">Start date</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-normal text-[#6B7A99]">
          <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-[#9CA3AF]" aria-hidden />
          <span className="whitespace-nowrap">{startDate}</span>
        </p>
      </div>
      <div className="my-3 w-px shrink-0 border-l border-dotted border-[#C5CAD6]" aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="text-xs font-bold leading-tight text-[#111827]">End date</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-normal text-[#6B7A99]">
          <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-[#9CA3AF]" aria-hidden />
          <span className="whitespace-nowrap">{endDate}</span>
        </p>
      </div>
    </div>
  );
}

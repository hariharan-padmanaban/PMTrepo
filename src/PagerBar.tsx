import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PagerBarProps = {
  /** Current page (1-based). */
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** If true, both actions are inert (e.g. list loading). */
  disabled?: boolean;
  className?: string;
  /**
   * When `total` is 0, the bar is hidden unless this is set (e.g. "…", "0 records", "—" while loading/empty).
   */
  emptyStateLabel?: string;
};

/**
 * Page index + chevron style: `1-5` = current page 1 of 5 total pages, with ‹ › controls.
 */
export function PagerBar({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
  disabled = false,
  className = '',
  emptyStateLabel,
}: PagerBarProps) {
  const navBtn =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b28a44]/50 disabled:cursor-not-allowed';

  if (total <= 0) {
    if (emptyStateLabel == null) return null;
    return (
      <div className={`flex w-full min-w-0 items-center justify-end ${className}`.trim()}>
        <div className="flex min-w-0 items-center gap-4">
          <p className="min-w-0 shrink-0 text-sm tabular-nums text-gray-900">{emptyStateLabel}</p>
          <div className="flex shrink-0 items-center gap-0.5" aria-label="Pagination">
            <button
              type="button"
              onClick={onPrev}
              disabled
              className={`${navBtn} text-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed`}
              aria-label="Previous page"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled
              className={`${navBtn} text-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed`}
              aria-label="Next page"
            >
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const canPrev = safePage > 1 && !disabled;
  const canNext = safePage < totalPages && !disabled;

  return (
    <div className={`flex w-full min-w-0 items-center justify-end ${className}`.trim()}>
      <div className="flex min-w-0 items-center gap-4">
        <p
          className="min-w-0 shrink-0 text-sm tabular-nums text-gray-900"
          aria-label={`Page ${safePage} of ${totalPages}`}
        >
          {safePage}-{totalPages}
        </p>
        <div className="flex shrink-0 items-center gap-0.5" aria-label="Pagination">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            className={`${navBtn} text-gray-800 hover:bg-gray-100 disabled:text-gray-300`}
            aria-label="Previous page"
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={`${navBtn} text-gray-800 hover:bg-gray-100 disabled:text-gray-300`}
            aria-label="Next page"
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

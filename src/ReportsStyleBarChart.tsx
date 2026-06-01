export type ReportsBarChartItem = { name: string; value: number };

const BAR_COLORS = ['#59628a', '#d4a759', '#b28a44', '#60a5fa', '#d65257'] as const;

function formatListNumber(n: number) {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function truncateChartLabel(text: string, maxWidthPx: number, fontSize = 9): string {
  const avgCharPx = fontSize * 0.58;
  const maxChars = Math.max(3, Math.floor(maxWidthPx / avgCharPx));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

type ReportsStyleBarChartProps = {
  bars: ReportsBarChartItem[];
  className?: string;
  ariaLabel?: string;
};

/** Vertical bar chart matching Reports → Project type styling. */
export function ReportsStyleBarChart({ bars, className = '', ariaLabel = 'Bar chart' }: ReportsStyleBarChartProps) {
  const tuples: Array<[string, number]> =
    bars.length > 0 ? bars.map((b) => [b.name, b.value] as [string, number]) : [['No data', 0]];
  const isEmpty = bars.length === 0;
  const max = isEmpty ? 1 : Math.max(1, ...tuples.map(([, v]) => v));
  const total = tuples.filter(([n]) => n !== 'No data').reduce((s, [, v]) => s + v, 0) || 0;
  const labelFs = 9;
  const y0 = 168;
  const hMax = 128;
  const x0 = 40;
  const plotRight = 240;
  const n = tuples.length;
  const innerW = plotRight - x0 - 16;
  const gap = Math.min(24, n > 1 ? innerW / (n * 4) : 0);
  const barW = Math.max(16, Math.min(28, (innerW - gap * (n - 1)) / Math.max(1, n)));
  const tickVals = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));

  return (
    <svg
      viewBox="0 0 260 200"
      className={`chart-svg h-full min-h-[200px] w-full max-h-[220px] ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      {tickVals.map((tv, i) => (
        <g key={`g-${i}`}>
          <line
            x1={x0}
            x2={plotRight}
            y1={y0 - (i / 4) * hMax}
            y2={y0 - (i / 4) * hMax}
            stroke="#f1f5f9"
          />
          <text
            x="28"
            y={4 + y0 - (i / 4) * hMax}
            fontSize={labelFs}
            fontWeight="600"
            textAnchor="end"
            fill="#374151"
          >
            {tv}
          </text>
        </g>
      ))}
      {tuples.map(([name, v], i) => {
        const nh = isEmpty || name === 'No data' ? 0 : (v / max) * hMax;
        const bx = x0 + 8 + i * (barW + gap);
        const slotW = barW + (i < n - 1 ? gap * 0.85 : 0);
        const pct = !isEmpty && total > 0 && name !== 'No data' ? Math.round((v / total) * 100) : 0;
        const displayName = truncateChartLabel(name, slotW, labelFs);
        const tooltip =
          isEmpty || name === 'No data'
            ? 'No data'
            : `${name}: ${formatListNumber(v)} (${pct}% of total)`;
        return (
          <g key={`${name}-${i}`} className="cursor-default">
            <title>{tooltip}</title>
            <rect
              x={bx}
              y={y0 - nh}
              width={barW}
              height={Math.max(0, nh)}
              rx="3"
              className="chart-bar"
              fill={BAR_COLORS[i % BAR_COLORS.length]}
            />
            <text
              x={bx + barW / 2}
              y={y0 + 20}
              textAnchor="middle"
              fontSize={labelFs}
              fontWeight="600"
              fill="#374151"
              pointerEvents="none"
            >
              {displayName}
            </text>
            <rect
              x={bx - 2}
              y={y0 - nh}
              width={barW + 4}
              height={Math.max(nh, 0) + 32}
              fill="transparent"
              pointerEvents="all"
            />
          </g>
        );
      })}
    </svg>
  );
}

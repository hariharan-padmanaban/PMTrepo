import { useState, type CSSProperties, type ReactNode } from 'react';
import { DonutChart, type DonutSlice } from './DonutChart';

type DonutChartCardProps = {
  title?: string;
  subtitle?: string;
  slices: DonutSlice[];
  ringWidth?: number;
  centerText?: string;
  centerSubtext?: string;
  /** Add extra elements at the bottom of the card (e.g., footnote text). */
  footer?: ReactNode;
  /** Optional className overrides for the outer card. */
  className?: string;
  /** Chart size variant — 'sm' for compact (h-36 w-36) or 'md' for default (h-48 w-48). */
  chartSize?: 'sm' | 'md';
};

/**
 * Unified donut chart card layout — chart on left, scrollable legend on right.
 * Hover on chart highlights legend item and reveals % share + value details.
 * Used across all roles (Business / Program / Project / Team) for consistency.
 */
export function DonutChartCard({
  title,
  subtitle,
  slices,
  ringWidth = 42,
  centerText,
  centerSubtext,
  footer,
  className = '',
  chartSize = 'md',
}: DonutChartCardProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const hoveredSlice = hoveredIdx >= 0 ? slices[hoveredIdx] : null;
  const hoveredPct = hoveredSlice ? Math.round((hoveredSlice.value / total) * 100) : 0;

  const computedCenterText = hoveredSlice
    ? hoveredSlice.value.toLocaleString()
    : centerText;
  const computedCenterSubtext = hoveredSlice
    ? `${hoveredPct}% • ${hoveredSlice.label}`
    : centerSubtext;

  const chartClass = chartSize === 'sm' ? 'h-36 w-36 chart-svg' : 'h-48 w-48 chart-svg';

  return (
    <div className={`flex flex-col rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[10px] text-gray-500">{subtitle}</p>}
        </div>
      )}

      <div className="flex flex-1 min-w-0 min-h-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center ml-3">
        {/* LEFT: Donut chart */}
        <div className="flex shrink-0 items-center justify-center">
          <DonutChart
            className={chartClass}
            showOuterLabels={false}
            ringWidth={ringWidth}
            slices={slices}
            centerText={computedCenterText}
            centerSubtext={computedCenterSubtext}
            externalHoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />
        </div>

        {/* RIGHT: Legend list */}
        <ul className="flex w-full min-w-0 flex-1 max-w-xs flex-col gap-1 sm:max-h-44 sm:overflow-y-auto sm:pr-1">
          {slices.length === 0 ? (
            <li className="text-[10px] text-gray-400">No data</li>
          ) : (
            slices.map((slice, idx) => {
              const pct = Math.round((slice.value / total) * 100);
              const isHovered = hoveredIdx === idx;
              const dimmed = hoveredIdx >= 0 && !isHovered;
              const itemStyle: CSSProperties = {
                backgroundColor: isHovered ? `${slice.color}14` : 'transparent',
                borderColor: isHovered ? `${slice.color}55` : 'transparent',
                opacity: dimmed ? 0.55 : 1,
                transition: 'background-color 180ms ease, border-color 180ms ease, opacity 180ms ease',
              };
              return (
                <li
                  key={`${slice.label}-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(-1)}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1"
                  style={itemStyle}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  <span
                    className="min-w-0 text-[10px] font-medium leading-tight text-gray-700"
                    title={slice.label}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100px',
                    }}
                  >
                    {slice.label}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-gray-900 ml-auto">
                    {slice.value.toLocaleString()}
                  </span>
                  <span
                    className="shrink-0 text-[9px] font-medium tabular-nums"
                    style={{ color: isHovered ? slice.color : '#94a3b8' }}
                  >
                    {pct}%
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

export type { DonutSlice };

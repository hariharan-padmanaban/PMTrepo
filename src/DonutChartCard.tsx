import { useState, type ReactNode } from 'react';
import { DonutChart, type DonutSlice } from './DonutChart';

type DonutChartCardProps = {
  title?: string;
  subtitle?: string;
  slices: DonutSlice[];
  ringWidth?: number;
  centerText?: string;
  /** @deprecated Ignored — center shows numeric count only; labels are in the legend. */
  centerSubtext?: string;
  /** Add extra elements at the bottom of the card (e.g., footnote text). */
  footer?: ReactNode;
  /** Optional className overrides for the outer card. */
  className?: string;
  /** Chart size variant — controls SVG viewBox and display box. */
  chartSize?: 'sm' | 'md' | 'lg';
};


const chartLayout: Record<
  NonNullable<DonutChartCardProps['chartSize']>,
  { pixelSize: number; chartClass: string; centerBoost: number; fontScale: number }
> = {
  sm: {
    pixelSize: 200,
    chartClass:
      'h-44 w-44 max-h-full max-w-full shrink-0 chart-svg',
    centerBoost: 0.75,
    fontScale: 0.75,
  },
  md: {
    pixelSize: 230,
    chartClass:
      'h-52 w-52 max-h-full max-w-full shrink-0 chart-svg',
    centerBoost: 0.79,
    fontScale: 0.82,
  },
  lg: {
    pixelSize: 260,
    chartClass:
      'h-60 w-60 max-h-full max-w-full shrink-0 chart-svg',
    centerBoost: 0.81,
    fontScale: 0.88,
  },
};

/**
 * Unified donut chart card with connector-line labels around the donut.
 * Hover pops the segment and updates the center value.
 */
export function DonutChartCard({
  title,
  subtitle,
  slices,
  ringWidth = 42,
  centerText,
  centerSubtext: _centerSubtext,
  footer,
  className = '',
  chartSize = 'md',
}: DonutChartCardProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);
  const layout = chartLayout[chartSize];
  const hoveredSlice = hoveredIdx >= 0 ? slices[hoveredIdx] : null;

  /** Center hole: numeric count only (labels live in legend / title). */
  const computedCenterText = hoveredSlice ? hoveredSlice.value.toLocaleString() : centerText;

  return (
    <div className={`flex min-h-0 flex-col rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 sm:p-4 ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="mb-3 shrink-0">
          {title && <h3 className="text-sm font-semibold text-[#232360]">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{subtitle}</p>}
        </div>
      )}

      <div className="relative flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-visible">
        {slices.length === 0 ? (
          <p className="text-[10px] text-gray-400">No data</p>
        ) : (
          <DonutChart
            className={layout.chartClass}
            size={layout.pixelSize}
            showOuterLabels
            ringWidth={ringWidth}
            slices={slices}
            centerText={computedCenterText}
            externalHoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
            centerFontBoost={layout.centerBoost}
            fontScale={layout.fontScale}
          />
        )}
      </div>

      {footer && <div className="mt-3 shrink-0 border-t border-gray-100 pt-2">{footer}</div>}
    </div>
  );
}

export type { DonutSlice } from './DonutChart';

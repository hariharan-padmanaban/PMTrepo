import type { CSSProperties } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
  /** Shown under the label in card legends (e.g. dimension or unit). */
  detail?: string;
};

type DonutChartProps = {
  slices: DonutSlice[];
  size?: number;
  ringWidth?: number;
  className?: string;
  centerText?: string;
  centerSubtext?: string;
  labelColor?: string;
  showOuterLabels?: boolean;
  fontScale?: number;
  /** Connector label font size in SVG px. */
  labelFontSize?: number;
  /**
   * Scales only the center label / sublabel inside the hole (readability).
   * Ring geometry unchanged unless you also pass `size` / `ringWidth`.
   */
  centerFontBoost?: number;
  /** Optional callback when a segment is hovered (gives segment index, -1 = none) */
  onHover?: (index: number) => void;
  /** Externally controlled hover state — overrides internal hover */
  externalHoveredIdx?: number;
};

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 320;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{displayValue}</>;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
) {
  const p1 = polar(cx, cy, rOuter, startDeg);
  const p2 = polar(cx, cy, rOuter, endDeg);
  const p3 = polar(cx, cy, rInner, endDeg);
  const p4 = polar(cx, cy, rInner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function shortDonutLabel(label: string, max = 12) {
  const text = label.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function DonutChart({
  slices,
  size = 240,
  ringWidth = 56,
  className,
  centerText,
  centerSubtext,
  labelColor = '#6f7f95',
  showOuterLabels = true,
  fontScale = 1,
  labelFontSize = 12,
  centerFontBoost = 1,
  onHover,
  externalHoveredIdx,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.32;
  /** Slightly wider hole keeps large center labels from overlapping the ring. */
  const rInner = rOuter - ringWidth * 0.46;
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const [internalHoveredIdx, setInternalHoveredIdx] = useState<number>(-1);
  const hoveredIdx = externalHoveredIdx !== undefined ? externalHoveredIdx : internalHoveredIdx;
  const [mounted, setMounted] = useState(false);
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const setHover = (idx: number) => {
    setInternalHoveredIdx(idx);
    onHover?.(idx);
  };

  const segments = slices.reduce<Array<DonutSlice & { start: number; end: number; mid: number; idx: number }>>(
    (acc, slice, idx) => {
      const start = acc.length === 0 ? -90 : acc[acc.length - 1].end;
      const sweep = Math.min((slice.value / total) * 360, 359.9999);
      const end = start + sweep;
      acc.push({
        ...slice,
        idx,
        start,
        end,
        mid: (start + end) / 2,
      });
      return acc;
    },
    [],
  );

  const hasHover = hoveredIdx >= 0;
  const visibleLabelIndices = new Set(
    [...segments]
      .filter((seg) => seg.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, segments.length > 4 ? 4 : segments.length)
      .map((seg) => seg.idx),
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ overflow: 'visible' }}
      onMouseLeave={() => setHover(-1)}
    >
      {segments.map((seg) => {
        const isHovered = hoveredIdx === seg.idx;
        const dimmed = hasHover && !isHovered;
        const offset = isHovered ? 10 : 0;
        const dx = offset * Math.cos((Math.PI / 180) * seg.mid);
        const dy = offset * Math.sin((Math.PI / 180) * seg.mid);

        const transform = mounted
          ? `translate(${dx}px, ${dy}px) scale(1)`
          : 'translate(0, 0) scale(0.6)';

        const segStyle: CSSProperties = {
          fill: seg.color,
          opacity: !mounted ? 0 : dimmed ? 0.45 : 1,
          transform,
          transformOrigin: `${cx}px ${cy}px`,
          transition: `transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1) ${seg.idx * 60}ms, opacity 220ms ease-out ${seg.idx * 60}ms, filter 200ms ease-out`,
          cursor: 'pointer',
          willChange: 'transform, opacity',
          filter: isHovered ? `drop-shadow(0 3px 8px ${seg.color}1A)` : 'none',
        };

        return (
          <path
            key={`seg-${chartId}-${seg.idx}`}
            d={donutSlicePath(cx, cy, rOuter, rInner, seg.start, seg.end)}
            stroke="none"
            style={segStyle}
            onMouseEnter={() => setHover(seg.idx)}
          >
            <title>{`${seg.label}: ${seg.value}`}</title>
          </path>
        );
      })}

      {showOuterLabels &&
        segments.map((seg) => {
          const isHovered = hoveredIdx === seg.idx;
          const shouldShowLabel = segments.length <= 4 || visibleLabelIndices.has(seg.idx) || isHovered;
          if (!shouldShowLabel) return null;
          const a = polar(cx, cy, rOuter + 3, seg.mid);
          const b = polar(cx, cy, rOuter + 24, seg.mid);
          const right = Math.cos((Math.PI / 180) * seg.mid) >= 0;
          const tx = b.x + (right ? 10 : -10);
          const anchor: CSSProperties['textAnchor'] = right ? 'start' : 'end';
          const connectorColor = seg.color || labelColor;
          return (
            <g
              key={`label-${chartId}-${seg.idx}`}
              onMouseEnter={() => setHover(seg.idx)}
              style={{
                cursor: 'pointer',
                opacity: mounted ? 1 : 0,
                transition: `opacity 320ms ease-out ${300 + seg.idx * 40}ms`,
              }}
            >
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={connectorColor}
                strokeWidth={isHovered ? 1.6 : 1.2}
                strokeLinecap="round"
                opacity={isHovered ? 1 : 0.9}
              />
              <text
                x={tx}
                y={b.y - 3}
                fill={connectorColor}
                fontSize={labelFontSize}
                fontWeight={isHovered ? 700 : 600}
                textAnchor={anchor}
                style={{ transition: 'fill 200ms ease, font-weight 200ms ease' }}
              >
                <tspan x={tx}>
                  <AnimatedNumber value={seg.value} />
                </tspan>
                <tspan x={tx} dy={labelFontSize + 1}>
                  {shortDonutLabel(seg.label)}
                </tspan>
              </text>
            </g>
          );
        })}

      {centerText && (
        <text
          x={cx}
          y={cy}
          dy={centerSubtext ? -5 : 0}
          fill="#151d5d"
          fontSize={(centerSubtext ? 15 : 24) * fontScale * centerFontBoost}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline={centerSubtext ? 'auto' : 'middle'}
          style={{ pointerEvents: 'none' }}
        >
          {centerText}
        </text>
      )}
      {centerSubtext && (
        <text
          x={cx}
          y={cy}
          dy={12}
          fill="#64748b"
          fontSize={8.25 * fontScale * centerFontBoost}
          fontWeight={500}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {centerSubtext}
        </text>
      )}
    </svg>
  );
}

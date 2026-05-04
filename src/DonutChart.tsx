import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
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

export function DonutChart({
  slices,
  size = 240,
  ringWidth = 56,
  className,
  centerText,
  centerSubtext,
  labelColor = '#6f7f95',
  showOuterLabels = true,
  onHover,
  externalHoveredIdx,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.32;
  const rInner = rOuter - ringWidth * 0.5;
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const [internalHoveredIdx, setInternalHoveredIdx] = useState<number>(-1);
  const hoveredIdx = externalHoveredIdx !== undefined ? externalHoveredIdx : internalHoveredIdx;
  const [mounted, setMounted] = useState(false);
  const uid = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const setHover = (idx: number) => {
    setInternalHoveredIdx(idx);
    onHover?.(idx);
  };

  let angle = -90;
  const segments = slices.map((slice, idx) => {
    const sweep = Math.min((slice.value / total) * 360, 359.9999);
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = (start + end) / 2;
    return { ...slice, start, end, mid, idx };
  });

  const hasHover = hoveredIdx >= 0;

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
            key={`seg-${uid}-${seg.idx}`}
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
          const a = polar(cx, cy, rOuter + 2, seg.mid);
          const b = polar(cx, cy, rOuter + 24, seg.mid);
          const right = Math.cos((Math.PI / 180) * seg.mid) >= 0;
          const tx = b.x + (right ? 10 : -10);
          const anchor: CSSProperties['textAnchor'] = right ? 'start' : 'end';
          const isHovered = hoveredIdx === seg.idx;
          return (
            <g
              key={`label-${uid}-${seg.idx}`}
              onMouseEnter={() => setHover(seg.idx)}
              style={{
                cursor: 'pointer',
                opacity: mounted ? 1 : 0,
                transition: `opacity 320ms ease-out ${300 + seg.idx * 40}ms`,
              }}
            >
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={labelColor} strokeWidth={1.3} />
              <text
                x={tx}
                y={b.y - 4}
                fill={isHovered ? seg.color : labelColor}
                fontSize={13}
                fontWeight={isHovered ? 700 : 500}
                textAnchor={anchor}
                style={{ transition: 'fill 200ms ease, font-weight 200ms ease' }}
              >
                <AnimatedNumber value={seg.value} />
              </text>
              <text x={tx} y={b.y + 12} fill={labelColor} fontSize={8.5} textAnchor={anchor}>
                {seg.label}
              </text>
            </g>
          );
        })}

      {centerText && (
        <text x={cx} y={cy - 2} fill="#151d5d" fontSize={15} fontWeight={700} textAnchor="middle" style={{ pointerEvents: 'none' }}>
          {centerText}
        </text>
      )}
      {centerSubtext && (
        <text x={cx} y={cy + 12} fill="#94a3b8" fontSize={8} textAnchor="middle" style={{ pointerEvents: 'none' }}>
          {centerSubtext}
        </text>
      )}
    </svg>
  );
}

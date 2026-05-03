import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';

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
};

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    const from = displayValue;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 320;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // Ease-out curve for subtle value transition.
      const eased = 1 - (1 - p) * (1 - p);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, displayValue]);
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
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.32;
  const rInner = rOuter - ringWidth * 0.5;
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const clipId = useMemo(
    () => `donut-reveal-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  let angle = -90;
  const segments = slices.map((slice) => {
    // Cap at 359.9999 — a full 360° arc has identical start/end points and renders nothing.
    const sweep = Math.min((slice.value / total) * 360, 359.9999);
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = (start + end) / 2;
    const isHovered = hoveredLabel === slice.label;
    const offset = isHovered ? 12 : 0;
    const hoverDx = offset * Math.cos((Math.PI / 180) * mid);
    const hoverDy = offset * Math.sin((Math.PI / 180) * mid);
    return { ...slice, start, end, mid, hoverDx, hoverDy, isHovered };
  });

  const glowId = `donut-glow-${clipId}`;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={size * 0.6} />
        </clipPath>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {segments.map((seg) => (
          <radialGradient key={`grad-${clipId}-${seg.label}`} id={`grad-${clipId}-${seg.label}`}>
            <stop offset="60%" stopColor={seg.color} stopOpacity={1} />
            <stop offset="100%" stopColor={seg.color} stopOpacity={0.88} />
          </radialGradient>
        ))}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {segments.map((seg) => (
          <motion.path
            key={seg.label}
            d={donutSlicePath(cx, cy, rOuter, rInner, seg.start, seg.end)}
            fill={`url(#grad-${clipId}-${seg.label})`}
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
            className="chart-bar"
            onHoverStart={() => setHoveredLabel(seg.label)}
            onHoverEnd={() => setHoveredLabel(null)}
            animate={{
              x: seg.hoverDx,
              y: seg.hoverDy,
              opacity: hoveredLabel && hoveredLabel !== seg.label ? 0.35 : 1,
              filter: seg.isHovered ? `url(#${glowId})` : 'none',
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              cursor: 'pointer',
              filter: seg.isHovered
                ? `drop-shadow(0 6px 14px ${seg.color}55)`
                : 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.06))',
            }}
          >
            <title>{`${seg.label}: ${seg.value}`}</title>
          </motion.path>
        ))}
      </g>

      {showOuterLabels &&
        segments.map((seg) => {
          const a = polar(cx, cy, rOuter + 2, seg.mid);
          const b = polar(cx, cy, rOuter + 24, seg.mid);
          const right = Math.cos((Math.PI / 180) * seg.mid) >= 0;
          const tx = b.x + (right ? 10 : -10);
          const anchor: CSSProperties['textAnchor'] = right ? 'start' : 'end';
          return (
            <g
              key={`${seg.label}-label`}
              onMouseEnter={() => setHoveredLabel(seg.label)}
              onMouseLeave={() => setHoveredLabel(null)}
              style={{ cursor: 'default' }}
            >
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={labelColor} strokeWidth={1.3} />
              <text x={tx} y={b.y - 4} fill={labelColor} fontSize={13} fontWeight={500} textAnchor={anchor}>
                <AnimatedNumber value={seg.value} />
              </text>
              <text x={tx} y={b.y + 12} fill={labelColor} fontSize={8.5} textAnchor={anchor}>
                {seg.label}
              </text>
            </g>
          );
        })}

      {centerText && (
        <text x={cx} y={cy - 2} fill="#151d5d" fontSize={15} fontWeight={700} textAnchor="middle">
          {centerText}
        </text>
      )}
      {centerSubtext && (
        <text x={cx} y={cy + 12} fill="#94a3b8" fontSize={8} textAnchor="middle">
          {centerSubtext}
        </text>
      )}
    </svg>
  );
}

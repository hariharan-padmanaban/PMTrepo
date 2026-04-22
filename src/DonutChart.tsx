import type { CSSProperties } from 'react';

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

  let angle = -90;
  const segments = slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = (start + end) / 2;
    return { ...slice, start, end, mid };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className}>
      {segments.map((seg) => (
        <path
          key={seg.label}
          d={donutSlicePath(cx, cy, rOuter, rInner, seg.start, seg.end)}
          fill={seg.color}
          stroke="#ffffff"
          strokeWidth={2}
          className="chart-bar"
        />
      ))}

      {showOuterLabels &&
        segments.map((seg) => {
          const a = polar(cx, cy, rOuter + 2, seg.mid);
          const b = polar(cx, cy, rOuter + 24, seg.mid);
          const right = Math.cos((Math.PI / 180) * seg.mid) >= 0;
          const tx = b.x + (right ? 10 : -10);
          const anchor: CSSProperties['textAnchor'] = right ? 'start' : 'end';
          return (
            <g key={`${seg.label}-label`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={labelColor} strokeWidth={1.3} />
              <text x={tx} y={b.y - 4} fill={labelColor} fontSize={13} fontWeight={500} textAnchor={anchor}>
                {seg.value}
              </text>
              <text x={tx} y={b.y + 12} fill={labelColor} fontSize={8.5} textAnchor={anchor}>
                {seg.label}
              </text>
            </g>
          );
        })}

      {centerText && (
        <text x={cx} y={cy - 2} fill="#2f3150" fontSize={15} fontWeight={700} textAnchor="middle">
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

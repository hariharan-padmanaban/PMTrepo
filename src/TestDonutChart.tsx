import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type TestSlice = {
  label: string;
  value: number;
  color: string;
};

const SAMPLE_DATA: TestSlice[] = [
  { label: 'Finance', value: 450, color: '#1667de' },
  { label: 'Operations', value: 320, color: '#3b3a80' },
  { label: 'Marketing', value: 280, color: '#d3525a' },
  { label: 'Engineering', value: 380, color: '#10b981' },
  { label: 'HR', value: 150, color: '#fbbf24' },
];

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

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const from = displayValue;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, displayValue]);
  return <>{displayValue.toLocaleString()}</>;
}

export function TestDonutChart() {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const size = 480;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.34;
  const rInner = rOuter - 70;

  const total = SAMPLE_DATA.reduce((sum, s) => sum + s.value, 0);

  const segments = useMemo(() => {
    let angle = -90;
    return SAMPLE_DATA.map((slice) => {
      const sweep = Math.min((slice.value / total) * 360, 359.9999);
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const mid = (start + end) / 2;
      const pct = Math.round((slice.value / total) * 100);
      return { ...slice, start, end, mid, pct };
    });
  }, [total]);

  const hoveredSlice = segments.find((s) => s.label === hoveredLabel);
  const activeValue = hoveredSlice ? hoveredSlice.value : total;
  const activeLabel = hoveredSlice ? hoveredSlice.label : 'Total Budget';
  const activeColor = hoveredSlice ? hoveredSlice.color : '#151d5d';

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#151d5d]">Donut Chart Test Lab</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hover over any segment to see smooth animation, scale-up, and detail popup
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAnimKey((k) => k + 1)}
          className="rounded-lg bg-gradient-to-r from-[#b28a44] to-[#d4a759] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
        >
          Replay Animation
        </button>
      </div>

      {/* Main Chart Area */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Donut Chart - 2/3 width */}
        <div className="relative col-span-2 flex items-center justify-center rounded-2xl bg-gradient-to-br from-white via-white to-blue-50/30 p-8 shadow-xl ring-1 ring-gray-100">
          <motion.svg
            key={animKey}
            viewBox={`0 0 ${size} ${size}`}
            className="h-full max-h-[500px] w-full"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <defs>
              {segments.map((seg) => (
                <radialGradient key={`grad-${seg.label}`} id={`grad-${seg.label}`}>
                  <stop offset="60%" stopColor={seg.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={seg.color} stopOpacity={0.85} />
                </radialGradient>
              ))}
              <filter id="glow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Animated segments */}
            {segments.map((seg, idx) => {
              const isHovered = hoveredLabel === seg.label;
              const isOtherHovered = hoveredLabel != null && !isHovered;
              const offset = isHovered ? 16 : 0;
              const dx = offset * Math.cos((Math.PI / 180) * seg.mid);
              const dy = offset * Math.sin((Math.PI / 180) * seg.mid);

              return (
                <motion.path
                  key={`${animKey}-${seg.label}`}
                  d={donutSlicePath(cx, cy, rOuter, rInner, seg.start, seg.end)}
                  fill={`url(#grad-${seg.label})`}
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: isOtherHovered ? 0.35 : 1,
                    x: dx,
                    y: dy,
                    filter: isHovered ? 'url(#glow)' : 'none',
                  }}
                  transition={{
                    scale: { duration: 0.6, delay: idx * 0.08, ease: 'backOut' },
                    opacity: { duration: 0.25 },
                    x: { duration: 0.3, ease: 'easeOut' },
                    y: { duration: 0.3, ease: 'easeOut' },
                  }}
                  onMouseEnter={() => setHoveredLabel(seg.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                  style={{
                    cursor: 'pointer',
                    transformOrigin: `${cx}px ${cy}px`,
                    filter: isHovered
                      ? `drop-shadow(0 8px 16px ${seg.color}55)`
                      : 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.08))',
                  }}
                />
              );
            })}

            {/* Center labels */}
            <g style={{ pointerEvents: 'none' }}>
              <motion.text
                x={cx}
                y={cy - 16}
                textAnchor="middle"
                fontSize="13"
                fontWeight="500"
                fill="#94a3b8"
                animate={{ opacity: 1 }}
                key={`label-${activeLabel}`}
                initial={{ opacity: 0, y: cy - 24 }}
                transition={{ duration: 0.3 }}
              >
                {activeLabel.toUpperCase()}
              </motion.text>
              <motion.text
                x={cx}
                y={cy + 16}
                textAnchor="middle"
                fontSize="42"
                fontWeight="800"
                fill={activeColor}
                key={`val-${activeValue}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: 'backOut' }}
              >
                <AnimatedNumber value={activeValue} />
              </motion.text>
              <motion.text
                x={cx}
                y={cy + 38}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#94a3b8"
              >
                {hoveredSlice ? `${hoveredSlice.pct}% of total` : 'across 5 departments'}
              </motion.text>
            </g>
          </motion.svg>

          {/* Floating Tooltip */}
          <AnimatePresence>
            {hoveredSlice && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none absolute right-6 top-6 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-2xl"
                style={
                  {
                    borderLeft: `4px solid ${hoveredSlice.color}`,
                  } as CSSProperties
                }
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: hoveredSlice.color }}
                  />
                  <span className="text-sm font-semibold text-gray-800">{hoveredSlice.label}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-gray-900">
                    {hoveredSlice.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">units</span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-gray-500">
                  {hoveredSlice.pct}% of total budget
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend Panel - 1/3 width */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Departments</h3>
          <div className="flex flex-1 flex-col gap-2">
            {segments.map((seg, idx) => (
              <motion.div
                key={`${animKey}-leg-${seg.label}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.4 + idx * 0.06 }}
                onMouseEnter={() => setHoveredLabel(seg.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                className={`group cursor-pointer rounded-xl border p-3 transition-all ${
                  hoveredLabel === seg.label
                    ? 'border-transparent shadow-lg ring-2'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                }`}
                style={
                  hoveredLabel === seg.label
                    ? ({ ['--tw-ring-color' as string]: seg.color, backgroundColor: `${seg.color}10` } as CSSProperties)
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-9 w-9 shrink-0 rounded-lg shadow-sm transition-transform group-hover:scale-110"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{seg.label}</p>
                      <p className="text-[10px] text-gray-500">{seg.pct}% share</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-base font-bold tabular-nums text-gray-900">
                    {seg.value.toLocaleString()}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: seg.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${seg.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.6 + idx * 0.08, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              Grand Total
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#151d5d]">
              {total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Segments', value: SAMPLE_DATA.length, color: '#1667de' },
          { label: 'Largest', value: 'Finance', color: '#10b981' },
          { label: 'Animation', value: '✓ Smooth', color: '#fbbf24' },
          { label: 'Hover', value: '✓ Active', color: '#d3525a' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
            className="rounded-xl bg-white p-4 shadow-md ring-1 ring-gray-100"
            style={{ borderTop: `3px solid ${stat.color}` }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-bold text-gray-800">{stat.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

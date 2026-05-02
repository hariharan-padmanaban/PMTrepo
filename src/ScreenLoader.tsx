import { useEffect, useState } from 'react';

type ScreenLoaderProps = {
  label?: string;
  className?: string;
  overlay?: boolean;
};

export function ScreenLoader({
  label = 'Loading...',
  className = '',
  overlay = false,
}: ScreenLoaderProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`${
        overlay
          ? 'fixed inset-0 z-[120] bg-slate-900/20 backdrop-blur-[2px]'
          : 'min-h-[220px] w-full'
      } ${className} flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex min-w-[190px] flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white px-8 py-7 shadow-[0_8px_48px_rgba(15,23,42,0.12)]">
        {/* SVG spinner — sub-pixel smooth, GPU-composited */}
        <svg
          className="animate-spin"
          viewBox="0 0 44 44"
          fill="none"
          style={{ width: 44, height: 44, animationDuration: '700ms', animationTimingFunction: 'linear', willChange: 'transform' }}
        >
          {/* Track ring */}
          <circle cx="22" cy="22" r="18" stroke="#f1f5f9" strokeWidth="3.5" />
          {/* Gold arc — quarter circle with rounded caps */}
          <path
            d="M 22 4 A 18 18 0 0 1 40 22"
            stroke="#A08149"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[13px] font-semibold tracking-wide text-gray-500">{label}</span>
      </div>
    </div>
  );
}

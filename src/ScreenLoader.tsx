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
  return (
    <div
      className={`${overlay ? 'absolute inset-0 z-20 bg-white/75' : ''} ${className} flex items-center justify-center`}
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-300 border-t-[#b28a44]" />
        <span className="text-lg font-semibold text-gray-700">{label}</span>
      </div>
    </div>
  );
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const STORAGE_KEY = 'enjaz-theme-mode';
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialThemeMode());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('enjaz-dark', mode === 'dark');
    root.classList.toggle('enjaz-light', mode === 'light');
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return value;
}

export function ThemeModeToggle() {
  const { mode, setMode } = useThemeMode();

  return (
    <div className="relative mx-auto flex h-10 w-[82px] items-center justify-between overflow-visible rounded-full border border-gray-200 bg-[#f6f7fb] p-1 shadow-sm transition-colors">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1 h-8 w-8 rounded-full bg-white shadow-sm transition-all duration-300 ease-out ${
          mode === 'dark' ? 'left-[46px]' : 'left-1'
        }`}
      />
      <button
        type="button"
        onClick={() => setMode('light')}
        aria-label="Switch to light theme"
        className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 ${
          mode === 'light' ? 'text-[#151d5d]' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        onClick={() => setMode('dark')}
        aria-label="Switch to dark theme"
        className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 ${
          mode === 'dark' ? 'text-[#151d5d]' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Moon size={15} />
      </button>
    </div>
  );
}

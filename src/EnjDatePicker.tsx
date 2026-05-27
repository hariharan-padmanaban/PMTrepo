import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

type CalendarCell = { date: Date; inMonth: boolean };

function parseIso(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso);
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function compareDay(a: Date, b: Date): number {
  const ta = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const tb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return ta - tb;
}

function isBeforeMin(d: Date, minIso?: string): boolean {
  const min = minIso ? parseIso(minIso) : null;
  return min ? compareDay(d, min) < 0 : false;
}

function isAfterMax(d: Date, maxIso?: string): boolean {
  const max = maxIso ? parseIso(maxIso) : null;
  return max ? compareDay(d, max) > 0 : false;
}

function isDisabledDay(d: Date, minIso?: string, maxIso?: string): boolean {
  return isBeforeMin(d, minIso) || isAfterMax(d, maxIso);
}

function buildMonthGrid(view: Date): CalendarCell[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  const start = new Date(year, month, 1 - startOffset);
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}

function normalizeRange(start: Date | null, end: Date | null): { start: Date | null; end: Date | null } {
  if (!start || !end) return { start, end };
  if (compareDay(start, end) <= 0) return { start, end };
  return { start: end, end: start };
}

type CalendarPanelProps = {
  mode: 'single' | 'range';
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
  today: Date;
  min?: string;
  max?: string;
  draftStart: Date | null;
  draftEnd: Date | null;
  onDayClick: (day: Date) => void;
};

function CalendarPanel({
  mode,
  viewMonth,
  onViewMonthChange,
  today,
  min,
  max,
  draftStart,
  draftEnd,
  onDayClick,
}: CalendarPanelProps) {
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const range = normalizeRange(draftStart, draftEnd);

  const prevMonth = () => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const inRange = (day: Date) => {
    if (mode !== 'range' || !range.start || !range.end) return false;
    const c = compareDay(day, range.start);
    const e = compareDay(day, range.end);
    return c >= 0 && e <= 0;
  };

  return (
    <div className="enj-date-picker-panel">
      <div className="enj-date-picker-header">
        <button type="button" className="enj-date-picker-nav enj-date-picker-nav--prev" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <p className="enj-date-picker-month">{MONTH_NAMES[viewMonth.getMonth()]}</p>
        <button type="button" className="enj-date-picker-nav enj-date-picker-nav--next" onClick={nextMonth} aria-label="Next month">
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="enj-date-picker-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="enj-date-picker-weekday">
            {d}
          </span>
        ))}
      </div>

      <div className="enj-date-picker-grid">
        {cells.map(({ date, inMonth }) => {
          const disabled = isDisabledDay(date, min, max);
          const isToday = sameDay(date, today);
          const isStart = range.start && sameDay(date, range.start);
          const isEnd = range.end && sameDay(date, range.end);
          const isRangeMid = inRange(date) && !isStart && !isEnd;
          const isSelectedSingle = mode === 'single' && draftStart && sameDay(date, draftStart);

          let cellClass = 'enj-date-picker-day';
          if (!inMonth) cellClass += ' enj-date-picker-day--muted';
          if (disabled) cellClass += ' enj-date-picker-day--disabled';
          if (isToday && !isStart && !isEnd && !isSelectedSingle) cellClass += ' enj-date-picker-day--today';
          if (isStart || isEnd || isSelectedSingle) cellClass += ' enj-date-picker-day--endpoint';
          else if (isRangeMid) cellClass += ' enj-date-picker-day--in-range';

          return (
            <button
              key={toIso(date)}
              type="button"
              className={cellClass}
              disabled={disabled}
              onClick={() => onDayClick(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, active]);
}

type DatePickerFieldProps = {
  value: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  title?: string;
};

/** Single-date field with custom calendar popover (matches Enjaz date picker design). */
export function DatePickerField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  readOnly = false,
  className = '',
  placeholder = 'Select date',
  id: idProp,
  title,
}: DatePickerFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const parsed = parseIso(value);
  const [viewMonth, setViewMonth] = useState(() => parsed ?? today);
  const [draft, setDraft] = useState<Date | null>(parsed);

  useEffect(() => {
    if (!open) return;
    const d = parseIso(value);
    setDraft(d);
    setViewMonth(d ?? today);
  }, [open, value, today]);

  const close = useCallback(() => setOpen(false), []);

  useClickOutside(rootRef, close, open);

  const apply = () => {
    if (draft) onChange?.(toIso(draft));
    else onChange?.('');
    setOpen(false);
  };

  const clear = () => {
    setDraft(null);
    onChange?.('');
    setOpen(false);
  };

  const onDayClick = (day: Date) => {
    if (isDisabledDay(day, min, max)) return;
    setDraft(day);
    onChange?.(toIso(day));
    setOpen(false);
  };

  if (readOnly) {
    return (
      <input
        id={id}
        readOnly
        type="text"
        value={formatDisplay(value)}
        className={className}
        title={title}
      />
    );
  }

  return (
    <div ref={rootRef} className="enj-date-picker-field relative min-w-0">
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={formatDisplay(value)}
          placeholder={placeholder}
          className={`${className} pr-9`}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled) setOpen((o) => !o);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="enj-date-picker-trigger-icon"
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-label="Open calendar"
        >
          <Calendar size={16} strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <div className="enj-date-picker-popover">
          <CalendarPanel
            mode="single"
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            today={today}
            min={min}
            max={max}
            draftStart={draft}
            draftEnd={null}
            onDayClick={onDayClick}
          />
          <div className="enj-date-picker-footer">
            <button type="button" className="enj-date-picker-clear" onClick={clear}>
              Clear
            </button>
            <button type="button" className="enj-date-picker-apply" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type DateRangePickerFieldProps = {
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
};

/** Date range field with range selection styling (reference date picker UI). */
export function DateRangePickerField({
  startValue,
  endValue,
  onChange,
  min,
  max,
  disabled = false,
  className = '',
  placeholder = 'Select date range',
  id: idProp,
}: DateRangePickerFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const startParsed = parseIso(startValue);
  const endParsed = parseIso(endValue);
  const [viewMonth, setViewMonth] = useState(() => startParsed ?? endParsed ?? today);
  const [draftStart, setDraftStart] = useState<Date | null>(startParsed);
  const [draftEnd, setDraftEnd] = useState<Date | null>(endParsed);

  useEffect(() => {
    if (!open) return;
    setDraftStart(parseIso(startValue));
    setDraftEnd(parseIso(endValue));
    setViewMonth(parseIso(startValue) ?? parseIso(endValue) ?? today);
  }, [open, startValue, endValue, today]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  const displayValue = useMemo(() => {
    if (startValue && endValue) return `${formatDisplay(startValue)} – ${formatDisplay(endValue)}`;
    if (startValue) return formatDisplay(startValue);
    return '';
  }, [startValue, endValue]);

  const apply = () => {
    const { start, end } = normalizeRange(draftStart, draftEnd);
    onChange(start ? toIso(start) : '', end ? toIso(end) : '');
    setOpen(false);
  };

  const clear = () => {
    setDraftStart(null);
    setDraftEnd(null);
    onChange('', '');
    setOpen(false);
  };

  const onDayClick = (day: Date) => {
    if (isDisabledDay(day, min, max)) return;
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }
    const { start, end } = normalizeRange(draftStart, day);
    setDraftStart(start);
    setDraftEnd(end);
  };

  return (
    <div ref={rootRef} className="enj-date-picker-field relative min-w-0">
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          className={`${className} pr-9`}
          onClick={() => !disabled && setOpen((o) => !o)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="enj-date-picker-trigger-icon"
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-label="Open calendar"
        >
          <Calendar size={16} strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <div className="enj-date-picker-popover">
          <CalendarPanel
            mode="range"
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            today={today}
            min={min}
            max={max}
            draftStart={draftStart}
            draftEnd={draftEnd}
            onDayClick={onDayClick}
          />
          <div className="enj-date-picker-footer">
            <button type="button" className="enj-date-picker-clear" onClick={clear}>
              Clear
            </button>
            <button type="button" className="enj-date-picker-apply" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

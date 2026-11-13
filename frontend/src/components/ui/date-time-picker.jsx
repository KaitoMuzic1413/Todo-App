import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import AnchoredPopover from '@/components/ui/anchored-popover';
import { useLanguage } from '@/lib/i18n';
import { dateKey, getCalendarDays } from '@/lib/calendarUtils';
import { cn } from '@/lib/utils';

const pad = (value) => String(value).padStart(2, '0');

const parseValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalValue = (date) => {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 16);
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);

const DateTimePicker = ({
  id,
  value = '',
  onChange,
  ariaLabel,
  placeholder = '',
  className,
  contentClassName,
  disabled = false,
}) => {
  const { language, t } = useLanguage();
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const selected = useMemo(() => parseValue(value), [value]);

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      const base = selected || new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      setHour(base.getHours());
      setMinute(base.getMinutes());
    }
    setOpen(nextOpen);
  };

  const gridDays = useMemo(() => getCalendarDays('month', viewMonth), [viewMonth]);
  const todayKey = dateKey(new Date());
  const selectedKey = selected ? dateKey(selected) : '';

  const displayValue = selected
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(selected)
    : placeholder;

  const applyTime = (nextHour, nextMinute) => {
    setHour(nextHour);
    setMinute(nextMinute);
    if (!selected) return;
    const next = new Date(selected);
    next.setHours(nextHour, nextMinute, 0, 0);
    onChange?.(toLocalValue(next));
  };

  const chooseDay = (day) => {
    const next = new Date(day);
    next.setHours(hour, minute, 0, 0);
    onChange?.(toLocalValue(next));
    setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const changeMonth = (direction) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type='button'
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup='dialog'
        aria-expanded={open}
        onClick={() => handleOpenChange(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition hover:border-violet-300 focus-visible:border-violet-400 focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-violet-500/60 dark:focus-visible:ring-violet-900/30',
          className
        )}
      >
        <span className='flex min-w-0 items-center gap-2'>
          <CalendarDays className='h-3.5 w-3.5 shrink-0 text-violet-500' />
          <span className={cn('truncate', !selected && 'text-slate-400 dark:text-slate-500')}>
            {displayValue}
          </span>
        </span>
        <ChevronDown className='h-3.5 w-3.5 shrink-0 opacity-60' />
      </button>

      <AnchoredPopover
        open={open}
        onOpenChange={handleOpenChange}
        triggerRef={triggerRef}
        className={cn(
          'flex w-[19rem] flex-col gap-0 rounded-3xl bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
          contentClassName
        )}
      >
        <div className='flex items-center justify-between'>
          <button
            type='button'
            onClick={() => changeMonth(-1)}
            aria-label={t.previousPeriod}
            className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <span className='text-xs font-bold capitalize text-slate-800 dark:text-slate-100'>
            {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewMonth)}
          </span>
          <button
            type='button'
            onClick={() => changeMonth(1)}
            aria-label={t.nextPeriod}
            className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>

        <div className='mt-1 grid grid-cols-7 gap-1 text-center'>
          {gridDays.slice(0, 7).map((day) => (
            <span
              key={dateKey(day)}
              className='py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500'
            >
              {new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day)}
            </span>
          ))}
        </div>

        <div className='grid grid-cols-7 gap-1'>
          {gridDays.map((day) => {
            const key = dateKey(day);
            const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;

            return (
              <button
                key={key}
                type='button'
                onClick={() => chooseDay(day)}
                aria-pressed={isSelected}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-3xl text-xs font-bold transition',
                  !isCurrentMonth && 'text-slate-300 dark:text-slate-600',
                  isSelected
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/40'
                    : isToday
                      ? 'text-violet-700 ring-1 ring-inset ring-violet-400 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40'
                      : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-200'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className='mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800'>
          <div className='flex items-center gap-1.5'>
            <Clock className='h-3.5 w-3.5 text-violet-500' />
            <select
              aria-label={t.startTime}
              value={hour}
              onChange={(event) => applyTime(Number(event.target.value), minute)}
              className='h-8 rounded-3xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
            >
              {HOURS.map((option) => (
                <option key={option} value={option}>
                  {pad(option)}
                </option>
              ))}
            </select>
            <span className='text-xs font-bold text-slate-400'>:</span>
            <select
              aria-label={t.startTime}
              value={minute}
              onChange={(event) => applyTime(hour, Number(event.target.value))}
              className='h-8 rounded-3xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
            >
              {MINUTES.map((option) => (
                <option key={option} value={option}>
                  {pad(option)}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <button
              type='button'
              onClick={() => onChange?.('')}
              className='flex items-center gap-1 rounded-3xl px-2 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30'
            >
              <X className='h-3 w-3' />
              {language === 'vi' ? 'Xóa' : 'Clear'}
            </button>
          ) : null}
        </div>
      </AnchoredPopover>
    </>
  );
};

export default DateTimePicker;

import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import SelectMenu from '@/components/ui/select-menu';

const CalendarToolbar = ({
  calendarTitle,
  periodLabel,
  today,
  previousPeriod,
  nextPeriod,
  selectMonth,
  selectYear,
  monthOptions,
  yearOptions,
  selectedDate,
  setSelectedDate,
  viewMode,
  setViewMode,
  language,
  monthView,
  weekView,
  dayView,
  onJumpToToday,
  onChangePeriod,
  onCreate,
}) => (
  <header className='flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/80 lg:flex-row lg:items-center lg:justify-between lg:px-6'>
    <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2'>
      <div className='flex min-w-0 items-center gap-3.5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-violet-500/25'>
          <CalendarDays className='h-5 w-5' />
        </div>
        <div className='min-w-0'>
          <h1 className='truncate text-xl font-extrabold text-slate-900 dark:text-white'>
            {calendarTitle}
          </h1>
          <p className='truncate text-xs font-semibold capitalize text-slate-500 dark:text-slate-400'>
            {periodLabel}
          </p>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onJumpToToday}
          className='h-9 rounded-3xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
        >
          {today}
        </button>

        <div className='flex items-center gap-1.5'>
          <button
            type='button'
            onClick={() => onChangePeriod(-1)}
            aria-label={previousPeriod}
            className='flex h-9 w-9 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-90 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={() => onChangePeriod(1)}
            aria-label={nextPeriod}
            className='flex h-9 w-9 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-90 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>
    </div>

    <div className='flex min-w-0 flex-wrap items-center gap-2 lg:justify-end'>
      <div className='hidden items-center gap-1.5 md:flex'>
        <SelectMenu
          ariaLabel={selectMonth}
          value={String(selectedDate.getMonth())}
          onChange={(value) =>
            setSelectedDate(new Date(selectedDate.getFullYear(), Number(value), 1))
          }
          options={monthOptions.map(({ value, label }) => ({ value: String(value), label }))}
          className='h-9 px-2.5 text-xs font-semibold capitalize'
        />

        <SelectMenu
          ariaLabel={selectYear}
          value={String(selectedDate.getFullYear())}
          onChange={(value) =>
            setSelectedDate(new Date(Number(value), selectedDate.getMonth(), 1))
          }
          options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
          className='h-9 px-2.5 text-xs font-semibold'
        />
      </div>

      <div
        className='relative grid grid-cols-4 gap-0.5 rounded-3xl border border-slate-200 bg-slate-100 p-0.5 shadow-inner dark:border-slate-600 dark:bg-slate-900'
        role='tablist'
      >
        {[
          ['month', monthView || 'Tháng'],
          ['week', weekView || 'Tuần'],
          ['day', dayView || 'Ngày'],
          ['agenda', language === 'vi' ? 'Lịch' : 'Agenda'],
        ].map(([key, label]) => (
          <button
            key={key}
            type='button'
            onClick={() => setViewMode(key)}
            className={`relative z-10 rounded-3xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
              viewMode === key
                ? 'text-white'
                : 'text-slate-600 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-200'
            }`}
          >
            {viewMode === key ? (
              <motion.span
                layoutId='calendar-view-pill'
                className='absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-sm'
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            ) : null}
            <span className='relative z-10 truncate'>{label}</span>
          </button>
        ))}
      </div>

      <button
        type='button'
        onClick={onCreate}
        className='flex items-center gap-1.5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95'
      >
        <Plus className='h-4 w-4' />
        <span>{language === 'vi' ? 'Ghi chú / Lên lịch' : 'Create'}</span>
      </button>
    </div>
  </header>
);

export default CalendarToolbar;

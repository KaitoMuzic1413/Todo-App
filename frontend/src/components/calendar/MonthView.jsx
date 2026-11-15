import { memo } from 'react';
import { AlertTriangle, Clock, Plus, StickyNote } from 'lucide-react';
import {
  dateKey,
  getCalendarEventKey,
  getDayWarnings,
  getTaskCalendarDisplay,
} from '@/lib/calendarUtils';
import { formatTimeOnly } from '@/lib/calendarPageHelpers';

const weekdayFormatters = new Map();

const getWeekdayFormatter = (locale) => {
  const key = locale || 'default';
  let formatter = weekdayFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    weekdayFormatters.set(key, formatter);
  }
  return formatter;
};

const MonthView = ({
  calendarDays,
  selectedDate,
  taskByDate,
  calendarNotes,
  currentDayKey,
  locale,
  language,
  t,
  openNoteModal,
  openTaskScheduleModal,
}) => {
  const weekdayFormatter = getWeekdayFormatter(locale);
  return (
  <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/90'>
    <div className='grid grid-cols-7 border-b border-slate-200/90 bg-slate-100/80 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400'>
      {calendarDays.slice(0, 7).map((date) => (
        <div key={dateKey(date)} className='py-2.5'>
          {weekdayFormatter.format(date)}
        </div>
      ))}
    </div>

    <div className='grid grid-cols-7 divide-x divide-y divide-slate-200/70 bg-slate-50 dark:divide-slate-600/80 dark:bg-transparent'>
      {calendarDays.map((date) => {
        const dayKey = dateKey(date);
        const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
        const isToday = dayKey === currentDayKey;
        const dayTasks = taskByDate.get(dayKey) || [];
        const dayNote = calendarNotes?.[dayKey]?.content || '';
        const warnings = getDayWarnings(dayTasks, date);

        return (
          <div
            key={dayKey}
            onClick={() => openNoteModal(date)}
            className={`group relative flex min-h-[110px] cursor-pointer flex-col p-1.5 transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-900/15 sm:min-h-[135px] sm:p-2 ${
              !isCurrentMonth
                ? 'bg-slate-100/60 text-slate-400 dark:bg-slate-900/30 dark:text-slate-600'
                : 'bg-slate-50/80 text-slate-800 dark:bg-slate-800/40 dark:text-slate-100'
            }`}
          >
            <div className='mb-1 flex items-center justify-between'>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-3xl text-xs font-extrabold transition-all ${
                  isToday
                    ? 'bg-violet-600 text-white shadow-xs shadow-violet-500/40'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {date.getDate()}
              </span>

              <div className='flex items-center gap-1'>
                {warnings.overlaps ? (
                  <AlertTriangle
                    className='h-3.5 w-3.5 text-amber-500'
                    title={t.overlapWarning}
                  />
                ) : null}
                {warnings.overloaded ? (
                  <AlertTriangle
                    className='h-3.5 w-3.5 text-rose-500'
                    title={t.overloadedDay}
                  />
                ) : null}

                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation();
                    openTaskScheduleModal(date);
                  }}
                  className='hidden h-6 w-6 items-center justify-center rounded-3xl text-slate-400 hover:bg-violet-100 hover:text-violet-700 group-hover:flex dark:hover:bg-violet-900/50 dark:hover:text-violet-300'
                  title={language === 'vi' ? 'Lên lịch công việc' : 'Schedule task'}
                >
                  <Plus className='h-3.5 w-3.5' />
                </button>
              </div>
            </div>

            <div className='space-y-1 overflow-hidden'>
              {dayNote ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    openNoteModal(date);
                  }}
                  className='flex min-w-0 items-center gap-1 truncate rounded-3xl border border-amber-200/90 bg-amber-50/90 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-xs transition hover:scale-[1.02] hover:bg-amber-100 dark:border-amber-600/70 dark:bg-amber-900/40 dark:text-amber-200'
                  title={dayNote}
                >
                  <StickyNote className='h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400' />
                  <span className='min-w-0 truncate'>{dayNote}</span>
                </div>
              ) : null}

              {dayTasks.slice(0, dayNote ? 2 : 3).map((task) => {
                const display = getTaskCalendarDisplay(task, date);
                const isStart = Boolean(task.startAt);
                return (
                  <div
                    key={getCalendarEventKey(task)}
                    onClick={(e) => {
                      e.stopPropagation();
                      openTaskScheduleModal(date, task);
                    }}
                    title={task.title}
                    className={`flex min-w-0 items-center gap-1 truncate rounded-3xl border px-2 py-0.5 text-[11px] font-medium transition hover:scale-[1.02] ${
                      isStart
                        ? 'border-violet-200 bg-violet-100/90 text-violet-900 dark:border-violet-600 dark:bg-violet-900/60 dark:text-violet-200'
                        : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Clock className='h-3 w-3 shrink-0 opacity-70' />
                    {display ? (
                      <span className='font-bold'>{formatTimeOnly(display.startMs, locale)}</span>
                    ) : null}
                    <span className='min-w-0 flex-1 truncate'>{task.title}</span>
                  </div>
                );
              })}

              {dayTasks.length > (dayNote ? 2 : 3) ? (
                <p className='px-1 text-[10px] font-bold text-violet-600 dark:text-violet-400'>
                  +{dayTasks.length - (dayNote ? 2 : 3)} {language === 'vi' ? 'mục khác' : 'more'}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  </section>
  );
};

export default memo(MonthView);

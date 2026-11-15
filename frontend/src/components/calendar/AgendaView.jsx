import { FileText, Plus, StickyNote } from 'lucide-react';
import {
  dateKey,
  getCalendarEventKey,
  getTaskCalendarDisplay,
} from '@/lib/calendarUtils';
import { formatTimeOnly } from '@/lib/calendarPageHelpers';

const AgendaView = ({
  calendarDays,
  taskByDate,
  calendarNotes,
  currentDayKey,
  locale,
  language,
  t,
  openNoteModal,
  openTaskScheduleModal,
}) => (
  <section className='space-y-4'>
    {calendarDays.map((date) => {
      const dayKey = dateKey(date);
      const dayTasks = taskByDate.get(dayKey) || [];
      const dayNote = calendarNotes?.[dayKey]?.content || '';
      const isToday = dayKey === currentDayKey;

      return (
        <div
          key={dayKey}
          className={`overflow-hidden rounded-3xl border p-3 shadow-sm backdrop-blur-md transition sm:p-4 ${
            isToday
              ? 'border-violet-300 bg-violet-50/60 dark:border-violet-300/70 dark:bg-violet-900/20'
              : 'border-slate-200/80 bg-white/80 dark:border-slate-600 dark:bg-slate-800/80'
          }`}
        >
          <div className='flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-600'>
            <div className='flex min-w-0 items-center gap-3'>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-3xl text-sm font-extrabold ${
                  isToday
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {date.getDate()}
              </span>
              <div className='min-w-0'>
                <h3 className='truncate text-sm font-bold text-slate-900 dark:text-white'>
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}
                </h3>
                {isToday ? (
                  <span className='text-[11px] font-bold text-violet-600 dark:text-violet-400'>
                    {t.today}
                  </span>
                ) : null}
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
              <button
                type='button'
                onClick={() => openNoteModal(date)}
                className='flex items-center gap-1 rounded-3xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'
              >
                <FileText className='h-3.5 w-3.5 text-amber-500' />
                <span>{dayNote ? (language === 'vi' ? 'Sửa ghi chú' : 'Edit note') : (language === 'vi' ? 'Thêm ghi chú' : 'Add note')}</span>
              </button>
              <button
                type='button'
                onClick={() => openTaskScheduleModal(date)}
                className='flex items-center gap-1 rounded-3xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700'
              >
                <Plus className='h-3.5 w-3.5' />
                <span>{language === 'vi' ? 'Lên lịch' : 'Schedule'}</span>
              </button>
            </div>
          </div>

          {dayNote ? (
            <div className='mt-3 flex items-start gap-2.5 rounded-3xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-200'>
              <StickyNote className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
              <div
                tabIndex={0}
                role='region'
                aria-label={t.dayNote}
                className='scrollable-content max-h-32 min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] pr-1 font-medium'
              >
                {dayNote}
              </div>
            </div>
          ) : null}

          <div className='mt-3 space-y-2'>
            {dayTasks.length ? (
              dayTasks.map((task) => {
                const display = getTaskCalendarDisplay(task, date);
                const isDeadline = display?.kind === 'deadline';
                return (
                  <div
                    key={getCalendarEventKey(task)}
                    onClick={() => openTaskScheduleModal(date, task)}
                    className='flex cursor-pointer items-center justify-between gap-2 rounded-3xl border border-slate-200/90 bg-white p-3 shadow-xs transition hover:border-violet-300 dark:border-slate-600 dark:bg-slate-700/80 dark:hover:border-violet-500'
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-2.5'>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-3xl ${isDeadline ? 'bg-amber-500' : 'bg-violet-600'}`} />
                      <div className='min-w-0 flex-1'>
                        <p title={task.title} className='line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere] text-xs font-bold text-slate-800 sm:line-clamp-1 dark:text-slate-100'>
                          {task.title}
                        </p>
                        <p className='truncate text-[11px] text-slate-500 dark:text-slate-400'>
                          {display
                            ? `${isDeadline ? t.dueDate : (language === 'vi' ? 'Bắt đầu' : 'Starts')} ${formatTimeOnly(display.startMs, locale)}`
                            : t.taskUnscheduled}
                        </p>
                      </div>
                    </div>
                    <span className='shrink-0 rounded-3xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-500 dark:text-slate-300'>
                      {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                    </span>
                  </div>
                );
              })
            ) : !dayNote ? (
              <p className='text-xs italic text-slate-400'>
                {language === 'vi' ? 'Không có ghi chú hay lịch trình' : 'No notes or schedule for this day'}
              </p>
            ) : null}
          </div>
        </div>
      );
    })}
  </section>
);

export default AgendaView;

import { memo } from 'react';
import { List } from 'lucide-react';

const UnscheduledTasks = ({
  unscheduledTasks,
  selectedDate,
  openTaskScheduleModal,
  language,
  t,
}) => (
  <section className='min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/80'>
    <div className='flex items-center justify-between gap-2'>
      <div className='flex min-w-0 items-center gap-2'>
        <List className='h-5 w-5 shrink-0 text-violet-600' />
        <h2 className='truncate text-sm font-bold text-slate-900 dark:text-white'>
          {t.unscheduledTasks} ({unscheduledTasks.length})
        </h2>
      </div>
      <span className='hidden shrink-0 text-xs text-slate-400 sm:inline'>
        {language === 'vi' ? 'Bấm để xếp vào lịch' : 'Click to schedule'}
      </span>
    </div>

    {unscheduledTasks.length ? (
      <div className='mt-3.5 grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3'>
        {unscheduledTasks.map((task) => (
          <div
            key={task._id}
            onClick={() => openTaskScheduleModal(selectedDate, task)}
            className='flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-3xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-500 dark:bg-slate-900/40 dark:hover:border-violet-500'
          >
            <p title={task.title} className='min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-xs font-bold text-slate-800 dark:text-slate-100'>
              {task.title}
            </p>
            <button
              type='button'
              className='w-full shrink-0 rounded-3xl bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 sm:w-auto dark:bg-violet-500/20 dark:text-violet-300'
            >
              + {language === 'vi' ? 'Lên lịch' : 'Schedule'}
            </button>
          </div>
        ))}
      </div>
    ) : (
      <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
        {t.noUnscheduledTasks || 'Tất cả công việc đã được lên lịch.'}
      </p>
    )}
  </section>
);

export default memo(UnscheduledTasks);

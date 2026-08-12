import { CheckCircle2, Clock3, ListTodo } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const filters = ['All tasks', 'Today', 'Important', 'Completed'];

const StatsAndFilters = ({ tasks = [] }) => {
  const { t } = useLanguage();
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'complete').length;
  const pending = total - completed;

  const stats = [
    { label: t.totalTasks, value: String(total), icon: ListTodo, tone: 'violet' },
    { label: t.completed, value: String(completed), icon: CheckCircle2, tone: 'emerald' },
    { label: t.pending, value: String(pending), icon: Clock3, tone: 'amber' },
  ];

  return (
    <div className='space-y-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <div className='grid gap-3 sm:grid-cols-3'>
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className='rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50'>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
              tone === 'violet' ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200' :
              tone === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200' :
              'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'
            }`}>
              <Icon className='h-4 w-4' />
            </div>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{value}</p>
            <p className='text-sm text-slate-500 dark:text-slate-300'>{label}</p>
          </div>
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        {filters.map((filter, index) => (
          <button
            key={filter}
            type='button'
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              index === 0
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatsAndFilters;

import { CheckCircle2, Clock3, ListTodo } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

import { useState } from 'react';

const filters = [
  { key: 'all', label: 'All tasks' },
  { key: 'important', label: 'Important' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

const StatsAndFilters = ({ tasks = [], onFilterChange }) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'complete').length;
  const pending = total - completed;

  const stats = [
    { label: 'Total', value: String(total), tone: 'violet' },
    { label: 'Completed', value: String(completed), tone: 'emerald' },
    { label: 'Pending', value: String(pending), tone: 'amber' },
  ];

  const [active, setActive] = useState('all');

  const handleFilter = (key) => {
    setActive(key);
    onFilterChange?.(key);
  };

  return (
    <div className='space-y-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <div className='flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3'>
        {stats.map(({ label, value, tone }) => (
          <div key={label} className='min-w-[140px] flex-shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50'>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
              tone === 'violet' ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200' :
              tone === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200' :
              'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'
            }`}>
              {/* icon placeholder */}
              <span className='h-4 w-4' />
            </div>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{value}</p>
            <p className='text-sm text-slate-500 dark:text-slate-300'>{label}</p>
          </div>
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => handleFilter(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active === key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatsAndFilters;

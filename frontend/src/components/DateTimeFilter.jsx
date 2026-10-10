import { CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';

const DateTimeFilter = ({ value = 'all', onChange, isArchive = false }) => {
  const { t } = useLanguage();

  const filters = isArchive
    ? [
        { key: 'today', label: t.today || 'Today' },
        { key: 'week', label: t.thisWeek || 'This Week' },
        { key: 'month', label: t.thisMonth || 'This Month' },
        { key: 'beforeMonth', label: t.beforeThisMonth || 'Earlier' },
        { key: 'all', label: t.allTime || t.all || 'All time' },
      ]
    : [
        { key: 'all', label: t.allTime || t.all || 'All time' },
        { key: 'today', label: t.today || 'Today' },
        { key: 'week', label: t.thisWeek || 'This Week' },
        { key: 'month', label: t.thisMonth || 'This Month' },
        { key: 'beforeMonth', label: t.beforeThisMonth || 'Earlier' },
      ];

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
  };

  return (
    <div className='flex w-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm sm:w-auto sm:flex-row sm:rounded-full sm:items-center dark:border-slate-700 dark:bg-slate-900/70'>
      <div className='flex items-center justify-center sm:justify-start'>
        <CalendarDays className='h-4 w-4 text-violet-500' />
      </div>

      <div className='grid w-full grid-cols-6 gap-1 rounded-2xl bg-slate-100 p-1 text-sm dark:bg-slate-800 sm:w-[560px] sm:grid-cols-5 sm:rounded-full'>
        {filters.map((filter, index) => (
          <button
            key={filter.key}
            type='button'
            aria-pressed={value === filter.key}
            onClick={() => handleSelect(filter.key)}
            className={`relative col-span-2 flex min-w-0 items-center justify-center rounded-full px-1 py-2 text-center text-[11px] leading-tight transition-colors sm:col-span-1 sm:px-2 sm:py-1.5 sm:text-sm ${
              index === 3 ? 'col-start-2 sm:col-start-auto' : ''
            } ${
              index === 4 ? 'col-start-4 sm:col-start-auto' : ''
            } ${
              value === filter.key ? 'text-white' : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            {value === filter.key ? (
              <motion.span
                layoutId='date-filter-active-pill'
                className='absolute inset-0 rounded-full bg-violet-600 shadow-[0_12px_30px_rgba(124,58,237,0.35)]'
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className='relative z-10 line-clamp-2'>{filter.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateTimeFilter;
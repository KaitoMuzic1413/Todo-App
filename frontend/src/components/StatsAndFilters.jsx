import { Clipboard, CheckCircle2, Clock, Star } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedNumber = ({ value }) => {
  const numericValue = Number(value) || 0;
  const [prevValue, setPrevValue] = useState(numericValue);
  const [direction, setDirection] = useState(1);

  if (prevValue !== numericValue) {
    setPrevValue(numericValue);
    setDirection(numericValue > prevValue ? 1 : -1);
  }

  return (
    <span className='relative inline-flex h-[1.25em] items-center overflow-hidden font-bold text-slate-900 dark:text-white text-base sm:text-lg'>
      <AnimatePresence mode='popLayout' custom={direction} initial={false}>
        <motion.span
          key={value}
          custom={direction}
          initial={(dir) => ({
            y: dir > 0 ? '80%' : '-80%',
            opacity: 0,
            scale: 0.6,
            filter: 'blur(4px)',
          })}
          animate={{
            y: '0%',
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
          }}
          exit={(dir) => ({
            y: dir > 0 ? '-80%' : '80%',
            opacity: 0,
            scale: 0.6,
            filter: 'blur(4px)',
          })}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 26,
            mass: 0.8,
          }}
          className='inline-block leading-none'
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const StatsAndFilters = ({ tasks = [], onFilterChange, activeFilter = 'all', customFilters, customStats }) => {
  const { t } = useLanguage();

  const defaultFilters = [
    { key: 'all', label: t.allTasks || 'All tasks' },
    { key: 'important', label: t.important || 'Important' },
    { key: 'pending', label: t.statusPending || 'Pending' },
    { key: 'completed', label: t.statusCompleted || 'Completed' },
  ];
  const filters = customFilters?.map(([key, label]) => ({ key, label })) || defaultFilters;

  const total = tasks.length;
  const importantCount = tasks.filter((task) => task.important).length;
  const completed = tasks.filter((task) => task.status === 'complete').length;
  const pending = total - completed;

  const stats = customStats || [
    { label: t.total || 'Total', value: total, tone: 'violet' },
    { label: t.important || 'Important', value: importantCount, tone: 'amber' },
    { label: t.statusPending || 'Pending', value: pending, tone: 'sky' },
    { label: t.statusCompleted || 'Completed', value: completed, tone: 'emerald' },
  ];

  const activeIndex = filters.findIndex(({ key }) => key === activeFilter);
  const activeTrackStyle = {
    width: `calc(${100 / filters.length}% - 0.5rem)`,
    left: `calc(${activeIndex >= 0 ? activeIndex * (100 / filters.length) : 0}% + 0.25rem)`,
  };

  return (
    <div className='box-border w-full min-w-0 max-w-full space-y-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-4 dark:border-slate-800 dark:bg-slate-900/70'>
      <div className={`grid min-w-0 grid-cols-2 gap-2 sm:gap-3 ${stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
        {stats.map(({ label, value, tone }) => (
          <div
            key={label}
            className='min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/50 sm:p-2.5'
          >
            <div className='flex items-center gap-2.5 sm:gap-3'>
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-3xl sm:h-9 sm:w-9 ${
                  tone === 'violet'
                    ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'
                    : tone === 'amber'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'
                    : tone === 'sky'
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200'
                }`}
              >
                {tone === 'violet' ? (
                  <Clipboard className='h-4 w-4' aria-hidden />
                ) : tone === 'amber' ? (
                  <Star className='h-4 w-4' aria-hidden />
                ) : tone === 'sky' ? (
                  <Clock className='h-4 w-4' aria-hidden />
                ) : (
                  <CheckCircle2 className='h-4 w-4' aria-hidden />
                )}
              </div>

              <div className='min-w-0'>
                <AnimatedNumber value={value} />
                <p className='truncate text-xs text-slate-500 dark:text-slate-300 sm:text-xs'>
                  {label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='relative grid w-full min-w-0 max-w-full rounded-3xl border border-slate-200/70 bg-slate-100/90 p-1.5 shadow-inner dark:border-slate-700/70 dark:bg-slate-950/70' style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }}>
        <div
          className='pointer-events-none absolute inset-y-1.5 rounded-3xl bg-violet-600 shadow-accent-indicator transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
          style={activeTrackStyle}
        />

        {filters.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => onFilterChange?.(key)}
            aria-pressed={activeFilter === key}
            className={`relative z-10 rounded-3xl px-1 py-2 text-center text-xs font-semibold transition-all duration-200 sm:text-sm ${
              activeFilter === key
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            <span className='block truncate px-1'>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatsAndFilters;

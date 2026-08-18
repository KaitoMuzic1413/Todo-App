import { CalendarDays } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const DateTimeFilter = ({ value = 'all', onChange }) => {
  const { t } = useLanguage();

  const filters = [
    { key: 'all', label: t.allTime || t.all || 'All time' }, // Đã đổi 'All' thành 'All time'
    { key: 'today', label: t.today || 'Today' },
    { key: 'week', label: t.thisWeek || 'This Week' },
    { key: 'month', label: t.thisMonth || 'This Month' },
  ];

  const activeIndex = filters.findIndex((filter) => filter.key === value);
  const activeTrackStyle =
    activeIndex < 0
      ? { opacity: 0 }
      : {
          width: 'calc((100% - 0.5rem) / 4)',
          transform: `translateX(${activeIndex * 100}%)`,
          left: '0.25rem',
        };

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
  };

  return (
    <div className='flex w-full flex-col items-stretch gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm sm:w-auto sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-900/70'>
      <div className='flex items-center justify-center sm:justify-start'>
        <CalendarDays className='h-4 w-4 text-violet-500' />
      </div>

      <div className='relative grid w-full grid-cols-4 gap-1 rounded-full bg-slate-100 p-1 text-sm sm:w-auto dark:bg-slate-800'>
        <div
          className='pointer-events-none absolute inset-y-1 rounded-full bg-violet-600 shadow-[0_12px_30px_rgba(124,58,237,0.30)] transition-transform duration-300 ease-out'
          style={activeTrackStyle}
        />

        {filters.map((filter) => (
          <button
            key={filter.key}
            type='button'
            aria-pressed={value === filter.key}
            onClick={() => handleSelect(filter.key)}
            className={`relative z-10 flex min-w-0 items-center justify-center rounded-full px-2 py-1.5 text-center text-[11px] transition-all sm:text-sm ${
              value === filter.key ? 'text-white' : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            <span className='truncate'>{filter.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateTimeFilter;
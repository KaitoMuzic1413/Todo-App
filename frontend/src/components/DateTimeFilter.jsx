import { CalendarDays } from 'lucide-react';

const filters = ['Today', 'This week', 'This month'];

const DateTimeFilter = () => {
  return (
    <div className='flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70'>
      <CalendarDays className='h-4 w-4 text-violet-500' />
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        {filters.map((filter, index) => (
          <button
            key={filter}
            type='button'
            className={`rounded-full px-2.5 py-1 ${
              index === 0 ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateTimeFilter;
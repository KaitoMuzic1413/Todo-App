const filters = [
  { key: 'all', label: 'All tasks' },
  { key: 'important', label: 'Important' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

const StatsAndFilters = ({ tasks = [], onFilterChange, activeFilter = 'all' }) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'complete').length;
  const pending = total - completed;

  const stats = [
    { label: 'Total', value: String(total), tone: 'violet' },
    { label: 'Completed', value: String(completed), tone: 'emerald' },
    { label: 'Pending', value: String(pending), tone: 'amber' },
  ];

  const activeIndex = filters.findIndex(({ key }) => key === activeFilter);
  const activeTrackStyle = {
    width: `calc(${100 / filters.length}% - 0.5rem)`,
    left: `calc(${activeIndex >= 0 ? activeIndex * (100 / filters.length) : 0}% + 0.25rem)`,
  };

  const handleFilter = (key) => {
    onFilterChange?.(key);
  };

  return (
    <div className='space-y-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <div className='grid grid-cols-3 gap-2 sm:gap-3'>
        {stats.map(({ label, value, tone }) => (
          <div key={label} className='rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/50 sm:p-2.5'>
            <div className='flex items-center gap-3'>
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                tone === 'violet' ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200' :
                tone === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200' :
                'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'
              }`}>
                <span className='h-3 w-3' />
              </div>

              <div className='min-w-0'>
                <p className='text-base font-bold text-slate-900 dark:text-white sm:text-lg'>{value}</p>
                <p className='text-[10px] text-slate-500 dark:text-slate-300 sm:text-[11px]'>{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='relative flex flex-wrap gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800'>
        <div
          className='pointer-events-none absolute inset-y-1 rounded-full bg-violet-600 shadow-[0_12px_30px_rgba(124,58,237,0.35)] transition-all duration-300 ease-out'
          style={activeTrackStyle}
        />

        {filters.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => handleFilter(key)}
            className={`relative z-10 flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
              activeFilter === key
                ? 'text-white'
                : 'bg-transparent text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            <span className='block truncate'>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatsAndFilters;

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const TaskListPagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  const { t } = useLanguage();
  const [goToPageValue, setGoToPageValue] = useState(String(currentPage));

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  const handleGoToPage = () => {
    const parsed = Number(goToPageValue);
    if (!Number.isFinite(parsed)) return;
    const nextPage = Math.min(Math.max(parsed, 1), safeTotalPages);
    setGoToPageValue(String(nextPage));
    onPageChange?.(nextPage);
  };

  return (
    <div className='flex flex-col items-center gap-3 sm:flex-row'>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          disabled={safePage <= 1}
          onClick={() => {
            const nextPage = Math.max(1, safePage - 1);
            setGoToPageValue(String(nextPage));
            onPageChange?.(nextPage);
          }}
          className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>
        <div className='rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'>
          {t.page} {safePage} {t.of} {safeTotalPages}
        </div>
        <button
          type='button'
          disabled={safePage >= safeTotalPages}
          onClick={() => {
            const nextPage = Math.min(safeTotalPages, safePage + 1);
            setGoToPageValue(String(nextPage));
            onPageChange?.(nextPage);
          }}
          className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>

      <div className='flex items-center gap-2'>
        <input
          type='number'
          min='1'
          max={safeTotalPages}
          value={goToPageValue}
          onChange={(event) => setGoToPageValue(event.target.value)}
          className='h-10 w-20 rounded-full border border-slate-200 bg-white px-2 text-center text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
        />
        <button
          type='button'
          onClick={handleGoToPage}
          className='rounded-full bg-violet-600 px-3 py-2 text-sm font-medium text-white'
        >
          {t.goToPage}
        </button>
      </div>
    </div>
  );
};

export default TaskListPagination;

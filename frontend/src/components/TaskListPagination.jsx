import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const TaskListPagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  const { t } = useLanguage();
  const [goToPageValue, setGoToPageValue] = useState('');
  const [pageError, setPageError] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(currentPage, 1), safeTotalPages);
  const inputValue = isEditingPage ? goToPageValue : String(safePage);

  const handleGoToPage = () => {
    const trimmed = String(goToPageValue ?? '').trim();
    if (!trimmed) {
      setPageError('Please enter a page number.');
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > safeTotalPages) {
      setPageError(`Please enter a page between 1 and ${safeTotalPages}.`);
      return;
    }

    setPageError('');
    setIsEditingPage(false);
    setGoToPageValue(String(parsed));
    onPageChange?.(parsed);
  };

  const isGoButtonEnabled = isEditingPage && String(goToPageValue ?? '').trim() !== '';
  const inputClassName = `h-10 w-20 rounded-full border px-2 text-center text-sm font-medium shadow-sm outline-none transition-all placeholder:text-slate-400 focus:ring-4 ${
    pageError
      ? 'border-red-300 bg-red-50 text-red-600 focus:border-red-400 focus:bg-red-50 focus:ring-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200 dark:focus:border-red-500 dark:focus:ring-red-900/40'
      : 'border-slate-200 bg-slate-50 text-slate-500 focus:border-violet-400 focus:bg-white focus:text-slate-700 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:text-slate-100 dark:focus:ring-violet-900/40'
  }`;

  return (
    <div className='flex flex-col items-center gap-3 sm:flex-row'>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          disabled={safePage <= 1}
          onClick={() => {
            const nextPage = Math.max(1, safePage - 1);
            setGoToPageValue(String(nextPage));
            setIsEditingPage(false);
            setPageError('');
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
            setIsEditingPage(false);
            setPageError('');
            onPageChange?.(nextPage);
          }}
          className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>

      <div className='flex flex-col items-start gap-2'>
        <div className='flex items-center gap-2'>
          <input
            type='number'
            inputMode='numeric'
            min='1'
            max={safeTotalPages}
            value={inputValue}
            placeholder={String(safePage)}
            onFocus={() => {
              setIsEditingPage(true);
              if (String(goToPageValue ?? '').trim() === String(safePage)) {
                setGoToPageValue('');
              }
              setPageError('');
            }}
            onBlur={() => {
              setIsEditingPage(false);
              if (String(goToPageValue ?? '').trim() === '') {
                setGoToPageValue(String(safePage));
              }
            }}
            onChange={(event) => {
              setGoToPageValue(event.target.value);
              setPageError('');
            }}
            className={inputClassName}
          />
          <button
            type='button'
            onClick={handleGoToPage}
            disabled={!isGoButtonEnabled}
            className={`rounded-full px-3 py-2 text-sm font-medium shadow-sm transition-all ${
              isGoButtonEnabled
                ? 'bg-violet-600 text-white shadow-violet-200 hover:bg-violet-500 dark:shadow-violet-900/30'
                : 'cursor-not-allowed bg-slate-300 text-slate-500 shadow-none dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {t.goToPage}
          </button>
        </div>
        {pageError ? <p className='text-xs font-medium text-red-500'>{pageError}</p> : null}
      </div>
    </div>
  );
};

export default TaskListPagination;

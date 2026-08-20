import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const TaskListPagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  const { t } = useLanguage();
  const [goToPageValue, setGoToPageValue] = useState('');
  const [pageError, setPageError] = useState('');

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  const isInputEmpty = !String(goToPageValue ?? '').trim();

  const handleGoToPage = () => {
    const trimmed = String(goToPageValue ?? '').trim();

    if (!trimmed) {
      setPageError(t.enterPageError || 'Please enter a page number.');
      return;
    }

    const parsed = Number(trimmed);

    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > safeTotalPages) {
      setPageError(
        t.invalidPageRangeError
          ? t.invalidPageRangeError.replace('{max}', String(safeTotalPages))
          : `Please enter a page between 1 and ${safeTotalPages}.`
      );
      return;
    }

    setPageError('');
    onPageChange?.(parsed);
    setGoToPageValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isInputEmpty) return;
      handleGoToPage();
    }
  };

  // Class khung Input đồng bộ 100% với khung "Page X of Y"
  const inputClassName = `h-10 w-20 rounded-full border border-slate-200 bg-white px-2 text-center text-sm font-medium text-slate-700 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40 ${
    pageError
      ? 'border-red-400 bg-red-50 text-red-600 focus:border-red-500 focus:ring-red-100 dark:border-red-600 dark:bg-red-950/40 dark:text-red-200'
      : ''
  }`;

  return (
    <div className='flex flex-col items-center gap-3 sm:flex-row'>
      {/* Nút Chuyển trang Trước / Sau */}
      <div className='flex items-center gap-2'>
        <button
          type='button'
          disabled={safePage <= 1}
          onClick={() => {
            const nextPage = Math.max(1, safePage - 1);
            setPageError('');
            onPageChange?.(nextPage);
          }}
          className='inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          aria-label='Previous page'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>

        <div className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'>
          {t.page || 'Page'} {safePage} {t.of || 'of'} {safeTotalPages}
        </div>

        <button
          type='button'
          disabled={safePage >= safeTotalPages}
          onClick={() => {
            const nextPage = Math.min(safeTotalPages, safePage + 1);
            setPageError('');
            onPageChange?.(nextPage);
          }}
          className='inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          aria-label='Next page'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>

      {/* Ô nhập & Nút Đến trang */}
      <div className='flex flex-col items-start gap-1'>
        <div className='flex items-center gap-2'>
          <input
            type='number'
            inputMode='numeric'
            min='1'
            max={safeTotalPages}
            value={goToPageValue}
            placeholder={String(safePage)}
            onFocus={() => setPageError('')}
            onChange={(e) => {
              setGoToPageValue(e.target.value);
              if (pageError) setPageError('');
            }}
            onKeyDown={handleKeyDown}
            className={inputClassName}
          />

          <button
            type='button'
            disabled={isInputEmpty}
            onMouseDown={(e) => {
              if (!isInputEmpty) {
                e.preventDefault();
                handleGoToPage();
              }
            }}
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-white transition-all duration-300 ${
              isInputEmpty
                ? 'cursor-not-allowed bg-violet-500/40 opacity-50 dark:bg-violet-600/30'
                : 'cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25 active:scale-95 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 dark:shadow-violet-900/40'
            }`}
          >
            {t.goToPage || 'Go'}
          </button>
        </div>

        {pageError ? <p className='text-xs font-medium text-red-500'>{pageError}</p> : null}
      </div>
    </div>
  );
};

export default TaskListPagination;
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const TaskListPagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  const { t } = useLanguage();
  const [goToPageValue, setGoToPageValue] = useState('');
  const [pageError, setPageError] = useState('');

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  useEffect(() => {
    setGoToPageValue(String(safePage));
  }, [safePage]);

  // Kiểm tra ô nhập có bị bỏ trống hay không
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
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isInputEmpty) return;
      handleGoToPage();
    }
  };

  const inputClassName = `h-10 w-20 rounded-full border px-2 text-center text-sm font-medium shadow-sm outline-none transition-all placeholder:text-slate-400 focus:ring-4 ${
    pageError
      ? 'border-red-300 bg-red-50 text-red-600 focus:border-red-400 focus:bg-red-50 focus:ring-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200 dark:focus:border-red-500 dark:focus:ring-red-900/40'
      : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-violet-400 focus:bg-white focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:text-slate-100 dark:focus:ring-violet-900/40'
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
            onFocus={(e) => {
              e.target.select();
              setPageError('');
            }}
            onBlur={() => {
              if (!String(goToPageValue).trim()) {
                setGoToPageValue(String(safePage));
              }
            }}
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
            className={`rounded-full px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all dark:shadow-violet-900/30 ${
              isInputEmpty
                ? '!cursor-not-allowed bg-slate-300 text-slate-500 shadow-none dark:bg-slate-800 dark:text-slate-500'
                : 'cursor-pointer bg-violet-600 shadow-violet-200 hover:bg-violet-500 active:scale-95'
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
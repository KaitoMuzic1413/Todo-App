import { useLanguage } from '@/lib/i18n';

const NotFound = () => {
  const { t } = useLanguage();

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-slate-50 text-center'>
      <img src='/404_NotFound.png' alt='404 Not Found' className='mb-6 w-96 max-w-full' />
      <p className='text-xl font-semibold'>{t.notFoundTitle}</p>
      <a href='/signin' className='mt-4 inline-block rounded-2xl bg-primary px-6 py-3 font-medium text-white shadow-md transition hover:bg-primary-dark'>
        {t.backToHome}
      </a>
    </div>
  );
};

export default NotFound;

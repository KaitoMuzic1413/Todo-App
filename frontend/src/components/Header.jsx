import { useLanguage } from '@/lib/i18n';

const Header = () => {
  const { t } = useLanguage();

  return (
    <header className='mx-auto flex max-w-3xl flex-col items-center text-center'>
      <h1 className='text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl'>
        {t.appName}
      </h1>

      <p className='mt-3 text-lg text-slate-500 dark:text-slate-300'>
        Let&apos;s do it !!!
      </p>
    </header>
  );
};

export default Header;

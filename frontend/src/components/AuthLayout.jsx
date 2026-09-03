import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Mail, Menu, Moon, SunMedium, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

const AuthLayout = ({ children }) => {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('todo-theme') === 'dark');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('todo-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const openContact = () => {
    setIsOpen(false);
    navigate('/about');
  };

  return (
    <div className='min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-900 transition-colors duration-500 dark:bg-[#0f172a] dark:text-slate-50'>
      <button
        type='button'
        onClick={() => setIsOpen(true)}
        className='fixed left-3 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-md backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80'
        aria-label='Open settings sidebar'
      >
        <Menu className='h-5 w-5' />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.button
              type='button'
              aria-label='Close settings sidebar'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs'
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className='fixed left-0 top-0 z-50 flex h-[100dvh] w-[320px] flex-col border-r border-slate-200/80 bg-white/95 p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950/95'
            >
              <div className='flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800'>
                <div>
                  <p className='text-lg font-bold text-slate-900 dark:text-white'>Redhat</p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>{t.productivityHub}</p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsOpen(false)}
                  className='flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700'
                  aria-label='Close settings sidebar'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>

              <nav className='space-y-2 pt-5'>
                <button
                  type='button'
                  onClick={openContact}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors ${location.pathname === '/about' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}
                >
                  <Mail className='h-4 w-4' />
                  {t.contact}
                </button>
                <button
                  type='button'
                  onClick={() => setDarkMode((current) => !current)}
                  className='flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                >
                  {darkMode ? <SunMedium className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
                  {darkMode ? t.lightMode : t.darkMode}
                </button>
                <button
                  type='button'
                  onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                  className='flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                >
                  <Globe className='h-4 w-4' />
                  {t.language}: {language === 'en' ? t.english : t.vietnamese}
                </button>
              </nav>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className='flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),transparent_40%),linear-gradient(135deg,#f5f7fb,#eef2ff)] p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),transparent_38%),linear-gradient(135deg,#0f172a,#111827)]'>{children}</main>
    </div>
  );
};

export default AuthLayout;

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Globe, LogIn, LogOut, Mail, Moon, SunMedium, UserCircle2, X, Home, Trash2 } from 'lucide-react';
import { loginWithEmail } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const SIDEBAR_WIDTH = 320;
const EDGE_WIDTH = 35;

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;

  try {
    const storedUser = localStorage.getItem('todo-user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

export function LayoutShell({ children }) {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('todo-theme') === 'dark';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(-SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [loginEmail, setLoginEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('todo-user-email') || '';
  });
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startOffset = useRef(-SIDEBAR_WIDTH);
  const isEligibleSwipe = useRef(false);

  const navItems = [
    { name: t.home, to: '/' },
    { name: t.trash, to: '/trash' },
    { name: t.contact, to: '/about' },
  ];

  const handleNavClick = (to) => {
    if (location.pathname === to) {
      setIsSidebarOpen(false);
      return;
    }

    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      setTimeout(() => {
        navigate(to);
      }, 700);
    } else {
      navigate(to);
    }
  };

  useEffect(() => {
    if ((isSidebarOpen || isDragging) && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isSidebarOpen, isDragging]);

  useEffect(() => {
    const handleTouchStart = (event) => {
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      if ((!isSidebarOpen && touchX <= EDGE_WIDTH) || isSidebarOpen) {
        isEligibleSwipe.current = true;
        touchStartX.current = touchX;
        touchStartY.current = touchY;
        startOffset.current = isSidebarOpen ? 0 : -SIDEBAR_WIDTH;
      } else {
        isEligibleSwipe.current = false;
      }
    };

    const handleTouchMove = (event) => {
      if (!isEligibleSwipe.current) return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;

      const deltaX = currentX - touchStartX.current;
      const deltaY = currentY - touchStartY.current;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }

      let nextOffset = startOffset.current + deltaX;

      if (nextOffset > 0) nextOffset = 0;
      if (nextOffset < -SIDEBAR_WIDTH) nextOffset = -SIDEBAR_WIDTH;

      setIsDragging(true);
      setSidebarOffset(nextOffset);
    };

    const handleTouchEnd = () => {
      if (!isEligibleSwipe.current) return;

      setIsDragging(false);
      isEligibleSwipe.current = false;

      const threshold = -SIDEBAR_WIDTH * 0.7;

      if (sidebarOffset > threshold) {
        setIsSidebarOpen(true);
        setSidebarOffset(0);
      } else {
        setIsSidebarOpen(false);
        setSidebarOffset(-SIDEBAR_WIDTH);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSidebarOpen, sidebarOffset]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('todo-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const emitAuthChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('todo-auth-changed'));
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const trimmedEmail = loginEmail.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      setLoginError(t.invalidEmail);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await loginWithEmail(trimmedEmail);
      const user = response.data.user;

      localStorage.setItem('todo-user', JSON.stringify(user));
      localStorage.setItem('todo-user-email', user.email);

      setIsSidebarOpen(false);

      setTimeout(() => {
        setCurrentUser(user);
        setLoginError('');
        setLoginEmail(user.email);
        emitAuthChange();
      }, 700);
    } catch (error) {
      setLoginError(error?.response?.data?.message || 'Unable to sign in with email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsSidebarOpen(false);
    setTimeout(() => {
      localStorage.removeItem('todo-user');
      localStorage.removeItem('todo-user-email');
      setCurrentUser(null);
      setLoginEmail('');
      setLoginError('');
      emitAuthChange();
    }, 700);
  };

  const userEmail = currentUser?.email || loginEmail;
  const userInitial = userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : 'G';

  return (
    <div className='min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-900 transition-colors duration-500 dark:bg-[#0f172a] dark:text-slate-50'>
      <div className={`fixed left-0 top-0 z-40 flex items-center transition-opacity duration-500 ${isSidebarOpen ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <button
          type='button'
          onClick={() => setIsSidebarOpen(true)}
          className='m-3 flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-md backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80'
          aria-label='Open sidebar'
        >
          <img src='/Logo.jpg' alt='Redhat logo' className='h-9 w-9 rounded-xl object-cover' />
        </button>
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              key='backdrop'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className='fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-xs lg:hidden'
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden='true'
            />

            <motion.aside
              key='sidebar'
              initial={{ x: -SIDEBAR_WIDTH }}
              animate={{ x: isDragging ? sidebarOffset : 0 }}
              exit={{ x: -SIDEBAR_WIDTH }}
              transition={
                isDragging
                  ? { duration: 0 }
                  : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
              }
              className='fixed left-0 top-0 z-30 flex h-screen h-[100dvh] w-[320px] flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80'
              style={{ touchAction: 'none' }}
            >
              <div className='flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/60'>
                <div className='flex items-center gap-3 rounded-2xl bg-slate-100/80 px-3 py-3 shadow-sm dark:bg-slate-900'>
                  <img src='/Logo.jpg' alt='Redhat logo' className='h-12 w-12 rounded-xl object-cover shadow-sm' />
                  <div className='min-w-0'>
                    <p className='truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white'>Redhat</p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>{t.productivityHub}</p>
                  </div>
                </div>

                <button
                  type='button'
                  onClick={() => setIsSidebarOpen(false)}
                  className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden'
                  aria-label='Close sidebar'
                >
                  <X className='h-4 w-4' />
                </button>

                <button
                  type='button'
                  onClick={() => setIsSidebarOpen(false)}
                  className='hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:flex'
                  aria-label='Collapse sidebar'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
              </div>

              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-5 [overscroll-behavior:contain]' style={{ touchAction: 'pan-y' }}>
                <nav className='space-y-2'>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <button
                        key={item.to}
                        type='button'
                        onClick={() => handleNavClick(item.to)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span className='flex items-center gap-2'>
                          {item.to === '/' ? <Home className='h-4 w-4' /> : null}
                          {item.to === '/trash' ? <Trash2 className='h-4 w-4' /> : null}
                          {item.to === '/about' ? <Mail className='h-4 w-4' /> : null}
                          <span>{item.name}</span>
                        </span>
                        <span className='text-xs text-slate-400'>→</span>
                      </button>
                    );
                  })}

                  <button
                    type='button'
                    onClick={() => setDarkMode((current) => !current)}
                    className='flex w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  >
                    <span className='flex items-center gap-2'>
                      {darkMode ? <SunMedium className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
                      <span>{darkMode ? t.lightMode : t.darkMode}</span>
                    </span>
                    <span className='text-xs text-slate-400'>→</span>
                  </button>

                  <button
                    type='button'
                    onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                    className='group relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  >
                    <span className='z-10 flex items-center gap-2'>
                      <Globe className='h-4 w-4 text-violet-500 transition-transform duration-500 group-hover:rotate-45' />
                      <span>{t.language}:</span>
                    </span>

                    <div className='relative h-5 min-w-[85px] overflow-hidden text-right'>
                      <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                          key={language}
                          initial={{ y: 15, opacity: 0, filter: 'blur(3px)' }}
                          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                          exit={{ y: -15, opacity: 0, filter: 'blur(3px)' }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className='absolute right-0 top-0 inline-block rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                        >
                          {language === 'en' ? t.english : t.vietnamese}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </button>
                </nav>
              </div>

              <div className='shrink-0 overflow-hidden border-t border-slate-200/80 bg-white/80 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80'>
                <AnimatePresence mode='wait'>
                  {currentUser ? (
                    <motion.div
                      key='user-profile'
                      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className='rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/70 dark:bg-emerald-500/10'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <div className='flex min-w-0 items-center gap-3'>
                          <div className='flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white'>
                            {userInitial}
                          </div>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-medium text-slate-700 dark:text-slate-100'>{userEmail}</p>
                            <p className='text-[11px] text-emerald-700 dark:text-emerald-300'>{t.signedIn}</p>
                          </div>
                        </div>

                        <button
                          type='button'
                          onClick={handleLogout}
                          className='inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                        >
                          <LogOut className='h-3.5 w-3.5' />
                          {t.signOut}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key='login-form'
                      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      onSubmit={handleLogin}
                      className='space-y-3'
                    >
                      <label className='flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
                        <UserCircle2 className='h-4 w-4 text-slate-500 dark:text-slate-400' />
                        <input
                          type='email'
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          placeholder={t.emailAddress}
                          className='w-full border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none dark:text-slate-200 dark:placeholder:text-slate-500'
                        />
                      </label>

                      {loginError ? <p className='text-xs text-rose-500'>{loginError}</p> : null}

                      <button
                        type='submit'
                        disabled={isSubmitting}
                        className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform disabled:opacity-60 dark:shadow-violet-900/30'
                      >
                        <LogIn className='h-4 w-4' />
                        {isSubmitting ? t.signingIn : t.signInWithEmail}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className={`min-h-screen transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarOpen ? 'lg:ml-[320px]' : 'lg:ml-0'}`}>
        <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { ChevronLeft, Archive, BarChart3, CalendarDays, ClipboardList, FileText, Mail, Timer, X, Home, Trash2, Menu } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import NotificationCenter from '@/components/NotificationCenter';

const SIDEBAR_WIDTH = 320;
const SIDEBAR_TRANSITION = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] };
const SIDEBAR_TRANSITION_MS = SIDEBAR_TRANSITION.duration * 1000;
const getSidebarWidth = () => typeof window === 'undefined'
  ? SIDEBAR_WIDTH
  : Math.min(SIDEBAR_WIDTH, window.innerWidth * 0.88);

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;

  try {
    const storedUser = localStorage.getItem('todo-user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

export function LayoutShell({ children, hideAccountPanel = false }) {
  const { setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [darkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('todo-theme') !== 'light';
  });
  const [localAccent] = useState(() => (
    ['violet', 'rose', 'emerald', 'amber'].includes(localStorage.getItem('todo-accent'))
      ? localStorage.getItem('todo-accent')
      : 'violet'
  ));

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const navigationTimer = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarX = useMotionValue(-getSidebarWidth());

  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const { preferences, hasLoadedPreferences } = useUserPreferences(currentUser?._id);
  const effectiveDarkMode = hasLoadedPreferences ? preferences.theme === 'dark' : darkMode;
  const renderedChildren = typeof children === 'function'
    ? children({ openSidebar: () => setIsSidebarOpen(true) })
    : children;

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());
    window.addEventListener('todo-auth-changed', syncUser);
    return () => window.removeEventListener('todo-auth-changed', syncUser);
  }, []);

  const shellRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const startOffset = useRef(-getSidebarWidth());
  const currentOffset = useRef(-getSidebarWidth());
  const isEligibleSwipe = useRef(false);
  const isHorizontalSwipe = useRef(false);

  const navItems = [
    { name: t.contact, to: '/about' },
    ...(currentUser ? [
      { name: t.home, to: '/home' },
      { name: t.notes, to: '/notes' },
      { name: t.lists, to: '/lists' },
      { name: t.archive, to: '/archive' },
      { name: t.calendarTitle, to: '/calendar' },
      { name: t.productivityDashboard, to: '/dashboard' },
      { name: t.focusMode, to: '/focus' },
      { name: t.trash, to: '/trash' },
    ] : [])
  ];

  const handleNavClick = (to) => {
    if (navigationTimer.current) {
      window.clearTimeout(navigationTimer.current);
      navigationTimer.current = null;
    }

    if (location.pathname === to) {
      setIsSidebarOpen(false);
      return;
    }

    setIsSidebarOpen(false);

    navigationTimer.current = window.setTimeout(() => {
      navigate(to);
      navigationTimer.current = null;
    }, SIDEBAR_TRANSITION_MS);
  };

  useEffect(() => () => {
    if (navigationTimer.current) {
      window.clearTimeout(navigationTimer.current);
    }
  }, []);

  useEffect(() => {
    if (isDragging) return undefined;
    if (!isSidebarOpen) {
      sidebarX.set(-getSidebarWidth());
      return undefined;
    }
    const controls = animate(sidebarX, 0, SIDEBAR_TRANSITION);
    return () => controls.stop();
  }, [isSidebarOpen, isDragging, sidebarX]);

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
    const shell = shellRef.current;
    if (!shell) return undefined;

    const handleTouchStart = (event) => {
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      // Navigation drawer gestures are disabled while notifications are open.
      if (isNotificationDrawerOpen) {
        isEligibleSwipe.current = false;
        return;
      }
      // Accept horizontal gestures that begin anywhere in the app, not only at the screen edge.
      isEligibleSwipe.current = true;
      isHorizontalSwipe.current = false;
      touchStartX.current = touchX;
      touchStartY.current = touchY;
      startOffset.current = isSidebarOpen ? 0 : -getSidebarWidth();
      currentOffset.current = startOffset.current;
    };

    const handleTouchMove = (event) => {
      if (!isEligibleSwipe.current) return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;

      const deltaX = currentX - touchStartX.current;
      const deltaY = currentY - touchStartY.current;

      if (!isHorizontalSwipe.current) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
          isEligibleSwipe.current = false;
          return;
        }

        if (Math.abs(deltaX) <= 6) return;
        if ((!isSidebarOpen && deltaX < 0) || (isSidebarOpen && deltaX > 0)) {
          isEligibleSwipe.current = false;
          return;
        }
        isHorizontalSwipe.current = true;
        setIsDragging(true);
        if (!isSidebarOpen) setIsSidebarOpen(true);
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      let nextOffset = startOffset.current + deltaX;
      const sidebarWidth = getSidebarWidth();

      if (nextOffset < -sidebarWidth) nextOffset = -sidebarWidth;
      if (nextOffset > 0) nextOffset = 0;

      currentOffset.current = nextOffset;
      sidebarX.set(nextOffset);
    };

    const handleTouchEnd = () => {
      if (!isEligibleSwipe.current || !isHorizontalSwipe.current) return;

      setIsDragging(false);
      isEligibleSwipe.current = false;

      const sidebarWidth = getSidebarWidth();
      const shouldRemainOpen = isSidebarOpen
        ? currentOffset.current > -sidebarWidth * 0.3
        : currentOffset.current > -sidebarWidth * 0.7;

      if (shouldRemainOpen) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
      setIsDragging(false);
    };

    shell.addEventListener('touchstart', handleTouchStart, { passive: true });
    shell.addEventListener('touchmove', handleTouchMove, { passive: false });
    shell.addEventListener('touchend', handleTouchEnd, { passive: true });
    shell.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      shell.removeEventListener('touchstart', handleTouchStart);
      shell.removeEventListener('touchmove', handleTouchMove);
      shell.removeEventListener('touchend', handleTouchEnd);
      shell.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isSidebarOpen, isNotificationDrawerOpen, sidebarX]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveDarkMode);
    localStorage.setItem('todo-theme', effectiveDarkMode ? 'dark' : 'light');
  }, [effectiveDarkMode]);

  useEffect(() => {
    if (!hasLoadedPreferences) return;

    document.documentElement.dataset.accent = preferences.accent;
    setLanguage(preferences.language);
  }, [hasLoadedPreferences, preferences.theme, preferences.accent, preferences.language, setLanguage]);

  useEffect(() => {
    if (hasLoadedPreferences) return;
    document.documentElement.dataset.accent = localAccent;
  }, [hasLoadedPreferences, localAccent]);

  const userEmail = currentUser?.email || '';
  const displayName = currentUser?.name?.trim() || userEmail;
  const userInitial = displayName ? displayName.slice(0, 2).toUpperCase() : 'G';

  return (
    <div ref={shellRef} className='min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-900 transition-colors duration-500 dark:bg-[#0f172a] dark:text-slate-50'>
      <div className={`fixed left-0 top-0 z-40 m-3 flex items-center gap-2 transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarOpen ? 'pointer-events-none opacity-0' : 'opacity-100'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          type='button'
          onClick={() => { if (!isNotificationDrawerOpen) setIsSidebarOpen(true); }}
          className={`flex h-12 w-12 items-center justify-center rounded-3xl border border-violet-300/70 bg-white/85 text-violet-700 shadow-md backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/25 dark:border-violet-500/30 dark:bg-slate-900/85 dark:text-violet-200 ${isNotificationDrawerOpen ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-500/10'}`}
          aria-label={t.openNavigation || 'Open navigation'}
          disabled={isNotificationDrawerOpen}
          aria-disabled={isNotificationDrawerOpen}
        >
          <Menu className='h-5 w-5 text-slate-700 dark:text-slate-200' />
        </button>
      </div>
      {currentUser?._id ? (
        <div
          className={`fixed right-0 top-0 m-3 transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarOpen ? 'z-40 opacity-45 hover:opacity-100 focus-within:opacity-100 max-lg:pointer-events-none max-lg:invisible' : 'visible z-40 opacity-100'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <NotificationCenter userId={currentUser._id} navigationOpen={isSidebarOpen} onDrawerOpenChange={setIsNotificationDrawerOpen} />
        </div>
      ) : null}

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              key='backdrop'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SIDEBAR_TRANSITION}
              className='fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-none md:backdrop-blur-xs lg:hidden'
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden='true'
            />

            <motion.aside
              key='sidebar'
              initial={false}
              exit={{ x: -getSidebarWidth(), opacity: 0 }}
              transition={SIDEBAR_TRANSITION}
              className='fixed left-0 top-0 z-30 flex h-[100dvh] min-h-0 w-[min(320px,88vw)] flex-col border-r border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95 md:bg-white/80 md:backdrop-blur-xl md:dark:bg-slate-950/80'
              style={{ x: sidebarX, touchAction: 'none' }}
            >
              <div className='flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/60'>
                <div className='flex items-center gap-3 rounded-3xl border border-violet-200/80 bg-violet-50/70 px-3 py-3 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10'>
                  <span className='rounded-2xl bg-gradient-to-br from-violet-400 via-violet-600 to-violet-800 p-[2px] shadow-md shadow-violet-500/20'>
                    <img src='/Logo.jpg' alt='Redhat logo' draggable={false} onDragStart={(event) => event.preventDefault()} className='h-12 w-12 select-none rounded-[14px] border border-white/70 object-cover dark:border-slate-900 [-webkit-touch-callout:none]' />
                  </span>
                  <div className='min-w-0'>
                    <p className='truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white'>Redhat</p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>{t.productivityHub}</p>
                  </div>
                </div>

                <button
                  type='button'
                  onClick={() => setIsSidebarOpen(false)}
                  className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-3xl border border-violet-300/70 bg-white text-violet-700 shadow-sm transition hover:bg-violet-50 dark:border-violet-500/30 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-500/10 lg:hidden'
                  aria-label='Close sidebar'
                >
                  <X className='h-4 w-4' />
                </button>

                <button
                  type='button'
                  onClick={() => setIsSidebarOpen(false)}
                  className='hidden h-9 w-9 cursor-pointer items-center justify-center rounded-3xl border border-violet-300/70 bg-white text-violet-700 shadow-sm transition hover:bg-violet-50 dark:border-violet-500/30 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-500/10 lg:flex'
                  aria-label='Collapse sidebar'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
              </div>

              <div className='sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 [overscroll-behavior:contain]' style={{ touchAction: 'pan-y' }}>
                <nav className='space-y-2'>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <button
                        key={item.to}
                        type='button'
                        onClick={() => handleNavClick(item.to)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-3xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span className='flex items-center gap-2'>
                          {item.to === '/home' ? <Home className='h-4 w-4' /> : null}
                          {item.to === '/dashboard' ? <BarChart3 className='h-4 w-4' /> : null}
                          {item.to === '/calendar' ? <CalendarDays className='h-4 w-4' /> : null}
                          {item.to === '/focus' ? <Timer className='h-4 w-4' /> : null}
                          {item.to === '/lists' ? <ClipboardList className='h-4 w-4' /> : null}
                          {item.to === '/notes' ? <FileText className='h-4 w-4' /> : null}
                          {item.to === '/archive' ? <Archive className='h-4 w-4' /> : null}
                          {item.to === '/trash' ? <Trash2 className='h-4 w-4' /> : null}
                          {item.to === '/about' ? <Mail className='h-4 w-4' /> : null}
                          <span>{item.name}</span>
                        </span>
                        <span className='text-xs text-slate-400'>→</span>
                      </button>
                    );
                  })}

                </nav>
              </div>

              {!hideAccountPanel && currentUser ? (
                <div className='mt-auto flex shrink-0 justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3'>
                  <button
                    type='button'
                    onClick={() => handleNavClick('/settings')}
                    title={t.settings}
                    aria-label={t.settings}
                    className={`group flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-2xl transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/30 ${location.pathname === '/settings' ? 'ring-2 ring-violet-500/70' : ''}`}
                  >
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt='' className='h-full w-full object-cover transition-opacity group-hover:opacity-60' />
                    ) : (
                      <span className='flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-bold text-white transition-opacity group-hover:opacity-60'>
                        {userInitial}
                      </span>
                    )}
                  </button>
                </div>
              ) : null}

            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className={`min-h-screen transition-all duration-[240ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isSidebarOpen ? 'lg:ml-[320px]' : 'lg:ml-0'}`}>
        <div className='mx-auto max-w-6xl px-4 pb-8 sm:px-6' style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))' }}>
          {renderedChildren}
        </div>
      </main>
    </div>
  );
}

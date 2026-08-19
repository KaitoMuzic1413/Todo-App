import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
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
  const startOffset = useRef(-SIDEBAR_WIDTH);
  const isEligibleSwipe = useRef(false);

  const navItems = [
    { name: t.home, to: '/' },
    { name: t.trash, to: '/trash' },
    { name: t.contact, to: '/about' },
  ];

  // Khóa cuộn trang chính (`body`) khi Sidebar đang mở trên Mobile
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 1024) {
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
  }, [isSidebarOpen]);

  // Logic kéo Sidebar bám tay
  useEffect(() => {
    const handleTouchStart = (event) => {
      const touchX = event.touches[0].clientX;

      if ((!isSidebarOpen && touchX <= EDGE_WIDTH) || isSidebarOpen) {
        isEligibleSwipe.current = true;
        touchStartX.current = touchX;
        startOffset.current = isSidebarOpen ? 0 : -SIDEBAR_WIDTH;
      } else {
        isEligibleSwipe.current = false;
      }
    };

    const handleTouchMove = (event) => {
      if (!isEligibleSwipe.current) return;

      const currentX = event.touches[0].clientX;
      const deltaX = currentX - touchStartX.current;

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

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSidebarOpen, sidebarOffset]);

  useEffect(() => {
    if (!isDragging) {
      setSidebarOffset(isSidebarOpen ? 0 : -SIDEBAR_WIDTH);
    }
  }, [isSidebarOpen, isDragging]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('todo-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const blockDevTools = (event) => {
      const isMetaCombo = event.metaKey || event.ctrlKey;
      const isBlockedCombo =
        (isMetaCombo && event.shiftKey && ['i', 'j', 'c', 'u'].includes(event.key.toLowerCase())) ||
        (isMetaCombo && event.key.toLowerCase() === 's');

      if (event.key === 'F12') return;

      if (isBlockedCombo || event.key === 'ContextMenu') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockContextMenu = (event) => {
      event.preventDefault();
    };

    window.addEventListener('keydown', blockDevTools);
    window.addEventListener('contextmenu', blockContextMenu);

    return () => {
      window.removeEventListener('keydown', blockDevTools);
      window.removeEventListener('contextmenu', blockContextMenu);
    };
  }, []);

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
      setCurrentUser(user);
      setLoginError('');
      setLoginEmail(user.email);
      emitAuthChange();
    } catch (error) {
      setLoginError(error?.response?.data?.message || 'Unable to sign in with email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('todo-user');
    localStorage.removeItem('todo-user-email');
    setCurrentUser(null);
    setLoginEmail('');
    setLoginError('');
    emitAuthChange();
  };

  const userEmail = currentUser?.email || loginEmail;
  const userInitial = userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : 'G';
  const backdropOpacity = Math.max(0, (SIDEBAR_WIDTH + sidebarOffset) / SIDEBAR_WIDTH);

  return (
    <div className='min-h-screen bg-[#f5f7fb] text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-50'>
      <style>{`@keyframes shimmer {0%{background-position:0 0}100%{background-position:200% 0}} .active-animated{background:linear-gradient(90deg,#10b981,#34d399);background-size:200% 100%;animation:shimmer 1s linear infinite}`}</style>

      {/* Nút mở Sidebar khi đang đóng */}
      <div className={`fixed left-0 top-0 z-40 flex items-center transition-opacity duration-300 ${isSidebarOpen ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <button
          type='button'
          onClick={() => setIsSidebarOpen(true)}
          className='m-3 flex h-12 w-12 cursor-default items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-md backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80'
          aria-label='Open sidebar'
        >
          <img src='/Logo.jpg' alt='Redhat logo' className='h-9 w-9 rounded-xl object-cover' />
        </button>
      </div>

      {/* Backdrop mờ */}
      <div
        className={`fixed inset-0 z-20 bg-slate-950/35 lg:hidden ${
          sidebarOffset > -SIDEBAR_WIDTH ? 'pointer-events-auto' : 'pointer-events-none'
        } ${isDragging ? '' : 'transition-opacity duration-300'}`}
        style={{ opacity: backdropOpacity }}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden='true'
      />

      {/* Sidebar chính */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen h-[100dvh] w-[320px] flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        }`}
        style={{
          transform: `translateX(${sidebarOffset}px)`,
          touchAction: 'none', // Chặn cuộn dọc mặc định của trình duyệt tác động lên trang sau
        }}
      >
        {/* Header Cố định */}
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
            className='flex h-9 w-9 cursor-default items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden'
            aria-label='Close sidebar'
          >
            <X className='h-4 w-4' />
          </button>

          <button
            type='button'
            onClick={() => setIsSidebarOpen(false)}
            className='hidden h-9 w-9 cursor-default items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:flex'
            aria-label='Collapse sidebar'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
        </div>

        {/* Vùng Menu có cuộn nội dung */}
        <div
          className='min-h-0 flex-1 overflow-y-auto px-4 py-5 [overscroll-behavior:contain]'
          style={{ touchAction: 'pan-y' }} // Chỉ cho phép cuộn nội bộ danh sách menu
        >
          <nav className='space-y-2'>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={({ isActive }) =>
                  `flex cursor-default items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`
                }
              >
                <span className='flex items-center gap-2'>
                  {item.to === '/' ? <Home className='h-4 w-4' /> : null}
                  {item.to === '/trash' ? <Trash2 className='h-4 w-4' /> : null}
                  {item.to === '/about' ? <Mail className='h-4 w-4' /> : null}
                  <span>{item.name}</span>
                </span>
                <span className='text-xs text-slate-400'>→</span>
              </NavLink>
            ))}

            <button
              type='button'
              onClick={() => setDarkMode((current) => !current)}
              className='flex w-full cursor-default items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
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
              className='flex w-full cursor-default items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
            >
              <span className='flex items-center gap-2'>
                <Globe className='h-4 w-4' />
                <span>{t.language}: {language === 'en' ? t.english : t.vietnamese}</span>
              </span>
              <span className='text-xs text-slate-400'>→</span>
            </button>
          </nav>
        </div>

        {/* Footer Cố định */}
        <div className='shrink-0 border-t border-slate-200/80 bg-white/80 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80'>
          {currentUser ? (
            <div className='rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/70 dark:bg-emerald-500/10'>
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
                  className='inline-flex cursor-default items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                >
                  <LogOut className='h-3.5 w-3.5' />
                  {t.signOut}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className='space-y-3'>
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
                className='inline-flex w-full cursor-default items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform disabled:opacity-60 dark:shadow-violet-900/30'
              >
                <LogIn className='h-4 w-4' />
                {isSubmitting ? t.signingIn : t.signInWithEmail}
              </button>
            </form>
          )}
        </div>
      </aside>

      <main className={`min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-[320px]' : 'lg:ml-0'}`}>
        <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6'>{children}</div>
      </main>
    </div>
  );
}
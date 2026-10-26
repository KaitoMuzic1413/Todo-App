import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { PageTransition } from './components/PageTransition';
import AboutPage from './pages/AboutPage';
import DownloadPage from './pages/DownloadPage';
import HomePages from './pages/HomePage';
import SignUpPage from './pages/Login/SignUpPage';
import SignInPage from './pages/Login/SignInPage';
import ForgotPasswordPage from './pages/Login/ForgotPasswordPage';
import ResetPasswordPage from './pages/Login/ResetPasswordPage';
import NotFound from './pages/NotFound';
import TrashPage from './pages/TrashPage';
import ArchivePage from './pages/ArchivePage';
import CalendarPage from './pages/CalendarPage';
import FocusPage from './pages/FocusPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import AdminNotificationsPage from './pages/AdminNotificationsPage';
import DueTaskReminderWatcher from './components/DueTaskReminderWatcher';
import InstallAppNotice from './components/InstallAppNotice';
import { fetchCurrentUser } from './lib/api';
import { prefetchDesktopReleases } from './lib/desktopReleases';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const ProtectedRoute = () => {
  const storedUser = localStorage.getItem('todo-user');
  const user = (() => {
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  })();
  const token = localStorage.getItem('token');

  if (!user?._id || !token?.trim()) {
    return <Navigate to='/signin' replace />;
  }

  return <Outlet />;
};

const AdminRoute = () => {
  const [access, setAccess] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then(({ data }) => {
        if (cancelled) return;

        const currentUser = data?.user;
        if (!currentUser?._id) {
          setAccess('denied');
          return;
        }

        let storedUser = {};
        try {
          storedUser = JSON.parse(localStorage.getItem('todo-user') || '{}');
        } catch {
          // Replace invalid cached user data with the authenticated server response.
        }

        localStorage.setItem('todo-user', JSON.stringify({ ...storedUser, ...currentUser }));
        setAccess(currentUser.isAdmin ? 'allowed' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setAccess('denied');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (access === 'checking') {
    return <div className='min-h-[40vh]' role='status' aria-label='Checking access' />;
  }

  return access === 'allowed' ? <AdminNotificationsPage /> : <Navigate to='/settings' replace />;
};

const RootRedirect = () => {
  const user = localStorage.getItem('todo-user');
  const token = localStorage.getItem('token');
  return <Navigate to={user && token ? '/dashboard' : '/signin'} replace />;
};

function App() {
  const location = useLocation();

  useEffect(() => {
    void prefetchDesktopReleases();
  }, []);

  useEffect(() => {
    if (!isTauri()) return undefined;

    const checkForDesktopUpdate = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (!update) return;

        await update.downloadAndInstall();
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch (error) {
        console.warn('Could not check for or install a desktop update:', error);
      }
    };

    const timer = window.setTimeout(checkForDesktopUpdate, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const blockDevToolsShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const isDevToolsShortcut = event.key === 'F12'
        || ((event.ctrlKey || event.metaKey) && key === 'u')
        || (event.ctrlKey && event.shiftKey && ['i', 'j', 'c', 'k', 'm'].includes(key))
        || (event.metaKey && event.altKey && ['i', 'j', 'c'].includes(key));

      if (isDevToolsShortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const blockContextMenu = (event) => event.preventDefault();

    document.addEventListener('keydown', blockDevToolsShortcuts, true);
    document.addEventListener('contextmenu', blockContextMenu, true);
    return () => {
      document.removeEventListener('keydown', blockDevToolsShortcuts, true);
      document.removeEventListener('contextmenu', blockContextMenu, true);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <InstallAppNotice />
      <DueTaskReminderWatcher />
      <AnimatePresence mode='wait'>
      <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path='/' element={<RootRedirect />} />

        <Route path='/signin' element={<SignInPage />} />
        <Route path='/signup' element={<SignUpPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />
        <Route path='/about' element={<AboutPage />} />
        <Route path='/download' element={<DownloadPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path='/home' element={<HomePages />} />
          <Route path='/calendar' element={<CalendarPage />} />
          <Route path='/focus' element={<FocusPage />} />
          <Route path='/dashboard' element={<DashboardPage />} />
          <Route path='/lists' element={<HomePages contentType='list' />} />
          <Route path='/notes' element={<HomePages contentType='note' />} />
          <Route path='/archive' element={<ArchivePage />} />
          <Route path='/trash' element={<TrashPage />} />
          <Route path='/settings' element={<SettingsPage />} />
          <Route path='/admin/notifications' element={<AdminRoute />} />
        </Route>

        <Route path='/404' element={<NotFound />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
      </PageTransition>
      </AnimatePresence>
      <Toaster richColors position='top-right' />
    </QueryClientProvider>
  );
}

export default App;

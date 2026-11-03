import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { PageTransition } from './components/PageTransition';
const AboutPage = lazy(() => import('./pages/AboutPage'));
const HomePages = lazy(() => import('./pages/HomePage'));
const SignUpPage = lazy(() => import('./pages/Login/SignUpPage'));
const SignInPage = lazy(() => import('./pages/Login/SignInPage'));
const ForgotPasswordPage = lazy(() => import('./pages/Login/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/Login/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/Login/VerifyEmailPage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const InviteCreatePage = lazy(() => import('./pages/InviteCreatePage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const FocusPage = lazy(() => import('./pages/FocusPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LegalPoliciesPage = lazy(() => import('./pages/LegalPoliciesPage'));
const AdminNotificationsPage = lazy(() => import('./pages/AdminNotificationsPage'));
import DueTaskReminderWatcher from './components/DueTaskReminderWatcher';
import OfflineStatus from './components/OfflineStatus';
import PushOptInBanner from './components/PushOptInBanner';
import PushSubscriptionSync from './components/PushSubscriptionSync';
import { fetchCurrentUser } from './lib/api';

const LEGAL_ACCEPTANCE_VERSION = '2026-10-26';

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

  if (localStorage.getItem('todo-legal-accepted-version') !== LEGAL_ACCEPTANCE_VERSION) {
    return <Navigate to='/signin' replace />;
  }

  return <Outlet />;
};

const AdminRoute = ({ children }) => {
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

  return access === 'allowed' ? children : <Navigate to='/settings' replace />;
};

const RootRedirect = () => {
  const user = localStorage.getItem('todo-user');
  const token = localStorage.getItem('token');
  const acceptedPolicies = localStorage.getItem('todo-legal-accepted-version') === LEGAL_ACCEPTANCE_VERSION;
  return <Navigate to={user && token && acceptedPolicies ? '/dashboard' : '/signin'} replace />;
};

function App() {
  const location = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <DueTaskReminderWatcher />
      <PushSubscriptionSync />
      <OfflineStatus />
      <PushOptInBanner />
      <AnimatePresence mode='wait'>
      <PageTransition key={location.pathname}>
      <Suspense fallback={
        <div className='grid min-h-[50vh] place-items-center p-6' role='status' aria-live='polite'>
          <div className='flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/90 px-5 py-4 text-sm font-medium text-slate-600 shadow-lg dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-300'>
            <span className='h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 motion-reduce:animate-none' aria-hidden='true' />
            Loading page…
          </div>
        </div>
      }>
      <Routes location={location}>
        <Route path='/' element={<RootRedirect />} />

        <Route path='/signin' element={<SignInPage />} />
        <Route path='/signup' element={<SignUpPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />
        <Route path='/verify-email' element={<VerifyEmailPage />} />
        <Route path='/about' element={<AboutPage />} />
        <Route path='/policies/:policySlug' element={<LegalPoliciesPage />} />

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
          <Route path='/premium' element={<PremiumPage />} />
          <Route path='/admin/notifications' element={<AdminRoute><AdminNotificationsPage /></AdminRoute>} />
          <Route path='/invite/create' element={<AdminRoute><InviteCreatePage /></AdminRoute>} />
        </Route>

        <Route path='/404' element={<NotFound />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
      </Suspense>
      </PageTransition>
      </AnimatePresence>
      <Toaster richColors position='top-right' />
    </QueryClientProvider>
  );
}

export default App;

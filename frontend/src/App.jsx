import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { PageTransition } from './components/PageTransition';
import AboutPage from './pages/AboutPage';
import HomePages from './pages/HomePage';
import SignUpPage from './pages/Login/SignUpPage';
import SignInPage from './pages/Login/SignInPage';
import ForgotPasswordPage from './pages/Login/ForgotPasswordPage';
import ResetPasswordPage from './pages/Login/ResetPasswordPage';
import NotFound from './pages/NotFound';
import TrashPage from './pages/TrashPage';
import ArchivePage from './pages/ArchivePage';

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

const RootRedirect = () => {
  const user = localStorage.getItem('todo-user');
  const token = localStorage.getItem('token');
  return <Navigate to={user && token ? '/home' : '/signin'} replace />;
};

function App() {
  const location = useLocation();

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
      <AnimatePresence mode='wait'>
      <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path='/' element={<RootRedirect />} />

        <Route path='/signin' element={<SignInPage />} />
        <Route path='/signup' element={<SignUpPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />
        <Route path='/about' element={<AboutPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path='/home' element={<HomePages />} />
          <Route path='/lists' element={<HomePages contentType='list' />} />
          <Route path='/notes' element={<HomePages contentType='note' />} />
          <Route path='/archive' element={<ArchivePage />} />
          <Route path='/trash' element={<TrashPage />} />
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
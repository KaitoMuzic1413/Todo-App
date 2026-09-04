import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom'; // Bỏ BrowserRouter ở đây
import { Toaster } from 'sonner';
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
    return <Navigate to='/404' replace />;
  }

  return <Outlet />;
};

const RootRedirect = () => {
  const user = localStorage.getItem('todo-user');
  const token = localStorage.getItem('token');
  return <Navigate to={user && token ? '/home' : '/signin'} replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {/* Default route handles automatic redirect */}
        <Route path='/' element={<RootRedirect />} />

        {/* Public authentication routes */}
        <Route path='/signin' element={<SignInPage />} />
        <Route path='/signup' element={<SignUpPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />
        <Route path='/about' element={<AboutPage />} />

        {/* Protected routes - Requires authentication */}
        <Route element={<ProtectedRoute />}>
          <Route path='/home' element={<HomePages />} />
          <Route path='/lists' element={<HomePages contentType='list' />} />
          <Route path='/notes' element={<HomePages contentType='note' />} />
          <Route path='/archive' element={<ArchivePage />} />
          <Route path='/trash' element={<TrashPage />} />
        </Route>

        {/* 404 Not Found fallback routes */}
        <Route path='/404' element={<NotFound />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
      <Toaster richColors position='top-right' />
    </QueryClientProvider>
  );
}

export default App;
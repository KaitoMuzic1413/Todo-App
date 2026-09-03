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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const ProtectedRoute = () => {
  const user = localStorage.getItem('todo-user');
  const token = localStorage.getItem('token');

  if (!user || !token) {
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
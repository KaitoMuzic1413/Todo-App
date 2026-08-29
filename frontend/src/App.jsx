import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router';
import { Toaster } from 'sonner';
import AboutPage from './pages/AboutPage';
import HomePages from './pages/HomePage';
import SignUpPage from './pages/Login/SignUpPage';
import NotFound from './pages/NotFound';
import TrashPage from './pages/TrashPage';
import SignInPage from './pages/Login/SignInPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// Component to protect private routes
const ProtectedRoute = () => {
  const user = localStorage.getItem('todo-user');

  // If user is not logged in, redirect to signin page
  if (!user) {
    return <Navigate to='/signin' replace />;
  }

  // If logged in, render child routes
  return <Outlet />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Default entry point redirects to /signin */}
          <Route path='/' element={<SignInPage />} />
          <Route path='/signin' element={<SignInPage />} />
          <Route path='/signup' element={<SignUpPage />} />

          {/* Protected routes - Require user login */}
          <Route element={<ProtectedRoute />}>
            <Route path='/home' element={<HomePages />} />
            <Route path='/about' element={<AboutPage />} />
            <Route path='/trash' element={<TrashPage />} />
          </Route>

          {/* 404 Not Found */}
          <Route path='*' element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position='top-right' />
    </QueryClientProvider>
  );
}

export default App;
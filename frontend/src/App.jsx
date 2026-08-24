import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import AboutPage from './pages/AboutPage';
import HomePages from './pages/HomePage';
import Login from './pages/LoginPage';
import NotFound from './pages/NotFound';
import TrashPage from './pages/TrashPage';

// 1. Khởi tạo QueryClient bên ngoài component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Tránh tự động refetch lại khi đổi tab browser (tùy chọn)
      staleTime: 1000 * 60 * 5, // Cache dữ liệu trong 5 phút
    },
  },
});

function App() {
  return (
    // 2. Bọc Provider ở ngoài cùng
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<HomePages />} />
          <Route path='/about' element={<AboutPage />} />
          <Route path='/trash' element={<TrashPage />} />
          <Route path='/login' element={<Login />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position='top-right' />
    </QueryClientProvider>
  );
}

export default App;
import { Toaster } from 'sonner';
import { BrowserRouter, Route, Routes } from 'react-router';
import AboutPage from './pages/AboutPage';
import HomePages from './pages/HomePage';
import Login from './pages/LoginPage';
import NotFound from './pages/NotFound';
import TrashPage from './pages/TrashPage';

function App() {
  return (
    <>
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
    </>
  );
}

export default App;
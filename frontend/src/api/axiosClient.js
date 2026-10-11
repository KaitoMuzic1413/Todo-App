import axios from 'axios';
import { API_BASE_URL } from '../lib/apiConfig';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    const refreshedToken = response.headers?.['x-auth-token'];
    if (refreshedToken) localStorage.setItem('token', refreshedToken);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message;

      if (errorCode === 'REAUTH_REQUIRED' || errorCode === 'SESSION_REVOKED' || errorMessage?.includes('Token invalid')) {
        localStorage.removeItem('todo-user');
        localStorage.removeItem('todo-user-email');
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        sessionStorage.clear();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('todo-auth-expired'));
        }

        if (typeof window !== 'undefined' && !window.location.pathname.includes('/signin')) {
          window.location.href = '/signin';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;

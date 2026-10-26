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
      // Treat all unauthorized responses consistently across both Axios clients.
      [
        'todo-user',
        'todo-user-email',
        'token',
        'accessToken',
        'user',
      ].forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('todo-auth-expired'));
        window.dispatchEvent(new Event('todo-auth-changed'));

        if (!window.location.pathname.includes('/signin')) {
          window.location.href = '/signin';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;

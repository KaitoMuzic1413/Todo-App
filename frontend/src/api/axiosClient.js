import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'https://todo-app-seven-mocha-91.vercel.app',
});

axiosClient.interceptors.request.use((config) => {
  // Try both 'accessToken' and 'token' keys for backward compatibility
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle session expiration and auth errors
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle session expiration and auth errors
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message;

      // Clear auth data on session expiration or invalid token
      if (errorCode === 'REAUTH_REQUIRED' || errorCode === 'SESSION_REVOKED' || errorMessage?.includes('Token invalid')) {
        localStorage.removeItem('todo-user');
        localStorage.removeItem('todo-user-email');
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        sessionStorage.clear();

        // Dispatch event to notify components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('todo-auth-expired'));
        }

        // Redirect to login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/signin')) {
          window.location.href = '/signin';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
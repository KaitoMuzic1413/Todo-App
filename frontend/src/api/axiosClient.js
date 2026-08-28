import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'https://todo-app-seven-mocha-91.vercel.app',
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
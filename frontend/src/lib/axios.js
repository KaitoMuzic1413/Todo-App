import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'development'
    ? 'http://localhost:5001/api'
    : 'https://todo-app-1112.onrender.com/api');

console.log("Current API Base URL:", BASE_URL); // Log ra để kiểm tra xem Frontend đang bắn API đi đâu

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

export default api;
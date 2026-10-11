export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'development'
    ? 'http://localhost:5001/api'
    : 'https://todo-app-1112.onrender.com/api');

export const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

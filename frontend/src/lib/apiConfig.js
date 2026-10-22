const DEFAULT_PRODUCTION_API = 'https://todo-app-1112.onrender.com/api';
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
const defaultApiUrl = import.meta.env.MODE === 'development'
  ? 'http://localhost:5001/api'
  : DEFAULT_PRODUCTION_API;
const candidateApiUrl = configuredApiUrl || defaultApiUrl;

const isLoopbackApi = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
};

export const API_BASE_URL = import.meta.env.MODE !== 'development' && isLoopbackApi(candidateApiUrl)
  ? DEFAULT_PRODUCTION_API
  : candidateApiUrl;

export const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

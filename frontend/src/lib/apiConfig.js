const DEFAULT_PRODUCTION_API = 'https://todo-app-itr6.onrender.com/api';
const SAME_ORIGIN_API = '/api';

const configuredApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();

const isLoopbackApi = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
};

const isCloudflareHost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith('.workers.dev') || hostname.endsWith('.pages.dev');
};

const isNativeRuntime = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__)
    || Boolean(window.Capacitor)
    || window.location.protocol === 'tauri:'
    || window.location.protocol === 'capacitor:';
};

const resolveApiBaseUrl = () => {
  // An explicitly configured path (for example "/api") is always respected.
  if (configuredApiUrl.startsWith('/')) return configuredApiUrl;

  if (import.meta.env.MODE === 'development') {
    // Use Vite's proxy so both localhost and phones on the LAN call the API
    // through the frontend origin instead of resolving localhost on the device.
    return configuredApiUrl && !isLoopbackApi(configuredApiUrl)
      ? configuredApiUrl
      : SAME_ORIGIN_API;
  }

  // On Cloudflare Workers, the Worker proxies /api to the API server. Requests
  // stay same-origin, so the browser never performs a cross-origin XHR.
  if (isCloudflareHost()) return SAME_ORIGIN_API;

  if (configuredApiUrl && !isLoopbackApi(configuredApiUrl)) return configuredApiUrl;
  if (isNativeRuntime()) return DEFAULT_PRODUCTION_API;

  return DEFAULT_PRODUCTION_API;
};

export const API_BASE_URL = resolveApiBaseUrl();

export const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

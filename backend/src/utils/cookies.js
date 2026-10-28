import { env } from '../config/env.js';

export const REFRESH_TOKEN_COOKIE = 'todo_refresh';
export const AUTH_COOKIE_PATH = '/api/auth';

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: AUTH_COOKIE_PATH,
});

export const setRefreshTokenCookie = (res, token, maxAgeMs) => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: maxAgeMs,
  });
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions());
};

export const readCookie = (cookieHeader, name) => {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
};

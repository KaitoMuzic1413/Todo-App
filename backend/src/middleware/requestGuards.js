import { isAllowedOrigin } from '../config/env.js';

const crossOriginError = (res) => res.status(403).json({ message: 'Request origin is not allowed.' });

export const requireTrustedOrigin = (req, res, next) => {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'This request must come from the application.' });
  }

  const origin = req.get('Origin');
  if (origin && !isAllowedOrigin(origin)) return crossOriginError(res);

  return next();
};

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
};

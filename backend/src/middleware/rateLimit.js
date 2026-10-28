const stores = new WeakSet();

const startCleanup = (store, windowMs) => {
  if (stores.has(store)) return;
  stores.add(store);

  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, Math.min(windowMs, 60 * 1000));

  if (typeof interval.unref === 'function') interval.unref();
};

export const createRateLimiter = ({
  windowMs,
  limit,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip,
}) => {
  const store = new Map();
  startCleanup(store, windowMs);

  return (req, res, next) => {
    const key = keyGenerator(req) || req.ip || 'unknown';
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);

    res.setHeader('RateLimit-Limit', limit);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > limit) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
};

const normalizedEmail = (req) => {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: 'Too many API requests. Please slow down and try again shortly.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: 'Too many authentication attempts. Please try again later.',
});

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many sign-in attempts. Please try again later.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${normalizedEmail(req)}`,
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset requests. Please try again later.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${normalizedEmail(req)}`,
});

export const emailVerificationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  message: 'Too many verification requests. Please try again later.',
  keyGenerator: (req) => `${req.ip || 'unknown'}:${normalizedEmail(req)}`,
});

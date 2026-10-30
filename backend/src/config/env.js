import 'dotenv/config';

const MIN_SECRET_LENGTH = 32;

const readRequired = (name) => {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

const readSecret = (name) => {
  const value = readRequired(name);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters long.`);
  }
  return value;
};

const readUrl = (name) => {
  const value = readRequired(name);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute HTTP or HTTPS URL.`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin === 'null') {
    throw new Error(`${name} must be a valid absolute HTTP or HTTPS URL.`);
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url.origin;
};

const readOptionalList = (name) => (process.env[name] || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const hasEmailDeliveryConfig = () => {
  const configuredProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const provider = configuredProvider
    || (process.env.SENDGRID_API_KEY ? 'sendgrid' : process.env.RESEND_API_KEY ? 'resend' : 'smtp');

  if (provider === 'sendgrid') {
    return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
  }
  if (provider === 'resend') {
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  }
  if (provider === 'smtp') {
    return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  }
  return false;
};

const readVapidConfig = () => {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!publicKey && !privateKey) return { vapidPublicKey: '', vapidPrivateKey: '', vapidSubject: '' };
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together.');
  }
  const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim();
  if (!/^(mailto:|https?:\/\/)/i.test(subject)) {
    throw new Error('VAPID_SUBJECT must be a mailto: or https:// URL.');
  }
  return { vapidPublicKey: publicKey, vapidPrivateKey: privateKey, vapidSubject: subject };
};

const buildEnv = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const emailDeliveryConfigured = hasEmailDeliveryConfig();
  const requestedEmailVerification = process.env.EMAIL_VERIFICATION_REQUIRED === undefined
    ? nodeEnv === 'production'
    : process.env.EMAIL_VERIFICATION_REQUIRED === 'true';
  const emailVerificationRequired = requestedEmailVerification && emailDeliveryConfigured;

  if (requestedEmailVerification && !emailDeliveryConfigured) {
    console.warn(
      'EMAIL_VERIFICATION_REQUIRED is enabled but no email provider is configured. '
      + 'Email verification has been disabled so accounts remain usable.'
    );
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: parsePositiveInteger(process.env.PORT, 5001),
    mongoUri: readRequired('MONGODB_CONNECTIONSTRING'),
    jwtSecret: readSecret('JWT_SECRET'),
    otpSecret: readSecret('OTP_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenTtlDays: parsePositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
    frontendUrl: readUrl('FRONTEND_URL'),
    extraCorsOrigins: readOptionalList('CORS_ORIGINS'),
    adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    emailDeliveryConfigured,
    emailVerificationRequired,
    ...readVapidConfig(),
  };
};

export const env = buildEnv();

const normalizeOrigin = (value) => {
  try {
    const origin = new URL(value).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return value;
  }
};

const DESKTOP_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const allowedOrigins = new Set(
  [env.frontendUrl, ...env.extraCorsOrigins, ...DESKTOP_ORIGINS, ...(env.isProduction ? [] : DEVELOPMENT_ORIGINS)]
    .filter(Boolean)
    .flatMap((origin) => [origin, normalizeOrigin(origin)])
    .filter((origin) => origin && origin !== 'null')
);

const isDevelopmentLoopbackOrigin = (origin) => {
  if (env.isProduction || typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && url.origin === origin;
  } catch {
    return false;
  }
};

// Vite's LAN URL changes with the local network. In development, trust only
// HTTP origins on Vite's port from RFC1918 private IPv4 ranges.
const isDevelopmentLanOrigin = (origin) => {
  if (env.isProduction || typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.port !== '5173' || url.origin !== origin) return false;

    const octets = url.hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }

    const [first, second] = octets;
    return first === 10
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  } catch {
    return false;
  }
};

export const isAllowedOrigin = (origin) => (
  !origin
  || allowedOrigins.has(origin)
  || isDevelopmentLoopbackOrigin(origin)
  || isDevelopmentLanOrigin(origin)
);

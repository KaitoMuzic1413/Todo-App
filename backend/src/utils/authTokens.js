import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const createAccessToken = (user) => jwt.sign(
  { userId: user._id, sessionVersion: user.sessionVersion || 0, type: 'access' },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

export const createRefreshTokenValue = () => crypto.randomBytes(48).toString('base64url');

export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const refreshTokenEncryptionKey = () => crypto.createHash('sha256')
  .update(`refresh-token-rotation:${env.jwtSecret}`)
  .digest();

export const encryptRefreshToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', refreshTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
};

export const decryptRefreshToken = (encryptedToken) => {
  const [encodedIv, encodedAuthTag, encodedValue] = String(encryptedToken || '').split('.');
  if (!encodedIv || !encodedAuthTag || !encodedValue) {
    throw new Error('Invalid encrypted refresh token.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    refreshTokenEncryptionKey(),
    Buffer.from(encodedIv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const getRefreshTokenExpiry = () => new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

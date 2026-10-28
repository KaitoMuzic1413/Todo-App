import express from 'express';
import {
  forgotPassword,
  login,
  logout,
  refreshSession,
  register,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
  verifyResetOtp,
} from '../controllers/authControllers.js';
import {
  authRateLimiter,
  emailVerificationRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/register', authRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.post('/logout', logout);
router.post('/refresh', authRateLimiter, refreshSession);
router.post('/forgot-password', passwordResetRateLimiter, forgotPassword);
router.post('/verify-reset-otp', authRateLimiter, verifyResetOtp);
router.post('/reset-password', passwordResetRateLimiter, resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', authRateLimiter, verifyEmail);
router.post('/resend-verification', emailVerificationRateLimiter, resendVerificationEmail);

export default router;

import express from 'express';
import {
  login,
  register,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from '../controllers/authControllers.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

export default router;
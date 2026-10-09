import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendEmail } from '../utils/email.js';

const JWT_SECRET = process.env.JWT_SECRET || 'SECRET_KEY';
const JWT_EXPIRES_IN = '30d';
const PASSWORD_RESET_MESSAGE = 'If an account exists for that email, a password reset code has been sent.';

// 1. Controller Đăng ký
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }

    let user = await User.findOne({ email: trimmedEmail });

    if (user && user.password) {
      return res.status(409).json({
        exists: true,
        message: 'Account already exists. Please sign in instead.',
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (user) {
      user.password = hashedPassword;
      user.lastActiveAt = new Date();
      user.inactiveDeletionNoticeSentAt = null;
      await user.save();
    } else {
      user = await User.create({
        email: trimmedEmail,
        password: hashedPassword,
      });
    }

    return res.status(201).json({
      message: 'Account created successfully.',
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

// 2. Controller Đăng nhập
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(404).json({ message: 'Account does not exist. Please sign up first.' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'This account has no password set. Please sign up to set one.' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    user.lastActiveAt = new Date();
    user.inactiveDeletionNoticeSentAt = null;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, sessionVersion: user.sessionVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name || '',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

const getUserWithValidResetOtp = async (email, otp) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires || user.resetPasswordOtpExpires <= new Date() || user.resetPasswordOtpAttempts >= 5) {
    return null;
  }

  const submittedHash = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${user._id}:${otp}`)
    .digest('hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  const storedBuffer = Buffer.from(user.resetPasswordOtpHash, 'hex');
  if (submittedBuffer.length === storedBuffer.length && crypto.timingSafeEqual(submittedBuffer, storedBuffer)) {
    return user;
  }

  const attemptsReachedLimit = user.resetPasswordOtpAttempts + 1 >= 5;
  await User.updateOne(
    {
      _id: user._id,
      resetPasswordOtpHash: user.resetPasswordOtpHash,
      resetPasswordOtpExpires: { $gt: new Date() },
      resetPasswordOtpAttempts: { $lt: 5 },
    },
    {
      $inc: { resetPasswordOtpAttempts: 1 },
      ...(attemptsReachedLimit ? { $set: { resetPasswordOtpHash: null, resetPasswordOtpExpires: null } } : {}),
    }
  );
  return null;
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (typeof email !== 'string' || typeof otp !== 'string' || !email.trim() || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Email and a 6-digit verification code are required.' });
    }

    const user = await getUserWithValidResetOtp(email, otp);
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification code.' });
    return res.status(200).json({ message: 'Verification code confirmed.' });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return res.status(500).json({ message: 'Server error while verifying the code.' });
  }
};

// 3. Controller Quên mật khẩu (Gửi email)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    const requestedAt = user.resetPasswordOtpRequestedAt?.getTime();
    if (requestedAt && Date.now() - requestedAt < 60 * 1000) {
      return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    user.resetPasswordOtpHash = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${user._id}:${otp}`)
      .digest('hex');
    user.resetPasswordOtpExpires = new Date(Date.now() + 2 * 60 * 1000);
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordOtpRequestedAt = new Date();
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset</h2>
          <p>Use this verification code to reset your password. It expires in 2 minutes.</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
    });
    return res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
  } catch (error) {
    console.error('Password reset email delivery failed:', error);
    if (typeof req.body?.email === 'string') {
      await User.updateOne(
        { email: req.body.email.trim().toLowerCase() },
        { $unset: { resetPasswordOtpHash: 1, resetPasswordOtpExpires: 1, resetPasswordOtpRequestedAt: 1 }, $set: { resetPasswordOtpAttempts: 0 } }
      );
    }
    const isProviderError = error.message?.includes('request failed') || error.name === 'AbortError';
    return res.status(isProviderError ? 502 : 500).json({
      message: isProviderError
        ? 'Email provider rejected the request. Check SENDGRID_API_KEY and EMAIL_FROM in Render.'
        : error.message || 'Server error while sending email.',
    });
  }
};

// 4. Controller Đặt lại mật khẩu mới
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string' || !email.trim() || !/^\d{6}$/.test(otp) || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required.' });
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }

    const invalidCodeMessage = 'Invalid or expired verification code.';
    const user = await getUserWithValidResetOtp(email, otp);
    if (!user) return res.status(400).json({ message: invalidCodeMessage });

    const saltRounds = 10;
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetPasswordOtpHash: user.resetPasswordOtpHash,
        resetPasswordOtpExpires: { $gt: new Date() },
        resetPasswordOtpAttempts: { $lt: 5 },
      },
      {
        $set: {
          password: await bcrypt.hash(newPassword, saltRounds),
          sessionVersion: (user.sessionVersion || 0) + 1,
          lastActiveAt: new Date(),
          inactiveDeletionNoticeSentAt: null,
          resetPasswordOtpHash: null,
          resetPasswordOtpExpires: null,
          resetPasswordOtpAttempts: 0,
          resetPasswordOtpRequestedAt: null,
        },
      },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ message: invalidCodeMessage });
    }

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error while resetting password.' });
  }
};
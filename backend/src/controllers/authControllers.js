import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'SECRET_KEY';
const JWT_EXPIRES_IN = '30d';

const sendResetEmail = async ({ to, resetUrl }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailProvider = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  const subject = 'Password Reset Request';
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Password Reset Request</h2>
      <p>Click the button below to set a new password. This link expires in 15 minutes.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Reset Password</a>
    </div>
  `;

  const apiProvider = emailProvider || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'resend');
  const apiKey = apiProvider === 'sendgrid' ? process.env.SENDGRID_API_KEY : process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || emailUser;

  if (apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const endpoint = apiProvider === 'sendgrid'
        ? 'https://api.sendgrid.com/v3/mail/send'
        : 'https://api.resend.com/emails';
      const payload = apiProvider === 'sendgrid'
        ? { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: 'text/html', value: html }] }
        : { from, to: [to], subject, html };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`${apiProvider} request failed with status ${response.status}.`);
      }
      return;
    } finally {
      clearTimeout(timeout);
    }
  }

  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) {
    throw new Error('Server misconfiguration: configure SendGrid, Resend, or SMTP credentials.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  await transporter.sendMail({ from: `"Todo App" <${emailUser}>`, to, subject, html });
};

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
      await user.save();
    } else {
      user = await User.create({
        email: trimmedEmail,
        password: hashedPassword,
      });
    }

    const token = jwt.sign(
      { userId: user._id, sessionVersion: user.sessionVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name || '',
      },
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

// 3. Controller Quên mật khẩu (Gửi email)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(404).json({ message: 'Account with this email does not exist.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    // Nếu chạy ở Render -> dùng link Vercel
    // Nếu chạy ở Local -> dùng http://localhost:5173
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendResetEmail({ to: user.email, resetUrl });
    return res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('--- LỖI NODEMAILER CHI TIẾT ---', error);
    return res.status(500).json({ message: error.message || 'Server error while sending email.' });
  }
};

// 4. Controller Đặt lại mật khẩu mới
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error while resetting password.' });
  }
};
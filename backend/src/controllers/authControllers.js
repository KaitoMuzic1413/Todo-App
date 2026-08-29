import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

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
      { userId: user._id },
      process.env.JWT_SECRET || 'SECRET_KEY',
      { expiresIn: '7d' }
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
      { userId: user._id },
      process.env.JWT_SECRET || 'SECRET_KEY',
      { expiresIn: '7d' }
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

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.error("LỖI: Chưa đọc được EMAIL_USER hoặc EMAIL_PASS từ biến môi trường.");
      return res.status(500).json({ message: "Server misconfiguration: Missing email credentials." });
    }

    // Cấu hình SMTP cổng 587 tương thích tốt nhất với môi trường Render
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true, // Ép nâng cấp kết nối lên TLS
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    // Nếu chạy ở Render -> dùng link Vercel
    // Nếu chạy ở Local -> dùng http://localhost:5173
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? "https://todo-app-seven-mocha-91.vercel.app"
        : "http://localhost:5173";

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"Todo App" <${emailUser}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You received this email because you requested a password reset for your Todo App account.</p>
          <p>Click the button below to set a new password (link expires in 15 minutes):</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Reset Password</a>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
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
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error while resetting password.' });
  }
};
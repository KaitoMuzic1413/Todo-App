import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Controller Đăng ký
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Validate mật khẩu (8-20 ký tự, chữ và số, không ký tự đặc biệt)
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,20}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be 8-20 characters long, contain letters and numbers, and no special characters.',
      });
    }

    let user = await User.findOne({ email: trimmedEmail });

    // 2. Email đã tồn tại VÀ ĐÃ CÓ MẬT KHẨU -> Báo tài khoản đã tồn tại
    if (user && user.password) {
      return res.status(409).json({
        exists: true,
        message: 'Account already exists. Please sign in instead.',
      });
    }

    // 3. Hash mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (user) {
      // Tài khoản cũ chưa có mật khẩu -> Cập nhật mật khẩu mới
      user.password = hashedPassword;
      await user.save();
    } else {
      // Tạo tài khoản mới
      user = await User.create({
        email: trimmedEmail,
        password: hashedPassword,
      });
    }

    // Tạo JWT Token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'SECRET_KEY_CUA_BAN',
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

// Controller Đăng nhập
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: trimmedEmail });

    // 1. Kiểm tra tài khoản tồn tại
    if (!user) {
      return res.status(404).json({ message: 'Account does not exist. Please sign up first.' });
    }

    // 2. Kiểm tra tài khoản đã tạo mật khẩu chưa
    if (!user.password) {
      return res.status(400).json({ message: 'This account has no password set. Please sign up to set one.' });
    }

    // 3. So sánh mật khẩu bằng bcrypt
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Cập nhật thời gian hoạt động gần nhất
    user.lastActiveAt = new Date();
    await user.save();

    // Tạo JWT Token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'SECRET_KEY_CUA_BAN',
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
import User from '../models/User.js';
import Task from '../models/Task.js';

const INACTIVE_ACCOUNT_DAYS = 90;

// Cập nhật thời gian hoạt động gần nhất
export const markUserActive = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }, { new: false });
};

// Dọn dẹp tài khoản không hoạt động > 90 ngày
export const cleanupInactiveUsers = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_ACCOUNT_DAYS);

    const inactiveUsers = await User.find({
      $or: [{ lastActiveAt: { $lt: cutoffDate } }, { lastActiveAt: null }, { lastActiveAt: { $exists: false } }],
    }).select('_id email');

    if (!inactiveUsers.length) {
      return { deletedUsers: 0, deletedTasks: 0 };
    }

    let deletedTasks = 0;
    for (const user of inactiveUsers) {
      const taskResult = await Task.deleteMany({ userId: user._id });
      deletedTasks += taskResult.deletedCount || 0;
      await User.findByIdAndDelete(user._id);
    }

    return { deletedUsers: inactiveUsers.length, deletedTasks };
  } catch (error) {
    console.error('Error cleanupInactiveUsers:', error);
    return { deletedUsers: 0, deletedTasks: 0 };
  }
};

// Đăng nhập bằng Email
export const loginUserWithEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const safeName = normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ').trim();

    let user = await User.findOne({ email: normalizedEmail });
    const adminEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).toLowerCase().trim() : null;

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: safeName || 'User',
        lastActiveAt: new Date(),
        isAdmin: adminEmail && adminEmail === normalizedEmail,
      });
    } else {
      user.lastActiveAt = new Date();
      if (adminEmail && user.email === adminEmail && !user.isAdmin) {
        user.isAdmin = true;
      }
      await user.save();
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        isAdmin: !!user.isAdmin,
        premium: user.premium || null,
      },
    });
  } catch (error) {
    console.error('Error loginUserWithEmail:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Lấy thông tin user hiện tại
export const getCurrentUser = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('_id email name lastActiveAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await markUserActive(user._id);

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error getCurrentUser:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Notification from '../src/models/Notification.js';
import NotificationRecipient from '../src/models/NotificationRecipient.js';
import User from '../src/models/User.js';

if (process.env.NODE_ENV !== 'development') {
  console.error('Notification samples are development-only. Run with NODE_ENV=development.');
  process.exitCode = 1;
} else {
  const samples = [
    {
      seedKey: 'development-welcome-v1',
      title: 'Chào mừng đến với Todo App',
      content: 'Chào mừng bạn! Hãy tạo công việc đầu tiên, thiết lập thời hạn và theo dõi tiến độ ngay trên ứng dụng.',
      type: 'welcome',
    },
    {
      seedKey: 'development-system-update-v1',
      title: 'Cập nhật ứng dụng',
      content: 'Giao diện cài đặt đã được cải thiện để sử dụng thuận tiện hơn trên điện thoại. Hãy trải nghiệm phiên bản mới nhất.',
      type: 'system',
    },
    {
      seedKey: 'development-task-reminder-v1',
      title: 'Nhắc nhở công việc',
      content: 'Bạn có một công việc sắp đến hạn. Hãy kiểm tra danh sách Todo để cập nhật tiến độ.',
      type: 'reminder',
    },
  ];

  try {
    await connectDB();
    const users = await User.find().select('_id').lean();
    if (!users.length) {
      console.log('No users found; no notification samples were created.');
    } else {
      const createdBy = users[0]._id;
      let createdCount = 0;
      for (const sample of samples) {
        let notification = await Notification.findOne({ seedKey: sample.seedKey });
        if (notification) continue;
        notification = await Notification.create({
          ...sample,
          createdBy,
          targetType: 'all',
          targetId: null,
        });
        await NotificationRecipient.insertMany(users.map(({ _id: userId }) => ({
          notificationId: notification._id,
          userId,
          deliveredAt: notification.createdAt,
        })), { ordered: true });
        createdCount += 1;
      }
      console.log(`Created ${createdCount} development sample notification(s) for ${users.length} user(s).`);
    }
  } catch (error) {
    console.error('Could not seed notification samples:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

import Notification from '../models/Notification.js';
import NotificationRecipient from '../models/NotificationRecipient.js';

export const deliverNewAccountNotifications = async (user) => {
  if (!user?._id) return 0;

  try {
    const [welcome, latestUpdate] = await Promise.all([
      Notification.findOne({ type: 'welcome', targetType: 'new-users' }).sort({ createdAt: -1, _id: -1 }).select('_id').lean(),
      Notification.findOne({ type: 'update', targetType: 'all' }).sort({ createdAt: -1, _id: -1 }).select('_id').lean(),
    ]);
    const notifications = [welcome, latestUpdate].filter(Boolean);
    if (!notifications.length) return 0;

    const deliveredAt = new Date();
    await NotificationRecipient.bulkWrite(notifications.map(({ _id: notificationId }) => ({
      updateOne: {
        filter: { notificationId, userId: user._id },
        update: { $setOnInsert: { notificationId, userId: user._id, deliveredAt } },
        upsert: true,
      },
    })), { ordered: false });

    return notifications.length;
  } catch (error) {
    console.error(`Could not deliver onboarding notifications to user ${user._id}:`, error);
    return 0;
  }
};

import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import NotificationRecipient from '../models/NotificationRecipient.js';
import { sendPushToUser } from './webPush.js';

const getOrCreateTaskNotification = async ({ task, userId, language }) => {
  const dueTimestamp = new Date(task.dueAt).getTime();
  const seedKey = `task-due:${task._id}:${dueTimestamp}`;
  const title = language === 'vi' ? 'Công việc đến hạn' : 'Task due now';
  const content = language === 'vi'
    ? `Công việc “${task.title}” đã đến thời hạn.`
    : `Task “${task.title}” has reached its due time.`;
  const notificationFields = {
    title,
    content: content.slice(0, 5000),
    type: 'task',
    createdBy: userId,
    targetType: 'user',
    targetId: userId,
    seedKey,
  };

  try {
    return await Notification.findOneAndUpdate(
      { seedKey },
      { $setOnInsert: notificationFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await Notification.findOne({ seedKey });
    if (existing) return existing;
    throw error;
  }
};

const seedPushTag = (task, now) => `task-due-${task._id}-${new Date(task.dueAt).getTime() || now.getTime()}`;

export const runDueTaskNotifications = async (now = new Date()) => {
  try {
    const dueTasks = await Task.find({
      isDeleted: false,
      status: 'active',
      dueAt: { $lte: now, $ne: null },
      dueNotificationSentFor: null,
      $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
    })
      .populate('userId', 'preferences.language')
      .sort({ dueAt: 1, _id: 1 })
      .limit(250);

    let delivered = 0;
    for (const task of dueTasks) {
      const owner = task.userId;
      if (!owner?._id || !task.dueAt) continue;

      const dueAt = task.dueAt;
      const claim = await Task.findOneAndUpdate(
        {
          _id: task._id,
          dueAt,
          dueNotificationSentFor: null,
          status: 'active',
          isDeleted: false,
        },
        { $set: { dueNotificationSentFor: dueAt } },
        { new: true, select: '_id' }
      );
      if (!claim) continue;

      try {
        const userId = owner._id;
        const language = owner.preferences?.language === 'vi' ? 'vi' : 'en';
        const notification = await getOrCreateTaskNotification({ task, userId, language });
        await NotificationRecipient.updateOne(
          { notificationId: notification._id, userId },
          { $setOnInsert: { notificationId: notification._id, userId, deliveredAt: now } },
          { upsert: true }
        );
        await sendPushToUser(userId, {
          title: notification.title,
          body: notification.content,
          url: '/home',
          tag: seedPushTag(task, now),
        }).catch((pushError) => {
          console.error(`Push reminder failed for task ${task._id}:`, pushError);
        });
        delivered += 1;
      } catch (error) {
        await Task.updateOne(
          { _id: task._id, dueAt, dueNotificationSentFor: dueAt },
          { $set: { dueNotificationSentFor: null } }
        );
        console.error(`Could not create due notification for task ${task._id}:`, error);
      }
    }

    return delivered;
  } catch (error) {
    console.error('Could not process scheduled task notifications:', error);
    return 0;
  }
};

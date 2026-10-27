import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import Notification from '../models/Notification.js';
import NotificationRecipient from '../models/NotificationRecipient.js';
import User from '../models/User.js';
import { validateNotificationInput } from '../utils/notificationValidation.js';
import { translateTexts } from '../utils/translateTexts.js';

const notificationView = (notification, recipient) => ({
  id: String(notification._id),
  title: notification.title,
  content: notification.content,
  type: notification.type,
  createdAt: notification.createdAt,
  deliveredAt: recipient.deliveredAt,
  isRead: recipient.isRead,
  readAt: recipient.readAt,
});

export const translateNotificationTexts = async (req, res) => {
  const { texts, targetLanguage } = req.body || {};
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > 40 ||
      !texts.every((text) => typeof text === 'string' && text.length <= 5000) ||
      !['vi', 'en'].includes(targetLanguage)) {
    return res.status(400).json({ message: 'Provide 1–40 text strings and a supported target language.' });
  }

  try {
    const { translations, fallback } = await translateTexts(texts, targetLanguage);
    return res.status(200).json({ translations, ...(fallback ? { fallback: true } : {}) });
  } catch (error) {
    console.error('Notification translation error:', error.message);
    return res.status(200).json({ translations: texts, fallback: true });
  }
};

export const listNotifications = async (req, res) => {
  try {
    if (req.query.filter === 'task') {
      const recipients = await NotificationRecipient.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
        {
          $lookup: {
            from: Notification.collection.name,
            localField: 'notificationId',
            foreignField: '_id',
            as: 'notification',
          },
        },
        { $unwind: '$notification' },
        { $match: { 'notification.type': 'task' } },
        { $sort: { deliveredAt: -1, _id: -1 } },
        { $limit: 100 },
      ]);
      const items = recipients.map(({ notification, ...recipient }) => notificationView(notification, recipient));
      return res.status(200).json({ notifications: items });
    }

    const recipientFilter = { userId: req.user.userId };
    if (req.query.filter === 'unread') recipientFilter.isRead = false;
    const recipients = await NotificationRecipient.find(recipientFilter)
      .sort({ deliveredAt: -1, _id: -1 })
      .limit(100)
      .lean();
    const notificationIds = recipients.map(({ notificationId }) => notificationId);
    const notifications = await Notification.find({ _id: { $in: notificationIds } }).lean();
    const byId = new Map(notifications.map((notification) => [String(notification._id), notification]));
    const items = recipients.flatMap((recipient) => {
      const notification = byId.get(String(recipient.notificationId));
      return notification ? [notificationView(notification, recipient)] : [];
    });
    return res.status(200).json({ notifications: items });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ message: 'Unable to load notifications.' });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await NotificationRecipient.countDocuments({ userId: req.user.userId, isRead: false });
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Unread notification count error:', error);
    return res.status(500).json({ message: 'Unable to load unread notification count.' });
  }
};

export const getNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const recipient = await NotificationRecipient.findOne({ notificationId: req.params.id, userId: req.user.userId }).lean();
    if (!recipient) return res.status(404).json({ message: 'Notification not found.' });
    const notification = await Notification.findById(req.params.id).lean();
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ notification: notificationView(notification, recipient) });
  } catch (error) {
    console.error('Get notification error:', error);
    return res.status(500).json({ message: 'Unable to load this notification.' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const recipient = await NotificationRecipient.findOneAndUpdate(
      { notificationId: req.params.id, userId: req.user.userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    if (recipient) return res.status(200).json({ isRead: true, readAt: recipient.readAt });

    const alreadyRead = await NotificationRecipient.findOne({ notificationId: req.params.id, userId: req.user.userId }).select('isRead readAt');
    if (!alreadyRead) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ isRead: true, readAt: alreadyRead.readAt });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ message: 'Unable to update notification status.' });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const readAt = new Date();
    const result = await NotificationRecipient.updateMany(
      { userId: req.user.userId, isRead: false },
      { $set: { isRead: true, readAt } }
    );
    return res.status(200).json({ updated: result.modifiedCount });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ message: 'Unable to update notification statuses.' });
  }
};

export const listAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50).lean();
    const ids = notifications.map(({ _id }) => _id);
    const stats = await NotificationRecipient.aggregate([
      { $match: { notificationId: { $in: ids } } },
      { $group: { _id: '$notificationId', recipients: { $sum: 1 }, read: { $sum: { $cond: ['$isRead', 1, 0] } } } },
    ]);
    const byId = new Map(stats.map((item) => [String(item._id), item]));
    return res.status(200).json({ notifications: notifications.map((notification) => {
      const stat = byId.get(String(notification._id));
      return {
        id: String(notification._id),
        title: notification.title,
        content: notification.content,
        type: notification.type,
        targetType: notification.targetType,
        targetId: notification.targetId ? String(notification.targetId) : null,
        createdAt: notification.createdAt,
        status: notification.status || 'sent',
        scheduledAt: notification.scheduledAt || null,
        archivedAt: notification.archivedAt || null,
        campaignKey: notification.campaignKey || null,
        sourceNotificationId: notification.sourceNotificationId ? String(notification.sourceNotificationId) : null,
        recipients: stat?.recipients || 0,
        read: stat?.read || 0,
      };
    }) });
  } catch (error) {
    console.error('List admin notifications error:', error);
    return res.status(500).json({ message: 'Unable to load sent notifications.' });
  }
};

export const deleteAdminNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    const notification = await Notification.findById(req.params.id).select('_id').lean();
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });

    await NotificationRecipient.deleteMany({ notificationId: notification._id });
    await Notification.deleteOne({ _id: notification._id });

    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Delete admin notification error:', error);
    return res.status(500).json({ message: 'Unable to delete this notification.' });
  }
};

export const createNotification = async (req, res) => {
  const { value, error: validationError } = validateNotificationInput(req.body);
  if (validationError) return res.status(400).json({ message: validationError });

  const requestId = req.get('Idempotency-Key')?.trim();
  if (!requestId || requestId.length > 128) {
    return res.status(400).json({ message: 'A valid idempotency key is required.' });
  }
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify({ ...value, createdBy: String(req.user.userId) }))
    .digest('hex');

  try {
    const duplicate = await Notification.findOne({ requestId }).lean();
    if (duplicate) {
      if (duplicate.requestFingerprint !== requestFingerprint) {
        return res.status(409).json({ message: 'This idempotency key was already used for different notification content.' });
      }
      return res.status(200).json({ notification: { id: String(duplicate._id) }, duplicate: true });
    }

    const action = ['draft', 'schedule', 'send'].includes(req.body.action) ? req.body.action : 'send';
    const campaignTarget = value.targetType === 'user' ? await User.findOne({ email: value.targetEmail }).select('_id').lean() : null;
    if (value.targetType === 'user' && !campaignTarget) return res.status(404).json({ message: 'Recipient account was not found.' });
    if (action === 'schedule') {
      const scheduledAt = new Date(req.body.scheduledAt);
      if (!req.body.scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000) {
        return res.status(400).json({ message: 'Choose a scheduled time at least one minute in the future.' });
      }
      const scheduled = await Notification.create({
        title: value.title, content: value.content, type: value.type, createdBy: req.user.userId,
        targetType: value.targetType, targetId: campaignTarget?._id || null, requestId, requestFingerprint,
        status: 'scheduled', scheduledAt, campaignKey: req.body.campaignKey || null,
      });
      return res.status(201).json({ notification: { id: String(scheduled._id), status: 'scheduled', scheduledAt } });
    }
    if (action === 'draft') {
      const draft = await Notification.create({
        title: value.title, content: value.content, type: value.type, createdBy: req.user.userId,
        targetType: value.targetType, targetId: campaignTarget?._id || null, requestId, requestFingerprint,
        status: 'draft', campaignKey: req.body.campaignKey || null,
      });
      return res.status(201).json({ notification: { id: String(draft._id), status: 'draft' } });
    }

    let users = [];
    let targetId = null;
    if (value.targetType === 'all') {
      users = await User.find().select('_id').lean();
    } else if (value.targetType === 'user') {
      const user = await User.findOne({ email: value.targetEmail }).select('_id').lean();
      if (!user) return res.status(404).json({ message: 'Recipient account was not found.' });
      targetId = user._id;
      users = [user];
    }
    if (value.targetType !== 'new-users' && !users.length) {
      return res.status(400).json({ message: 'There are no valid recipients.' });
    }

    const notification = await Notification.create({
      title: value.title,
      content: value.content,
      type: value.type,
      createdBy: req.user.userId,
      targetType: value.targetType,
      targetId,
      requestId,
      requestFingerprint,
      status: 'sent',
      campaignKey: req.body.campaignKey || null,
    });

    if (users.length) {
      try {
        await NotificationRecipient.insertMany(users.map(({ _id: userId }) => ({
          notificationId: notification._id,
          userId,
          deliveredAt: notification.createdAt,
        })), { ordered: true });
      } catch (deliveryError) {
        await NotificationRecipient.deleteMany({ notificationId: notification._id });
        await Notification.deleteOne({ _id: notification._id });
        throw deliveryError;
      }
    }

    return res.status(201).json({ notification: { id: String(notification._id), recipients: users.length, queuedForNewUsers: value.targetType === 'new-users' } });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Notification.findOne({ requestId }).lean();
      if (duplicate) {
        if (duplicate.requestFingerprint !== requestFingerprint) {
          return res.status(409).json({ message: 'This idempotency key was already used for different notification content.' });
        }
        return res.status(200).json({ notification: { id: String(duplicate._id) }, duplicate: true });
      }
    }
    console.error('Create notification error:', error);
    return res.status(500).json({ message: 'Unable to send notification.' });
  }
};


export const archiveAdminNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'archived', archivedAt: new Date() } },
      { new: true }
    ).select('_id status archivedAt');
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ archived: true, status: notification.status, archivedAt: notification.archivedAt });
  } catch (error) {
    console.error('Archive admin notification error:', error);
    return res.status(500).json({ message: 'Unable to archive this campaign.' });
  }
};

export const cloneAdminNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const source = await Notification.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ message: 'Notification not found.' });
    const clone = await Notification.create({
      title: source.title, content: source.content, type: source.type, createdBy: req.user.userId,
      targetType: source.targetType, targetId: source.targetId || null, status: 'draft',
      campaignKey: source.campaignKey || null, sourceNotificationId: source._id,
    });
    return res.status(201).json({ notification: { id: String(clone._id), status: 'draft' } });
  } catch (error) {
    console.error('Clone admin notification error:', error);
    return res.status(500).json({ message: 'Unable to duplicate this campaign.' });
  }
};

export const resendAdminNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    const source = await Notification.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ message: 'Notification not found.' });
    const requestId = req.get('Idempotency-Key')?.trim();
    if (!requestId || requestId.length > 128) return res.status(400).json({ message: 'A valid idempotency key is required.' });

    let users = [];
    let targetId = null;
    if (source.targetType === 'all') users = await User.find().select('_id').lean();
    else if (source.targetType === 'user' && source.targetId) {
      const user = await User.findById(source.targetId).select('_id').lean();
      if (user) { users = [user]; targetId = user._id; }
    }
    if (source.targetType !== 'new-users' && !users.length) return res.status(400).json({ message: 'There are no valid recipients for this campaign.' });

    const copy = await Notification.create({
      title: source.title, content: source.content, type: source.type, createdBy: req.user.userId,
      targetType: source.targetType, targetId, requestId,
      requestFingerprint: createHash('sha256').update(JSON.stringify({ source: String(source._id), requestId })).digest('hex'),
      status: 'sent', campaignKey: source.campaignKey || null, sourceNotificationId: source._id,
    });
    if (users.length) {
      try {
        await NotificationRecipient.insertMany(users.map(({ _id: userId }) => ({
          notificationId: copy._id, userId, deliveredAt: copy.createdAt,
        })));
      } catch (error) {
        await NotificationRecipient.deleteMany({ notificationId: copy._id });
        await Notification.deleteOne({ _id: copy._id });
        throw error;
      }
    }
    return res.status(201).json({ notification: { id: String(copy._id), status: 'sent', recipients: users.length, queuedForNewUsers: source.targetType === 'new-users' } });
  } catch (error) {
    console.error('Resend admin notification error:', error);
    return res.status(500).json({ message: 'Unable to resend this campaign.' });
  }
};

export const processScheduledNotifications = async () => {
  await Notification.updateMany({ status: 'processing', updatedAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) } }, { $set: { status: 'scheduled' } });
  const due = await Notification.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).select('_id').limit(20).lean();
  for (const item of due) {
    const claimed = await Notification.findOneAndUpdate(
      { _id: item._id, status: 'scheduled', scheduledAt: { $lte: new Date() } },
      { $set: { status: 'processing' } }, { new: true }
    );
    if (!claimed) continue;
    try {
      let users = [];
      let targetId = claimed.targetId || null;
      if (claimed.targetType === 'all') users = await User.find().select('_id').lean();
      else if (claimed.targetType === 'user' && targetId) {
        const user = await User.findById(targetId).select('_id').lean();
        if (user) users = [user];
      }
      if (claimed.targetType !== 'new-users' && users.length) {
        const deliveredAt = new Date();
        await NotificationRecipient.bulkWrite(users.map(({ _id: userId }) => ({
          updateOne: {
            filter: { notificationId: claimed._id, userId },
            update: { $setOnInsert: { notificationId: claimed._id, userId, deliveredAt } },
            upsert: true,
          },
        })), { ordered: false });
      }
      await Notification.updateOne({ _id: claimed._id, status: 'processing' }, { $set: { status: 'sent' } });
    } catch (error) {
      console.error('Scheduled notification delivery error:', error);
      await Notification.updateOne({ _id: claimed._id, status: 'processing' }, { $set: { status: 'scheduled' } });
    }
  }
};

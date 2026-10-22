import mongoose from 'mongoose';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Attachment from '../models/Attachment.js';
import CalendarNote from '../models/CalendarNote.js';
import NotificationRecipient from '../models/NotificationRecipient.js';
import { sendEmail } from '../utils/email.js';
import { validatePreferenceUpdates } from '../utils/userPreferences.js';
import { deliverNewAccountNotifications } from '../utils/onboardingNotifications.js';

const INACTIVE_ACCOUNT_DAYS = 90;
const DELETION_NOTICE_DAYS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('preferences');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ preferences: user.preferences.toObject() });
  } catch (error) {
    console.error('Get user preferences error:', error);
    return res.status(500).json({ message: 'Unable to load preferences.' });
  }
};

export const updateUserPreferences = async (req, res) => {
  try {
    const { updates, error: validationError } = validatePreferenceUpdates(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true, select: 'preferences' }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ preferences: user.preferences.toObject() });
  } catch (error) {
    console.error('Update user preferences error:', error);
    return res.status(500).json({ message: 'Unable to update preferences.' });
  }
};

export const updateCurrentUserName = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ message: 'Name must contain 1 to 80 characters.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { name } },
      { new: true, runValidators: true, select: '_id email name' }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ user: { _id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Update user name error:', error);
    return res.status(500).json({ message: 'Unable to update your name.' });
  }
};

export const markUserActive = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, {
    lastActiveAt: new Date(),
    inactiveDeletionNoticeSentAt: null,
  }, { returnDocument: 'after' });
};

export const cleanupInactiveUsers = async () => {
  try {
    const now = new Date();
    const deletionCutoff = new Date(now.getTime() - INACTIVE_ACCOUNT_DAYS * DAY_IN_MS);
    const noticeCutoff = new Date(now.getTime() - (INACTIVE_ACCOUNT_DAYS - DELETION_NOTICE_DAYS) * DAY_IN_MS);
    const inactivityFilter = [
      { lastActiveAt: { $lte: noticeCutoff } },
      { lastActiveAt: null },
      { lastActiveAt: { $exists: false } },
    ];
    const usersNeedingNotice = await User.find({
      $or: inactivityFilter,
      inactiveDeletionNoticeSentAt: null,
    }).select('_id email lastActiveAt createdAt');

    for (const user of usersNeedingNotice) {
      const claimedAt = new Date();
      const claimedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          inactiveDeletionNoticeSentAt: null,
          $or: inactivityFilter,
        },
        { $set: { inactiveDeletionNoticeSentAt: claimedAt } },
        { new: true }
      );
      if (!claimedUser) continue;

      const lastActive = user.lastActiveAt || user.createdAt || now;
      const inactiveDeletionDate = lastActive.getTime() + INACTIVE_ACCOUNT_DAYS * DAY_IN_MS;
      const minimumGraceDate = claimedAt.getTime() + DELETION_NOTICE_DAYS * DAY_IN_MS;
      const deletionDate = new Date(Math.max(inactiveDeletionDate, minimumGraceDate));
      try {
        await sendEmail({
          to: user.email,
          subject: 'Your Todo App account will be deleted soon',
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Your account is scheduled for deletion</h2>
              <p>We noticed that you have not signed in to your Todo App account for a while.</p>
              <p>Your account and its associated data are scheduled to be deleted on ${deletionDate.toUTCString()} because of inactivity.</p>
              <p>Sign in before that date to keep your account. Your inactivity period will then restart.</p>
              <p>If you no longer need your account, no action is required.</p>
            </div>
          `,
        });
      } catch (error) {
        await User.updateOne(
          { _id: user._id, inactiveDeletionNoticeSentAt: claimedAt },
          { $set: { inactiveDeletionNoticeSentAt: null } }
        );
        console.error(`Could not send account deletion notice to ${user.email}:`, error);
      }
    }

    const noticeMaturedAt = new Date(now.getTime() - DELETION_NOTICE_DAYS * DAY_IN_MS);
    const inactiveUsers = await User.find({
      inactiveDeletionNoticeSentAt: { $lte: noticeMaturedAt },
      $or: [
        { lastActiveAt: { $lte: deletionCutoff } },
        { lastActiveAt: null },
        { lastActiveAt: { $exists: false } },
      ],
    }).select('_id email');

    let deletedTasks = 0;
    for (const user of inactiveUsers) {
      const taskResult = await Task.deleteMany({ userId: user._id });
      deletedTasks += taskResult.deletedCount || 0;
      await CalendarNote.deleteMany({ userId: user._id });
      const attachments = await Attachment.find({ ownerId: user._id }).select('fileId');
      if (mongoose.connection.db) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });
        const deleteResults = await Promise.allSettled(attachments.map(({ fileId }) => bucket.delete(fileId)));
        deleteResults.forEach((result) => {
          if (result.status === 'rejected') console.error('Could not delete an inactive user attachment file:', result.reason);
        });
      }
      await Attachment.deleteMany({ ownerId: user._id });
      await NotificationRecipient.deleteMany({ userId: user._id });
      await User.findByIdAndDelete(user._id);
    }

    return { deletedUsers: inactiveUsers.length, deletedTasks };
  } catch (error) {
    console.error('Error cleanupInactiveUsers:', error);
    return { deletedUsers: 0, deletedTasks: 0 };
  }
};

export const loginUserWithEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const safeName = normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ').trim();

    let user = await User.findOne({ email: normalizedEmail });
    let isNewAccount = false;
    const adminEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).toLowerCase().trim() : null;

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: safeName || 'User',
        lastActiveAt: new Date(),
        isAdmin: adminEmail && adminEmail === normalizedEmail,
      });
      isNewAccount = true;
    } else {
      user.lastActiveAt = new Date();
      user.inactiveDeletionNoticeSentAt = null;
      if (adminEmail && user.email === adminEmail && !user.isAdmin) {
        user.isAdmin = true;
      }
      await user.save();
    }

    if (isNewAccount) await deliverNewAccountNotifications(user);

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

export const getAuthenticatedCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('_id email name lastActiveAt isAdmin');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const adminEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).toLowerCase().trim() : '';
    if (adminEmail && user.email?.toLowerCase().trim() === adminEmail && !user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }

    return res.status(200).json({ user: { ...user.toObject(), isAdmin: Boolean(user.isAdmin) } });
  } catch (error) {
    console.error('Get authenticated user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

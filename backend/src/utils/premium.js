import User from '../models/User.js';
import Task from '../models/Task.js';
import Attachment from '../models/Attachment.js';

export const FREE_TASK_LIMIT = 100;
export const FREE_ATTACHMENT_LIMIT = 25;
export const PREMIUM_TASK_LIMIT = 10000;
export const PREMIUM_ATTACHMENT_LIMIT = 1000;
export const PREMIUM_PLAN_DAYS = 30;

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

export const getPremiumUntil = (user) => {
  const expiry = toDate(user?.premium?.expiresAt);
  const unlimitedUntil = toDate(user?.premium?.unlimitedUntil);
  if (unlimitedUntil && (!expiry || unlimitedUntil > expiry)) return unlimitedUntil;
  return expiry;
};

export const isPremiumActive = (user, now = new Date()) => {
  if (!user?.premium?.isPremium) return false;
  const until = getPremiumUntil(user);
  return !until || until > now;
};

export const getQuotaLimits = (premiumActive) => ({
  tasks: premiumActive ? PREMIUM_TASK_LIMIT : FREE_TASK_LIMIT,
  attachments: premiumActive ? PREMIUM_ATTACHMENT_LIMIT : FREE_ATTACHMENT_LIMIT,
});

export const getQuotaSnapshot = async (userId) => {
  const [user, taskCount, attachmentCount] = await Promise.all([
    User.findById(userId).select('premium'),
    Task.countDocuments({ userId, isDeleted: false }),
    Attachment.countDocuments({ ownerId: userId, isDeleted: false }),
  ]);
  if (!user) return null;

  const premiumActive = isPremiumActive(user);
  const limits = getQuotaLimits(premiumActive);
  const usage = { tasks: taskCount, attachments: attachmentCount };

  return {
    plan: premiumActive ? 'premium' : 'free',
    premiumActive,
    premiumUntil: getPremiumUntil(user),
    limits,
    usage,
    remaining: {
      tasks: Math.max(0, limits.tasks - usage.tasks),
      attachments: Math.max(0, limits.attachments - usage.attachments),
    },
  };
};

export const checkTaskQuota = async (userId) => {
  const snapshot = await getQuotaSnapshot(userId);
  if (!snapshot) return { snapshot: null, exceeded: false };
  return { snapshot, exceeded: snapshot.usage.tasks >= snapshot.limits.tasks };
};

export const checkAttachmentQuota = async (userId) => {
  const snapshot = await getQuotaSnapshot(userId);
  if (!snapshot) return { snapshot: null, exceeded: false };
  return { snapshot, exceeded: snapshot.usage.attachments >= snapshot.limits.attachments };
};

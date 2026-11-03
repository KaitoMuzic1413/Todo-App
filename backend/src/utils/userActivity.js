const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export const touchUserActivity = async (UserModel, userId, now = new Date()) => {
  if (!userId) return null;

  const staleBefore = new Date(now.getTime() - ACTIVITY_WRITE_INTERVAL_MS);
  return UserModel.updateOne(
    {
      _id: userId,
      $or: [
        { lastActiveAt: { $lte: staleBefore } },
        { lastActiveAt: null },
        { inactiveDeletionNoticeSentAt: { $ne: null } },
      ],
    },
    {
      $set: {
        lastActiveAt: now,
        inactiveDeletionNoticeSentAt: null,
      },
    }
  );
};

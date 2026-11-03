export const TASK_DELETION_CLAIM_LEASE_MS = 30 * 60 * 1000;

export const claimTaskForDeletion = async (
  TaskModel,
  { taskId, userId, now = new Date(), deletedBefore = null }
) => {
  const filter = {
    _id: taskId,
    userId,
    isDeleted: true,
    $or: [
      { cleanupClaimedAt: null },
      { cleanupClaimedAt: { $lte: new Date(now.getTime() - TASK_DELETION_CLAIM_LEASE_MS) } },
    ],
  };

  if (deletedBefore) filter.deletedAt = { $lte: deletedBefore };

  const claimed = await TaskModel.findOneAndUpdate(
    filter,
    { $set: { cleanupClaimedAt: now } },
    { new: true }
  ).select('_id userId');

  if (!claimed) return null;
  return { _id: claimed._id, userId: claimed.userId, cleanupClaimedAt: now };
};

export const releaseTaskDeletionClaim = (TaskModel, task) => TaskModel.updateOne(
  {
    _id: task._id,
    userId: task.userId,
    cleanupClaimedAt: task.cleanupClaimedAt,
  },
  { $set: { cleanupClaimedAt: null } }
);

export const deleteTasksWithAttachmentsSafely = async (
  tasks,
  { deleteAttachments, deleteTask, releaseTask }
) => {
  let deletedCount = 0;
  const failures = [];

  for (const task of tasks) {
    try {
      await deleteAttachments(task);
      const result = await deleteTask(task);
      if (!result?.deletedCount) throw new Error('Task could not be deleted after attachment cleanup.');
      deletedCount += result.deletedCount;
    } catch (error) {
      try {
        await releaseTask(task);
      } catch (releaseError) {
        error.releaseError = releaseError;
      }
      failures.push({ taskId: task._id, error });
    }
  }

  return { deletedCount, failures };
};

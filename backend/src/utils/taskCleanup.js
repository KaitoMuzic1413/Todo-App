export const deleteTasksWithAttachmentsSafely = async (tasks, { deleteAttachments, deleteTask }) => {
  let deletedCount = 0;
  const failures = [];

  for (const task of tasks) {
    try {
      await deleteAttachments(task);
      const result = await deleteTask(task);
      deletedCount += result.deletedCount || 0;
    } catch (error) {
      failures.push({ taskId: task._id, error });
    }
  }

  return { deletedCount, failures };
};

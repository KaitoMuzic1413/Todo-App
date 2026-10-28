export const removeTaskTree = (tasks, taskId) => (Array.isArray(tasks) ? tasks : [])
  .filter((task) => task._id !== taskId)
  .map((task) => (Array.isArray(task.subtasks) && task.subtasks.length
    ? { ...task, subtasks: removeTaskTree(task.subtasks, taskId) }
    : task));

export const updateTaskTree = (tasks, taskId, updater) => (Array.isArray(tasks) ? tasks : []).map((task) => {
  if (task._id === taskId) return updater(task);
  if (!Array.isArray(task.subtasks) || !task.subtasks.length) return task;
  return { ...task, subtasks: updateTaskTree(task.subtasks, taskId, updater) };
});

export const insertTaskTree = (tasks, task) => {
  const list = removeTaskTree(tasks, task._id);
  if (!task?._id) return list;
  if (task.parentTaskId) {
    return list.map((parent) => (parent._id === task.parentTaskId
      ? { ...parent, subtasks: [...(Array.isArray(parent.subtasks) ? parent.subtasks : []), task] }
      : parent));
  }
  return [task, ...list];
};

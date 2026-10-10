export const sortTasks = (tasks, { sortBy = 'createdAt', language = 'en' } = {}) => {
  return [...tasks].sort((left, right) => {
    const comparison = sortBy === 'title'
      ? String(left.title || '').localeCompare(String(right.title || ''), language, { sensitivity: 'base', numeric: true })
      : new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    return comparison || String(left._id || '').localeCompare(String(right._id || ''));
  });
};

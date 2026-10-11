export const sortTasks = (tasks, { sortBy = 'createdAt', sortDirection, language = 'en' } = {}) => {
  return [...tasks].sort((left, right) => {
    let comparison;
    if (sortBy === 'title') {
      comparison = String(left.title || '').localeCompare(String(right.title || ''), language, { sensitivity: 'base', numeric: true });
    } else if (sortBy === 'important') {
      comparison = Number(Boolean(left.important)) - Number(Boolean(right.important));
    } else {
      comparison = new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
    }
    const direction = sortDirection || (sortBy === 'title' ? 'asc' : 'desc');
    if (direction !== 'asc') comparison *= -1;
    return comparison || String(left._id || '').localeCompare(String(right._id || ''));
  });
};

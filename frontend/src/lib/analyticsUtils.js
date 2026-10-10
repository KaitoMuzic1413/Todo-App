const getDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const buildDailyAnalyticsBuckets = (analytics, timeZone = 'UTC') => {
  const start = new Date(analytics.range.start);
  const end = new Date(new Date(analytics.range.endExclusive).getTime() - 1);
  const firstDay = getDateParts(start, timeZone);
  const lastDay = getDateParts(end, timeZone);
  const cursor = new Date(Date.UTC(Number(firstDay.year), Number(firstDay.month) - 1, Number(firstDay.day)));
  const endDay = new Date(Date.UTC(Number(lastDay.year), Number(lastDay.month) - 1, Number(lastDay.day)));
  const createdByDay = new Map(analytics.trend.created.map(({ _id, count }) => [_id, count]));
  const completedByDay = new Map(analytics.trend.completed.map(({ _id, count }) => [_id, count]));
  const buckets = [];

  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ key, created: createdByDay.get(key) || 0, completed: completedByDay.get(key) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
};

export const getCompletionRate = ({ total = 0, completed = 0 } = {}) => (
  total > 0 ? Math.round((completed / total) * 100) : 0
);
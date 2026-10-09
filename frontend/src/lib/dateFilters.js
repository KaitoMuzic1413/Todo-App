export const getCreatedAtRange = (period, now = new Date()) => {
  if (!period || period === 'all') return null;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nowExclusive = new Date(now.getTime() + 1);

  if (period === 'today') {
    return { start: todayStart, endExclusive: nowExclusive };
  }

  if (period === 'week') return { start: weekStart, endExclusive: nowExclusive };
  if (period === 'month') return { start: monthStart, endExclusive: nowExclusive };
  if (period === 'beforeMonth') return { start: null, endExclusive: monthStart };

  return null;
};

export const isDateInRange = (value, range) => {
  if (!range || !value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    && (!range.start || timestamp >= range.start.getTime())
    && timestamp < range.endExclusive.getTime();
};
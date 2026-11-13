const DATE_KEY_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

// Normalize accepted date keys to one canonical YYYY-MM-DD form so
// "2026-9-5" and "2026-09-05" cannot create two notes for the same day.
export const normalizeCalendarDateKey = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(DATE_KEY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

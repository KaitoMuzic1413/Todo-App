export const normalizeDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getDateKeyAliases = (value) => {
  const canonical = normalizeDateKey(value);
  if (!canonical) return [];

  const [year, month, day] = canonical.split('-').map(Number);
  const months = [String(month), String(month).padStart(2, '0')];
  const days = [String(day), String(day).padStart(2, '0')];

  return [...new Set(months.flatMap((monthValue) =>
    days.map((dayValue) => `${year}-${monthValue}-${dayValue}`)
  ))];
};

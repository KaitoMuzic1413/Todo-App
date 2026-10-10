const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

export const resolveAnalyticsRange = ({ range = '30d', timeZone = 'UTC' } = {}, now = new Date()) => {
  const days = RANGE_DAYS[range];
  if (!days) return { error: 'range must be one of 7d, 30d, or 90d.' };

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(now);
  } catch {
    return { error: 'timeZone must be a valid IANA time zone.' };
  }

  return {
    range,
    timeZone,
    days,
    start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    endExclusive: new Date(now.getTime() + 1),
  };
};
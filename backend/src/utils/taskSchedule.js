const SCHEDULE_FIELDS = ['startAt', 'dueAt', 'estimatedMinutes', 'timeZone'];

const parseDate = (value, field) => {
  if (value === null || value === '') return { value: null };
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return { error: `${field} must be a valid date.` };
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { error: `${field} must be a valid date.` }
    : { value: date };
};

export const hasScheduleInput = (input) => SCHEDULE_FIELDS.some((field) => Object.hasOwn(input, field));

export const validateTaskSchedule = (input, currentTask = null) => {
  const updates = {};

  for (const field of ['startAt', 'dueAt']) {
    if (!Object.hasOwn(input, field)) continue;
    const parsed = parseDate(input[field], field);
    if (parsed.error) return parsed;
    updates[field] = parsed.value;
  }

  if (Object.hasOwn(input, 'estimatedMinutes')) {
    const rawMinutes = input.estimatedMinutes;
    if (rawMinutes === null || rawMinutes === '') {
      updates.estimatedMinutes = null;
    } else {
      const minutes = Number(rawMinutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        return { error: 'estimatedMinutes must be a whole number between 1 and 1440.' };
      }
      updates.estimatedMinutes = minutes;
    }
  }

  if (Object.hasOwn(input, 'timeZone')) {
    const timeZone = input.timeZone === null ? null : String(input.timeZone).trim();
    if (timeZone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format();
      } catch {
        return { error: 'timeZone must be a valid IANA time zone.' };
      }
    }
    updates.timeZone = timeZone || null;
  }

  const startAt = Object.hasOwn(updates, 'startAt') ? updates.startAt : currentTask?.startAt;
  const dueAt = Object.hasOwn(updates, 'dueAt') ? updates.dueAt : currentTask?.dueAt;
  if (startAt && dueAt && dueAt < startAt) {
    return { error: 'dueAt cannot be earlier than startAt.' };
  }

  return { updates };
};
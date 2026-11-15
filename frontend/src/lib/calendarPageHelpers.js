import { getTaskDurationMinutes } from '@/lib/calendarUtils';

export const EMPTY_TASKS = [];
export const HOURS_IN_DAY = Array.from({ length: 24 }, (_, i) => i);
export const NEW_TASK_ID = '__new-task__';

export const nowMs = () => Date.now();

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('todo-user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const toLocalInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const timeFormatters = new Map();

const getTimeFormatter = (locale) => {
  const key = locale || 'default';
  let formatter = timeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
    timeFormatters.set(key, formatter);
  }
  return formatter;
};

export const formatTimeOnly = (value, locale) => {
  if (!value) return '';
  return getTimeFormatter(locale).format(new Date(value));
};

export const getTaskBlockBounds = (task) => {
  const startMs = new Date(task.startAt).getTime();
  return { startMs, endMs: startMs + getTaskDurationMinutes(task) * 60000 };
};

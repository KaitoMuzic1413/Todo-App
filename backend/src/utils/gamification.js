export const DAILY_TASK_GOAL = 3;
export const WEEKLY_TASK_GOAL = 15;
export const TASK_COMPLETION_XP = 10;
export const DAILY_GOAL_XP = 20;
export const WEEKLY_GOAL_XP = 50;

export const getTaskCompletionIdempotencyKey = (taskId) => `task:${taskId}:complete`;

export const getGoalBonusEvents = ({ dailyCompletionCount, weeklyCompletionCount, activityDate, weekStart }) => {
  const events = [];
  if (dailyCompletionCount >= DAILY_TASK_GOAL) {
    events.push({
      eventType: 'dailyGoal',
      idempotencyKey: `dailyGoal:${activityDate}`,
      xp: DAILY_GOAL_XP,
      activityDate,
      weekStart,
    });
  }
  if (weeklyCompletionCount >= WEEKLY_TASK_GOAL) {
    events.push({
      eventType: 'weeklyGoal',
      idempotencyKey: `weeklyGoal:${weekStart}`,
      xp: WEEKLY_GOAL_XP,
      activityDate,
      weekStart,
    });
  }
  return events;
};

export const getActivityKeys = (date, timeZone = 'UTC') => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const activityDate = `${values.year}-${values.month}-${values.day}`;
  const weekDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  weekDate.setUTCDate(weekDate.getUTCDate() - ((weekDate.getUTCDay() + 6) % 7));
  const weekStart = weekDate.toISOString().slice(0, 10);
  return { activityDate, weekStart };
};

const previousDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const getCurrentStreak = (activityDates, todayKey) => {
  const activeDates = new Set(activityDates);
  let cursor = activeDates.has(todayKey) ? todayKey : previousDateKey(todayKey);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
};

export const getBestStreak = (activityDates) => {
  const sortedDates = [...new Set(activityDates)].sort();
  let best = 0;
  let current = 0;
  let previous = null;

  for (const dateKey of sortedDates) {
    if (previous && previousDateKey(dateKey) === previous) current += 1;
    else current = 1;
    best = Math.max(best, current);
    previous = dateKey;
  }

  return best;
};

export const getLevelProgress = (xp) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(safeXp / 100) + 1;
  const currentLevelXp = safeXp % 100;
  return { level, currentLevelXp, nextLevelXp: 100, progressPercent: currentLevelXp };
};

export const getAchievements = (taskCompletions, currentStreak) => [
  { id: 'first-task', unlocked: taskCompletions >= 1 },
  { id: 'ten-tasks', unlocked: taskCompletions >= 10 },
  { id: 'five-day-streak', unlocked: currentStreak >= 5 },
  { id: 'fifty-tasks', unlocked: taskCompletions >= 50 },
];
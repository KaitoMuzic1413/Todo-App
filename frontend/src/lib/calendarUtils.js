export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfWeek = (date) => {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

export const getCalendarDays = (mode, selectedDate) => {
  if (mode === 'day') return [startOfDay(selectedDate)];

  const firstDay = mode === 'week'
    ? startOfWeek(selectedDate)
    : startOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const count = mode === 'week' ? 7 : 42;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return date;
  });
};

export const dateKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const getCalendarRange = (days) => {
  if (!days.length) return null;
  const start = startOfDay(days[0]);
  const endExclusive = startOfDay(days[days.length - 1]);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
};

export const groupTasksByCalendarDay = (tasks, days) => {
  const groups = new Map();
  const addTask = (key, task) => groups.set(key, [...(groups.get(key) || []), task]);

  for (const task of tasks) {
    if (task.startAt) {
      const start = new Date(task.startAt).getTime();
      const end = start + (task.estimatedMinutes || 30) * 60000;
      for (const day of days) {
        const dayStart = startOfDay(day).getTime();
        const nextDay = startOfDay(day);
        nextDay.setDate(nextDay.getDate() + 1);
        if (start < nextDay.getTime() && end > dayStart) addTask(dateKey(day), task);
      }
    }
    if (task.dueAt) {
      const dueDate = new Date(task.dueAt);
      const key = dateKey(dueDate);
      if (days.some((day) => dateKey(day) === key) && !groups.get(key)?.some(({ _id }) => _id === task._id)) {
        addTask(key, task);
      }
    }
  }

  for (const group of groups.values()) {
    group.sort((left, right) => new Date(left.startAt || left.dueAt) - new Date(right.startAt || right.dueAt));
  }
  return groups;
};

export const getDayWarnings = (dayTasks, date = null) => {
  const dayStart = date ? startOfDay(date).getTime() : Number.NEGATIVE_INFINITY;
  const nextDay = date ? startOfDay(date) : null;
  if (nextDay) nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = nextDay ? nextDay.getTime() : Number.POSITIVE_INFINITY;
  const blocks = dayTasks
    .filter((task) => task.startAt)
    .map((task) => {
      const start = new Date(task.startAt).getTime();
      const duration = (task.estimatedMinutes || 30) * 60 * 1000;
      const originalEnd = start + duration;
      return {
        start: Math.max(start, dayStart),
        end: Math.min(originalEnd, dayEnd),
      };
    })
    .filter((block) => block.start < block.end)
    .sort((left, right) => left.start - right.start);

  let furthestEnd = 0;
  let overlaps = false;
  for (const block of blocks) {
    if (block.start < furthestEnd) overlaps = true;
    furthestEnd = Math.max(furthestEnd, block.end);
  }

  const plannedMinutes = dayTasks
    .filter((task) => task.startAt)
    .reduce((total, task) => {
      if (!date) return total + (task.estimatedMinutes || 30);
      const start = new Date(task.startAt).getTime();
      const end = start + (task.estimatedMinutes || 30) * 60 * 1000;
      return total + Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart)) / 60000;
    }, 0);
  return { overlaps, overloaded: plannedMinutes > 480 };
};
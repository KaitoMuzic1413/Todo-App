const getDateKey = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getOccurrenceBounds = (occurrence) => {
  const startMs = new Date(occurrence.startAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const estimatedMinutes = Number(occurrence.estimatedMinutes);
  const durationMs = (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
    ? estimatedMinutes
    : 30) * 60000;
  const endMs = startMs + durationMs;
  if (!Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
};

export const getSingleUnmergedSchedule = (mergedOccurrence) => {
  if (!mergedOccurrence?.startAt) return null;
  const startMs = new Date(mergedOccurrence?.startAt).getTime();
  if (!Number.isFinite(startMs)) return null;

  const startAt = new Date(startMs);
  startAt.setMinutes(0, 0, 0);
  const dueAt = new Date(startAt.getTime() + 60 * 60000);
  return { startAt, dueAt, estimatedMinutes: 60 };
};

export const replaceCalendarOccurrenceSegments = (task, occurrenceId, segments) => {
  const target = occurrenceId === 'primary'
    ? task
    : task.calendarOccurrences.id(occurrenceId);
  if (!target) return false;

  if (!segments.length) {
    if (occurrenceId === 'primary') {
      Object.assign(task, {
        startAt: null,
        dueAt: null,
        estimatedMinutes: null,
        mergedTasks: [],
        mergedOccurrences: [],
      });
    } else {
      target.deleteOne();
    }
    return true;
  }

  Object.assign(target, {
    ...segments[0],
    mergedOccurrences: [],
    ...(occurrenceId === 'primary' ? { mergedTasks: [] } : {}),
  });
  if (segments[1]) {
    task.calendarOccurrences.push({
      ...segments[1],
      mergedOccurrences: [],
    });
  }
  return true;
};

export const getAdjacentCalendarOccurrences = (occurrences, seedId, timeZone = 'UTC') => {
  const seed = occurrences.find((occurrence) => occurrence.occurrenceId === seedId);
  const seedBounds = seed && getOccurrenceBounds(seed);
  if (!seedBounds) return [];

  const seedDay = getDateKey(new Date(seedBounds.startMs), timeZone);
  const validCandidates = occurrences
    .map((occurrence) => {
      const bounds = getOccurrenceBounds(occurrence);
      if (!bounds) return null;
      const startDay = getDateKey(new Date(bounds.startMs), timeZone);
      const occupiedEndDay = getDateKey(new Date(bounds.endMs - 1), timeZone);
      if (startDay !== seedDay || occupiedEndDay !== seedDay) return null;
      return { occurrence, ...bounds };
    })
    .filter(Boolean);

  const seedCandidate = validCandidates.find(
    ({ occurrence }) => occurrence.occurrenceId === seedId
  );
  if (!seedCandidate) return [];

  const chain = [seedCandidate];
  let startMs = seedCandidate.startMs;
  let endMs = seedCandidate.endMs;
  while (true) {
    const adjacent = validCandidates.find(({ occurrence, startMs: candidateStart, endMs: candidateEnd }) => (
      !chain.some((entry) => entry.occurrence.occurrenceId === occurrence.occurrenceId)
      && candidateEnd >= startMs
      && candidateStart <= endMs
    ));
    if (!adjacent) break;
    chain.push(adjacent);
    startMs = Math.min(startMs, adjacent.startMs);
    endMs = Math.max(endMs, adjacent.endMs);
  }

  return chain.length > 1
    ? chain.sort((left, right) => left.startMs - right.startMs).map(({ occurrence }) => occurrence)
    : [];
};

export const DEFAULT_TASK_DURATION_MINUTES = 30;

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

export const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCalendarRange = (days) => {
  if (!days.length) return null;
  const start = startOfDay(days[0]);
  const endExclusive = startOfDay(days[days.length - 1]);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
};

export const getTaskDurationMinutes = (task) => {
  const minutes = Number(task?.estimatedMinutes);
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min(1440, minutes)
    : DEFAULT_TASK_DURATION_MINUTES;
};

export const getCalendarTaskBlockRange = (task, merges = []) => {
  if (!task?.startAt) return null;
  const startMs = new Date(task.startAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const endMs = startMs + getTaskDurationMinutes(task) * 60000;
  const start = new Date(startMs);
  const dayStartMs = startOfDay(start).getTime();
  const blockStartHour = start.getHours();
  const blockEndHour = Math.min(23, Math.max(
    blockStartHour,
    Math.ceil((endMs - dayStartMs) / 3600000) - 1
  ));
  const merge = merges.find((entry) => (
    entry.startHour === blockStartHour && entry.endHour >= blockEndHour
  ));
  if (!merge) return { startMs, endMs };
  return {
    startMs: dayStartMs + merge.startHour * 3600000,
    endMs: dayStartMs + (merge.endHour + 1) * 3600000,
  };
};

export const isCalendarMergeOccupied = (merge, tasks, day) => {
  if (!merge || !day) return false;
  const dayStartMs = startOfDay(day).getTime();
  const mergeStartMs = dayStartMs + merge.startHour * 3600000;
  const mergeEndMs = dayStartMs + (merge.endHour + 1) * 3600000;
  return getTaskCalendarOccurrences(tasks).some((task) => {
    if (!task.startAt || task.status === 'complete') return false;
    const range = getCalendarTaskBlockRange(task, [merge]);
    return range && range.startMs < mergeEndMs && range.endMs > mergeStartMs;
  });
};

// Resolve where a task belongs inside one calendar day. Multi-day and
// overnight tasks are clipped to the day edges instead of reusing the original
// start hour, and tasks that only have a deadline get a block at that deadline.
export const getTaskCalendarDisplay = (task, day) => {
  if (!task || !day) return null;

  const dayStart = startOfDay(day).getTime();
  const nextDay = startOfDay(day);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = nextDay.getTime();
  const durationMs = getTaskDurationMinutes(task) * 60000;

  const startMs = task.startAt ? new Date(task.startAt).getTime() : null;
  const dueMs = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const hasStart = Number.isFinite(startMs);
  const hasDue = Number.isFinite(dueMs);

  if (hasStart && startMs < dayEnd && startMs + durationMs > dayStart) {
    return {
      kind: 'scheduled',
      startMs: Math.max(startMs, dayStart),
      endMs: Math.min(startMs + durationMs, dayEnd),
      originalStartMs: startMs,
      dueMs: hasDue ? dueMs : null,
    };
  }

  // A dueAt that matches the end of the scheduled block is an end time, not a
  // separate deadline marker; it is already covered by the block above.
  const isDeadline = hasDue && (!hasStart || dueMs > startMs + durationMs + 60000);
  if (isDeadline && dueMs >= dayStart && dueMs < dayEnd) {
    return {
      kind: 'deadline',
      startMs: dueMs,
      endMs: Math.min(dueMs + durationMs, dayEnd),
      originalStartMs: hasStart ? startMs : null,
      dueMs,
    };
  }

  return null;
};

export const getCalendarEventKey = (task) =>
  `${task?._id || 'task'}:${task?.calendarOccurrenceId || 'primary'}`;

export const getTaskCalendarOccurrences = (tasks) => tasks.flatMap((task) => {
  const occurrences = Array.isArray(task.calendarOccurrences) ? task.calendarOccurrences : [];
  return [
    ...(task.startAt || task.dueAt
      ? [{ ...task, calendarOccurrenceId: 'primary' }]
      : []),
    ...occurrences.map((occurrence) => ({
      ...task,
      ...occurrence,
      _id: task._id,
      calendarOccurrenceId: occurrence._id,
      mergedTasks: [],
    })),
  ];
});

export const findSameSizeCalendarCollision = (
  tasks,
  candidate,
  excludedEventKey,
  mergesByDate = {}
) => {
  if (
    !Number.isFinite(candidate?.startMs)
    || !Number.isFinite(candidate?.endMs)
    || candidate.endMs <= candidate.startMs
  ) return undefined;
  const candidateStart = new Date(candidate.startMs);
  const candidateDayStart = startOfDay(candidateStart).getTime();
  const candidateStartCell = candidateDayStart
    + Math.floor((candidate.startMs - candidateDayStart) / 3600000) * 3600000;
  const candidateEndCell = candidateDayStart
    + Math.ceil((candidate.endMs - candidateDayStart) / 3600000) * 3600000;
  const candidateCellCount = (candidateEndCell - candidateStartCell) / 3600000;

  return getTaskCalendarOccurrences(tasks).find((task) => {
    if (
      task.status === 'complete'
      || getCalendarEventKey(task) === excludedEventKey
      || !task.startAt
    ) return false;
    const taskStart = new Date(task.startAt);
    const taskDay = dateKey(taskStart);
    const dayMerges = mergesByDate[taskDay];
    const range = getCalendarTaskBlockRange(
      task,
      Array.isArray(dayMerges) ? dayMerges : dayMerges?.merges || []
    );
    if (!range) return false;
    const dayStart = startOfDay(taskStart).getTime();
    const startCell = dayStart
      + Math.floor((range.startMs - dayStart) / 3600000) * 3600000;
    const endCell = dayStart
      + Math.ceil((range.endMs - dayStart) / 3600000) * 3600000;
    const cellCount = (endCell - startCell) / 3600000;
    return cellCount === candidateCellCount
      && candidateStartCell < endCell
      && candidateEndCell > startCell;
  });
};

export const getCalendarTaskIdentity = (task) => {
  const taskId = task?._id === undefined || task?._id === null
    ? ''
    : String(task._id);
  const occurrenceId = task?.calendarOccurrenceId || 'primary';
  return taskId ? `${taskId}:${occurrenceId}` : '';
};

export const groupCalendarMergeMembersByTitle = (members) => {
  const groups = new Map();
  for (const member of members) {
    const title = String(member?.task?.title || '');
    const key = title || member.identity;
    const group = groups.get(key) || { title, members: [] };
    group.members.push(member);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const orderedMembers = [...group.members].sort((left, right) => {
      const createdAtDiff = new Date(right.task?.createdAt || 0).getTime()
        - new Date(left.task?.createdAt || 0).getTime();
      return createdAtDiff || left.identity.localeCompare(right.identity);
    });
    return {
      ...group,
      members: orderedMembers,
      task: orderedMembers[0].task,
    };
  });
};

export const buildCalendarMergeSegments = (intervals) => {
  if (!Array.isArray(intervals)) {
    return {
      valid: false,
      conflicts: [{ code: 'invalid-intervals', index: null }],
      segments: [],
    };
  }

  const conflicts = [];
  const intervalsByIdentity = new Map();
  intervals.forEach((entry, index) => {
    const identity = entry?.identity || getCalendarTaskIdentity(entry?.task);
    const startMs = entry?.startMs;
    const endMs = entry?.endMs;
    if (!identity) {
      conflicts.push({ code: 'missing-identity', index });
      return;
    }
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      conflicts.push({ code: 'invalid-range', index });
      return;
    }

    const records = intervalsByIdentity.get(identity) || [];
    records.push({ identity, task: entry.task, startMs, endMs });
    intervalsByIdentity.set(identity, records);
  });

  if (conflicts.length) {
    return { valid: false, conflicts, segments: [] };
  }

  const events = [];
  const dateValue = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  intervalsByIdentity.forEach((records, identity) => {
    records.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
    const latestTask = [...records].sort((left, right) => {
      const createdDiff = dateValue(right.task?.createdAt) - dateValue(left.task?.createdAt);
      if (createdDiff) return createdDiff;
      const updatedDiff = dateValue(right.task?.updatedAt) - dateValue(left.task?.updatedAt);
      if (updatedDiff) return updatedDiff;
      return JSON.stringify(left.task || {}).localeCompare(JSON.stringify(right.task || {}));
    })[0].task;
    const mergedRanges = [];
    for (const record of records) {
      const previous = mergedRanges.at(-1);
      if (previous && record.startMs <= previous.endMs) {
        previous.endMs = Math.max(previous.endMs, record.endMs);
      } else {
        mergedRanges.push({ startMs: record.startMs, endMs: record.endMs });
      }
    }
    for (const range of mergedRanges) {
      const interval = { identity, task: latestTask, ...range };
      events.push({ position: interval.startMs, type: 1, interval });
      events.push({ position: interval.endMs, type: -1, interval });
    }
  });
  events.sort((left, right) => (
    left.position - right.position
    || left.type - right.type
    || left.interval.identity.localeCompare(right.interval.identity)
  ));

  const active = new Map();
  const segments = [];
  let eventIndex = 0;
  while (eventIndex < events.length) {
    const position = events[eventIndex].position;
    if (eventIndex > 0 && active.size) {
      const previousPosition = events[eventIndex - 1].position;
      if (position > previousPosition) {
        const members = [...active.values()]
          .map(({ identity, task }) => ({ identity, task }))
          .sort((left, right) => left.identity.localeCompare(right.identity));
        const identityKeys = members.map(({ identity }) => identity);
        const previous = segments.at(-1);
        if (
          previous
          && previous.endMs === previousPosition
          && previous.identityKeys.length === identityKeys.length
          && previous.identityKeys.every((identity, index) => identity === identityKeys[index])
        ) {
          previous.endMs = position;
        } else {
          segments.push({
            startMs: previousPosition,
            endMs: position,
            identityKeys,
            members,
          });
        }
      }
    }

    const atPosition = [];
    while (eventIndex < events.length && events[eventIndex].position === position) {
      atPosition.push(events[eventIndex]);
      eventIndex += 1;
    }
    for (const event of atPosition) {
      if (event.type === -1) {
        const count = active.get(event.interval.identity)?.count || 0;
        if (count <= 1) active.delete(event.interval.identity);
        else active.get(event.interval.identity).count = count - 1;
      }
    }
    for (const event of atPosition) {
      if (event.type === 1) {
        const current = active.get(event.interval.identity);
        active.set(event.interval.identity, {
          count: (current?.count || 0) + 1,
          identity: event.interval.identity,
          task: event.interval.task,
        });
      }
    }
  }

  return { valid: true, conflicts: [], segments };
};

export const planCalendarTaskPlacement = (
  tasks,
  candidate,
  mergesByDate = {},
  excludedEventKey
) => {
  const startMs = new Date(candidate?.startAt).getTime();
  const candidateDuration = Number(candidate?.estimatedMinutes);
  if (
    !Number.isFinite(startMs)
    || !Number.isFinite(candidateDuration)
    || candidateDuration <= 0
  ) return null;

  const cellRange = (rangeStart, rangeEnd) => {
    const start = new Date(rangeStart);
    start.setMinutes(0, 0, 0);
    const end = new Date(rangeEnd);
    if (
      end.getMinutes()
      || end.getSeconds()
      || end.getMilliseconds()
    ) end.setHours(end.getHours() + 1, 0, 0, 0);
    else end.setMinutes(0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime() };
  };
  const getTaskRange = (task) => {
    if (!task?.startAt) return null;
    const taskStart = new Date(task.startAt);
    const dayMerges = mergesByDate[dateKey(taskStart)];
    const range = getCalendarTaskBlockRange(
      task,
      Array.isArray(dayMerges) ? dayMerges : dayMerges?.merges || []
    );
    return range ? cellRange(range.startMs, range.endMs) : null;
  };
  const occurrences = getTaskCalendarOccurrences(tasks).filter((task) => (
    task.status !== 'complete'
    && task.startAt
    && getCalendarEventKey(task) !== excludedEventKey
  ));

  const durationMinutes = Math.min(1440, Math.max(1, Math.round(candidateDuration)));
  const candidateEndMs = startMs + durationMinutes * 60000;
  const candidateRange = cellRange(startMs, candidateEndMs);
  const engineIntervals = [
    ...occurrences.map((task) => {
      const range = getTaskRange(task);
      return range ? { task, startMs: range.startMs, endMs: range.endMs } : null;
    }).filter(Boolean),
    {
      task: candidate,
      identity: getCalendarTaskIdentity(candidate) || '__calendar-placement-candidate__',
      startMs: candidateRange.startMs,
      endMs: candidateRange.endMs,
    },
  ];
  const mergePlan = buildCalendarMergeSegments(engineIntervals);
  if (!mergePlan.valid) return null;
  const candidateIdentity = getCalendarTaskIdentity(candidate) || '__calendar-placement-candidate__';
  const overlappingTasks = occurrences.filter((task) => (
    mergePlan.segments.some((segment) => (
      segment.identityKeys.includes(candidateIdentity)
      && segment.identityKeys.includes(getCalendarTaskIdentity(task))
    ))
  ));

  return {
    durationMinutes,
    segments: [{
      startMs,
      endMs: candidateEndMs,
      estimatedMinutes: durationMinutes,
    }],
    compositeSegments: mergePlan.segments,
    splitTasks: [],
    sameTitleTasks: [],
    overlappingTasks,
    absorbedTasks: [],
    survivor: candidate,
  };
};

// Resolve a drag from a source cell/merged range to a target cell/merged
// range. Flipping the anchor keeps whole merged blocks selected when the drag
// starts inside one and moves upward.
export const resolveCellDragRange = (sourceStart, sourceEnd, targetStart, targetEnd) => {
  if (targetEnd < sourceStart) {
    return { anchorHour: sourceEnd, focusHour: targetStart };
  }
  if (targetStart > sourceEnd) {
    return { anchorHour: sourceStart, focusHour: targetEnd };
  }
  return {
    anchorHour: Math.min(sourceStart, targetStart),
    focusHour: Math.max(sourceEnd, targetEnd),
  };
};

export const getOverlappingCellMerge = (startHour, endHour, merges) =>
  merges.find((merge) => startHour <= merge.endHour && endHour >= merge.startHour) || null;

export const toggleCalendarCellMerge = (merges, startHour, endHour) => {
  const isExactMatch = merges.some(
    (merge) => merge.startHour === startHour && merge.endHour === endHour
  );
  if (isExactMatch) {
    return merges.filter(
      (merge) => merge.startHour !== startHour || merge.endHour !== endHour
    );
  }

  return [
    ...merges.filter(
      (merge) => merge.startHour > endHour || merge.endHour < startHour
    ),
    { startHour, endHour },
  ].sort((left, right) => left.startHour - right.startHour);
};

export const buildCalendarTaskMerge = (tasks, startMs, endMs) => {
  if (!tasks.length || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  const ordered = [...tasks].sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
  const [survivor, ...others] = ordered;
  const snapshot = ordered.flatMap((task) => (
    Array.isArray(task.mergedTasks) && task.mergedTasks.length
      ? task.mergedTasks
      : [{
          taskId: task._id,
          title: task.title,
          startAt: task.startAt || null,
          dueAt: task.dueAt || null,
          estimatedMinutes: task.estimatedMinutes ?? null,
        }]
  ));

  return {
    survivor,
    others,
    title: [...new Set(ordered.map((task) => task.title))].join('\n'),
    snapshot,
    durationMinutes: Math.min(1440, Math.max(1, Math.round((endMs - startMs) / 60000))),
  };
};

export const getCalendarTaskMergeRange = (task, day, selectionStartHour, selectionEndHour) => {
  if (!task?.startAt || !day || selectionEndHour < selectionStartHour) return null;
  const display = getTaskCalendarDisplay(task, day);
  if (display?.kind !== 'scheduled') return null;

  const dayStartMs = startOfDay(day).getTime();
  const startHour = Math.max(
    0,
    Math.min(
      selectionStartHour,
      Math.floor((display.startMs - dayStartMs) / 3600000)
    )
  );
  const endHourExclusive = Math.min(
    24,
    Math.max(
      selectionEndHour + 1,
      Math.ceil((display.endMs - dayStartMs) / 3600000)
    )
  );
  return {
    startHour,
    endHour: endHourExclusive - 1,
    startAt: new Date(dayStartMs + startHour * 3600000).toISOString(),
    dueAt: new Date(dayStartMs + endHourExclusive * 3600000).toISOString(),
    durationMinutes: (endHourExclusive - startHour) * 60,
  };
};

export const splitCalendarTaskRange = (task, cutStartMs, cutEndMs) => {
  if (!task?.startAt || !Number.isFinite(cutStartMs) || !Number.isFinite(cutEndMs) || cutEndMs <= cutStartMs) {
    return [];
  }
  const startMs = new Date(task.startAt).getTime();
  const endMs = startMs + getTaskDurationMinutes(task) * 60000;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= cutEndMs || endMs <= cutStartMs) {
    return [];
  }
  const segments = [];
  if (startMs < cutStartMs) segments.push({ startMs, endMs: Math.min(endMs, cutStartMs) });
  if (endMs > cutEndMs) segments.push({ startMs: Math.max(startMs, cutEndMs), endMs });
  return segments.filter((segment) => segment.endMs > segment.startMs);
};

// Unmerging lays tasks out sequentially from the merged block's top cell:
// one task -> top cell, two tasks -> top cell and the next one, and so on.
export const getSequentialUnmergeSchedule = (entry, blockStart, index) => {
  if (!blockStart) {
    return {
      startAt: entry?.startAt ? new Date(entry.startAt).toISOString() : null,
      dueAt: entry?.dueAt ? new Date(entry.dueAt).toISOString() : null,
      estimatedMinutes: entry?.estimatedMinutes ?? null,
    };
  }

  const cellStart = new Date(blockStart);
  cellStart.setHours(blockStart.getHours() + index, 0, 0, 0);
  return {
    startAt: cellStart.toISOString(),
    dueAt: new Date(cellStart.getTime() + 60 * 60 * 1000).toISOString(),
    estimatedMinutes: 60,
  };
};

export const groupTasksByCalendarDay = (tasks, days) => {
  const groups = new Map();
  const addTask = (key, task) => groups.set(key, [...(groups.get(key) || []), task]);

  for (const task of getTaskCalendarOccurrences(tasks)) {
    if (task.startAt) {
      const start = new Date(task.startAt).getTime();
      const end = start + getTaskDurationMinutes(task) * 60000;
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
      if (days.some((day) => dateKey(day) === key)
        && !groups.get(key)?.some((event) => getCalendarEventKey(event) === getCalendarEventKey(task))) {
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
      const duration = getTaskDurationMinutes(task) * 60 * 1000;
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
      if (!date) return total + getTaskDurationMinutes(task);
      const start = new Date(task.startAt).getTime();
      const end = start + getTaskDurationMinutes(task) * 60 * 1000;
      return total + Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart)) / 60000;
    }, 0);
  return { overlaps, overloaded: plannedMinutes > 480 };
};

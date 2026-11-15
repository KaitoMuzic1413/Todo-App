export const DEFAULT_TASK_DURATION_MINUTES = 30;

export const getTaskDragIntent = (deltaX, deltaY, threshold = 8) => {
  if (Math.hypot(deltaX, deltaY) < threshold) return null;
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'move' : 'select';
};

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
        const activeValues = [...active.values()];
        const members = (activeValues.length === 1
          ? [{
              identity: activeValues[0].identity,
              task: activeValues[0].task,
            }]
          : activeValues
            .map(({ identity, task }) => ({ identity, task }))
            .sort((left, right) => left.identity.localeCompare(right.identity)));
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

// Join consecutive same-title display blocks without changing the underlying tasks.
// Overlapping blocks with other titles remain separate lanes (for example AB vs AC).
export const mergeAdjacentSameTitleBlocks = (blocks) => {
  const ordered = [...blocks].sort((left, right) => (
    left.startMs - right.startMs
    || left.memberIndex - right.memberIndex
    || left.endMs - right.endMs
  ));
  const merged = [];
  for (const block of ordered) {
    const title = String(block.task?.title || '').trim().toLocaleLowerCase();
    const previous = merged.at(-1);
    const previousTitle = String(previous?.task?.title || '').trim().toLocaleLowerCase();
    const canJoin = previous
      && title
      && title === previousTitle
      && !block.isVirtualGroup
      && !previous.isVirtualGroup
      && block.memberCount === 1
      && previous.memberCount === 1
      && block.memberIndex === previous.memberIndex
      && previous.endMs === block.startMs;
    if (!canJoin) {
      merged.push({ ...block, members: block.members || [{ identity: block.identity, task: block.task }] });
      continue;
    }
    previous.endMs = block.endMs;
    previous.identity = [...new Set([...(previous.identity || '').split('+'), ...(block.identity || '').split('+')].filter(Boolean))].join('+');
    previous.members = [...previous.members, ...(block.members || [{ identity: block.identity, task: block.task }])];
    previous.isSameTitleMerge = true;
    previous.isAutoAdjacentMerge = true;
    previous.isTaskEnd = block.isTaskEnd;
  }
  return merged;
};

export const getCalendarSegmentDaySpan = (segment) => {
  if (
    !Number.isFinite(segment?.startMs)
    || !Number.isFinite(segment?.endMs)
    || segment.endMs <= segment.startMs
  ) return null;
  const start = new Date(segment.startMs);
  const occupiedEnd = new Date(segment.endMs - 1);
  if (dateKey(start) !== dateKey(occupiedEnd)) return null;
  const dayStart = startOfDay(start).getTime();
  const startHour = start.getHours();
  const endHour = Math.min(23, Math.ceil(
    (segment.endMs - dayStart) / 3600000
  ) - 1);
  if (endHour <= startHour) return null;
  return { dayKey: dateKey(start), startHour, endHour };
};

const getCalendarTitleNames = (title) => String(title || '')
  .split('\n')
  .map((name) => name.trim())
  .filter(Boolean);

export const buildCalendarMergedTitle = (members) => {
  const names = [];
  const seen = new Set();
  for (const { task } of members || []) {
    for (const name of getCalendarTitleNames(task?.title)) {
      if (seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
  }
  return names.join('\n');
};

const orderMergedPieceMembers = (members, candidateIdentity) => {
  const candidateIndex = members.findIndex(
    ({ identity }) => identity === candidateIdentity
  );
  if (candidateIndex < 0) return members;
  const candidateNames = new Set(
    getCalendarTitleNames(members[candidateIndex].task?.title)
  );
  const hasDuplicateName = members.some((member, index) => (
    index !== candidateIndex
    && getCalendarTitleNames(member.task?.title).some((name) => candidateNames.has(name))
  ));
  if (!hasDuplicateName) {
    return [
      members[candidateIndex],
      ...members.slice(0, candidateIndex),
      ...members.slice(candidateIndex + 1),
    ];
  }
  return [
    ...members.slice(0, candidateIndex),
    ...members.slice(candidateIndex + 1),
    members[candidateIndex],
  ];
};

const clipCalendarPiece = (piece, startMs, endMs) => {
  const clippedStart = Math.max(piece.startMs, startMs);
  const clippedEnd = Math.min(piece.endMs, endMs);
  if (clippedEnd <= clippedStart) return null;
  return {
    startMs: clippedStart,
    endMs: clippedEnd,
    estimatedMinutes: Math.max(1, Math.round((clippedEnd - clippedStart) / 60000)),
  };
};

const subtractCalendarRanges = (startMs, endMs, cuts = []) => {
  const sortedCuts = cuts
    .filter((cut) => cut.endMs > startMs && cut.startMs < endMs)
    .sort((left, right) => left.startMs - right.startMs);
  const pieces = [];
  let cursor = startMs;
  for (const cut of sortedCuts) {
    if (cut.startMs > cursor) {
      pieces.push({ startMs: cursor, endMs: Math.min(cut.startMs, endMs) });
    }
    cursor = Math.max(cursor, cut.endMs);
    if (cursor >= endMs) break;
  }
  if (cursor < endMs) pieces.push({ startMs: cursor, endMs });
  return pieces
    .filter((piece) => piece.endMs > piece.startMs)
    .map((piece) => ({
      ...piece,
      estimatedMinutes: Math.max(1, Math.round((piece.endMs - piece.startMs) / 60000)),
    }));
};

// Moving or pasting a task onto occupied cells splits the collision into
// independent pieces: the unshared cells keep belonging to their original
// task, and every shared range becomes its own merged task. Each returned
// segment can then be moved without touching the other pieces.
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
  const candidateIdentity = getCalendarTaskIdentity(candidate)
    || '__calendar-placement-candidate__';

  const occurrenceIntervals = occurrences.map((task) => {
    const range = getTaskRange(task);
    if (!range) return null;
    const taskStartMs = new Date(task.startAt).getTime();
    const taskEndMs = taskStartMs + getTaskDurationMinutes(task) * 60000;
    return {
      task,
      identity: getCalendarTaskIdentity(task),
      startMs: range.startMs,
      endMs: range.endMs,
      taskStartMs,
      taskEndMs,
    };
  }).filter(Boolean);

  const overlappingIntervals = occurrenceIntervals.filter((interval) => (
    interval.startMs < candidateRange.endMs
    && interval.endMs > candidateRange.startMs
  ));

  const mergePlan = buildCalendarMergeSegments([
    ...overlappingIntervals,
    {
      task: candidate,
      identity: candidateIdentity,
      startMs: candidateRange.startMs,
      endMs: candidateRange.endMs,
    },
  ]);
  if (!mergePlan.valid) return null;

  const mergedPieces = mergePlan.segments
    .filter((segment) => segment.identityKeys.length > 1)
    .map((segment) => {
      const clipped = clipCalendarPiece(segment, startMs, candidateEndMs);
      return clipped
        ? {
            ...clipped,
            identityKeys: segment.identityKeys,
            members: orderMergedPieceMembers(segment.members, candidateIdentity),
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.startMs - right.startMs);

  const segments = subtractCalendarRanges(startMs, candidateEndMs, mergedPieces);

  const splitTasks = [];
  const absorbedTasks = [];
  const seenIdentities = new Set();
  for (const interval of overlappingIntervals) {
    if (seenIdentities.has(interval.identity)) continue;
    seenIdentities.add(interval.identity);
    const cuts = mergedPieces.filter(
      (piece) => piece.identityKeys.includes(interval.identity)
    );
    const remainingSegments = subtractCalendarRanges(
      interval.taskStartMs,
      interval.taskEndMs,
      cuts
    );
    if (!remainingSegments.length) {
      absorbedTasks.push(interval.task);
      continue;
    }
    const unchanged = remainingSegments.length === 1
      && remainingSegments[0].startMs === interval.taskStartMs
      && remainingSegments[0].endMs === interval.taskEndMs;
    if (!unchanged) {
      splitTasks.push({ task: interval.task, segments: remainingSegments });
    }
  }

  return {
    durationMinutes,
    segments,
    compositeSegments: mergePlan.segments,
    mergedPieces,
    splitTasks,
    sameTitleTasks: [],
    overlappingTasks: overlappingIntervals.map(({ task }) => task),
    absorbedTasks,
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
    title: buildCalendarMergedTitle(ordered.map((task) => ({ task }))),
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
  const eventKeysByDay = new Map();
  const dayInfos = [];
  const dayInfoByKey = new Map();

  for (const day of days) {
    const key = dateKey(day);
    const start = startOfDay(day).getTime();
    const nextDay = startOfDay(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const info = { key, startMs: start, endMs: nextDay.getTime() };
    dayInfos.push(info);
    if (!dayInfoByKey.has(key)) dayInfoByKey.set(key, info);
  }

  const addTask = (key, task, eventKey) => {
    const group = groups.get(key);
    if (group) group.push(task);
    else groups.set(key, [task]);
    const keys = eventKeysByDay.get(key);
    if (keys) keys.add(eventKey);
    else eventKeysByDay.set(key, new Set([eventKey]));
  };

  for (const task of getTaskCalendarOccurrences(tasks)) {
    const eventKey = getCalendarEventKey(task);
    if (task.startAt) {
      const start = new Date(task.startAt).getTime();
      const end = start + getTaskDurationMinutes(task) * 60000;
      for (const info of dayInfos) {
        if (start < info.endMs && end > info.startMs) {
          addTask(info.key, task, eventKey);
        }
      }
    }
    if (task.dueAt) {
      const key = dateKey(new Date(task.dueAt));
      if (dayInfoByKey.has(key) && !eventKeysByDay.get(key)?.has(eventKey)) {
        addTask(key, task, eventKey);
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
  const blocks = [];
  let plannedMinutes = 0;

  for (const task of dayTasks) {
    if (!task.startAt) continue;
    const durationMinutes = getTaskDurationMinutes(task);
    const start = new Date(task.startAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    const clippedStart = Math.max(start, dayStart);
    const clippedEnd = Math.min(end, dayEnd);
    if (date) {
      plannedMinutes += Math.max(0, clippedEnd - clippedStart) / 60000;
    } else {
      plannedMinutes += durationMinutes;
    }
    if (clippedStart < clippedEnd) {
      blocks.push({ start: clippedStart, end: clippedEnd });
    }
  }

  blocks.sort((left, right) => left.start - right.start);

  let furthestEnd = 0;
  let overlaps = false;
  for (const block of blocks) {
    if (block.start < furthestEnd) overlaps = true;
    furthestEnd = Math.max(furthestEnd, block.end);
  }

  return { overlaps, overloaded: plannedMinutes > 480 };
};

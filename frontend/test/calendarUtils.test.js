import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarMergeSegments,
  buildCalendarMergedTitle,
  buildCalendarTaskMerge,
  dateKey,
  DEFAULT_TASK_DURATION_MINUTES,
  getCalendarDays,
  getCalendarRange,
  getCalendarEventKey,
  getCalendarSegmentDaySpan,
  getCalendarTaskIdentity,
  groupCalendarMergeMembersByTitle,
  mergeAdjacentSameTitleBlocks,
  getDayWarnings,
  findSameSizeCalendarCollision,
  getCalendarTaskMergeRange,
  getOverlappingCellMerge,
  getSequentialUnmergeSchedule,
  getTaskCalendarDisplay,
  getTaskDragIntent,
  getTaskDurationMinutes,
  getCalendarTaskBlockRange,
  isCalendarMergeOccupied,
  groupTasksByCalendarDay,
  planCalendarTaskPlacement,
  resolveCellDragRange,
  splitCalendarTaskRange,
  toggleCalendarCellMerge,
} from '../src/lib/calendarUtils.js';

test('automatically joins adjacent same-title calendar blocks but keeps different titles separate', () => {
  const taskA1 = { _id: 'a1', title: 'A' };
  const taskA2 = { _id: 'a2', title: 'A' };
  const taskB = { _id: 'b', title: 'B' };
  const joined = mergeAdjacentSameTitleBlocks([
    { identity: 'a1:primary', task: taskA1, startMs: 9, endMs: 12, memberIndex: 0, memberCount: 1, isTaskStart: true, isTaskEnd: true },
    { identity: 'a2:primary', task: taskA2, startMs: 12, endMs: 14, memberIndex: 0, memberCount: 1, isTaskStart: true, isTaskEnd: true },
    { identity: 'b:primary', task: taskB, startMs: 14, endMs: 15, memberIndex: 0, memberCount: 1, isTaskStart: true, isTaskEnd: true },
  ]);
  assert.equal(joined.length, 2);
  assert.deepEqual([joined[0].startMs, joined[0].endMs], [9, 14]);
  assert.equal(joined[0].identity, 'a1:primary+a2:primary');
  assert.equal(joined[0].isAutoAdjacentMerge, true);
  assert.equal(joined[0].members.length, 2);
  assert.equal(joined[1].task.title, 'B');
});

test('keeps adjacent virtual overlap segments separate even when their labels match', () => {
  const taskA = { _id: 'a', title: 'A' };
  const taskB = { _id: 'b', title: 'A' };
  const blocks = mergeAdjacentSameTitleBlocks([
    { identity: 'a:primary', task: taskA, startMs: 1, endMs: 2, memberIndex: 0, memberCount: 1 },
    {
      identity: 'a:primary+b:primary',
      task: taskA,
      members: [
        { identity: 'a:primary', task: taskA },
        { identity: 'b:primary', task: taskB },
      ],
      startMs: 2,
      endMs: 3,
      memberIndex: 0,
      memberCount: 1,
      isVirtualGroup: true,
    },
    { identity: 'a:primary', task: taskA, startMs: 3, endMs: 4, memberIndex: 0, memberCount: 1 },
  ]);

  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].isVirtualGroup, true);
});

test('does not join same-title blocks across a gap or across a different-title lane', () => {
  const taskA = { _id: 'a', title: 'A' };
  const taskB = { _id: 'b', title: 'B' };
  const blocks = mergeAdjacentSameTitleBlocks([
    { identity: 'a1', task: taskA, startMs: 9, endMs: 10, memberIndex: 0, memberCount: 1 },
    { identity: 'a2', task: taskA, startMs: 11, endMs: 12, memberIndex: 0, memberCount: 1 },
    { identity: 'b1', task: taskB, startMs: 12, endMs: 13, memberIndex: 0, memberCount: 2 },
    { identity: 'a3', task: taskA, startMs: 12, endMs: 13, memberIndex: 1, memberCount: 2 },
  ]);
  assert.equal(blocks.length, 4);
});

test('week calendar starts on Monday and spans seven local dates', () => {
  const days = getCalendarDays('week', new Date(2026, 9, 10, 15));
  assert.equal(days.length, 7);
  assert.equal(dateKey(days[0]), '2026-10-05');
  assert.equal(dateKey(days[6]), '2026-10-11');
});

test('month calendar returns a six-week grid containing every date in the month', () => {
  const days = getCalendarDays('month', new Date(2026, 9, 10));
  assert.equal(days.length, 42);
  assert.ok(days.some((date) => dateKey(date) === '2026-10-01'));
  assert.equal(days[0].getDay(), 1);
});

test('day calendar contains only the selected local date', () => {
  const days = getCalendarDays('day', new Date(2026, 9, 10, 23));
  assert.equal(days.length, 1);
  assert.equal(dateKey(days[0]), '2026-10-10');
  assert.equal(days[0].getHours(), 0);
});

test('calendar query range uses the visible first day through the next day boundary', () => {
  const days = getCalendarDays('week', new Date(2026, 9, 10));
  const range = getCalendarRange(days);
  assert.equal(new Date(range.start).getTime(), new Date(2026, 9, 5).getTime());
  assert.equal(new Date(range.endExclusive).getTime(), new Date(2026, 9, 12).getTime());
});

test('detects nested overlaps and days above the eight-hour plan limit', () => {
  const warnings = getDayWarnings([
    { startAt: '2026-10-10T09:00:00', estimatedMinutes: 180 },
    { startAt: '2026-10-10T09:30:00', estimatedMinutes: 30 },
    { startAt: '2026-10-10T11:00:00', estimatedMinutes: 300 },
  ]);
  assert.deepEqual(warnings, { overlaps: true, overloaded: true });
});

test('does not flag adjacent blocks as overlapping', () => {
  const warnings = getDayWarnings([
    { startAt: '2026-10-10T09:00:00', estimatedMinutes: 60 },
    { startAt: '2026-10-10T10:00:00', estimatedMinutes: 60 },
  ]);
  assert.deepEqual(warnings, { overlaps: false, overloaded: false });
});

test('splits a calendar task into the intervals remaining after an inserted task', () => {
  const task = {
    startAt: '2026-10-10T02:00:00.000Z',
    estimatedMinutes: 360,
  };
  const at = (hour) => new Date(`2026-10-10T${String(hour).padStart(2, '0')}:00:00.000Z`).getTime();
  const ranges = (startHour, endHour) => splitCalendarTaskRange(task, at(startHour), at(endHour))
    .map(({ startMs, endMs }) => [new Date(startMs).getUTCHours(), new Date(endMs).getUTCHours()]);

  assert.deepEqual(ranges(4, 6), [[2, 4], [6, 8]]);
  assert.deepEqual(ranges(2, 4), [[4, 8]]);
  assert.deepEqual(ranges(6, 8), [[2, 6]]);
  assert.deepEqual(ranges(2, 8), []);
  assert.deepEqual(ranges(1, 9), []);
});

test('uses the full merged-cell frame when calculating a task split', () => {
  const day = new Date(2026, 9, 10);
  const localHour = (hour) => {
    const date = new Date(day);
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  };
  const task = {
    startAt: new Date(localHour(3)).toISOString(),
    estimatedMinutes: 30,
  };
  const mergedRange = getCalendarTaskBlockRange(task, [{ startHour: 3, endHour: 7 }]);
  assert.deepEqual(
    [new Date(mergedRange.startMs).getHours(), new Date(mergedRange.endMs).getHours()],
    [3, 8]
  );
  const split = splitCalendarTaskRange({
    ...task,
    startAt: new Date(mergedRange.startMs).toISOString(),
    estimatedMinutes: (mergedRange.endMs - mergedRange.startMs) / 60000,
  }, localHour(5), localHour(7));
  assert.deepEqual(split.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[3, 5], [7, 8]]);
});

test('does not inflate a smaller task located inside another task merge', () => {
  const task = {
    startAt: new Date(2026, 9, 10, 5).toISOString(),
    estimatedMinutes: 60,
  };
  const range = getCalendarTaskBlockRange(task, [{ startHour: 3, endHour: 7 }]);
  assert.deepEqual(
    [new Date(range.startMs).getHours(), new Date(range.endMs).getHours()],
    [5, 6]
  );
});

test('detects an occupied merged range so pasted tasks keep their own duration', () => {
  const day = new Date(2026, 9, 10);
  const merge = { startHour: 3, endHour: 7 };
  const taskInsideMerge = {
    _id: 'task-inside-merge',
    startAt: new Date(2026, 9, 10, 5).toISOString(),
    estimatedMinutes: 60,
    status: 'active',
  };
  assert.equal(isCalendarMergeOccupied(merge, [taskInsideMerge], day), true);
  assert.equal(isCalendarMergeOccupied(merge, [], day), false);
});

test('clips overnight block workload to each local day', () => {
  const block = { startAt: '2026-10-10T23:30:00', estimatedMinutes: 60 };
  assert.deepEqual(getDayWarnings([block], new Date(2026, 9, 10)), { overlaps: false, overloaded: false });
  assert.deepEqual(getDayWarnings([block], new Date(2026, 9, 11)), { overlaps: false, overloaded: false });
});

test('shows an overnight time block on each day it overlaps', () => {
  const days = [new Date(2026, 9, 10), new Date(2026, 9, 11)];
  const task = { _id: 'overnight', startAt: new Date(2026, 9, 10, 23, 30).toISOString(), estimatedMinutes: 60 };
  const grouped = groupTasksByCalendarDay([task], days);
  assert.deepEqual(grouped.get(dateKey(days[0])).map(({ _id }) => _id), ['overnight']);
  assert.deepEqual(grouped.get(dateKey(days[1])).map(({ _id }) => _id), ['overnight']);
});

test('shows a task with a separate deadline on its due date', () => {
  const startDay = new Date(2026, 9, 10);
  const dueDay = new Date(2026, 9, 12);
  const task = {
    _id: 'scheduled-with-deadline',
    startAt: new Date(2026, 9, 10, 9).toISOString(),
    dueAt: new Date(2026, 9, 12, 17).toISOString(),
    estimatedMinutes: 60,
  };
  const grouped = groupTasksByCalendarDay([task], [startDay, dueDay]);
  assert.equal(grouped.get(dateKey(startDay)).length, 1);
  assert.equal(grouped.get(dateKey(dueDay)).length, 1);
});

test('shows every calendar occurrence while keeping a shared task id', () => {
  const day = new Date(2026, 9, 10);
  const task = {
    _id: 'one-task',
    title: 'Go for a walk',
    startAt: new Date(2026, 9, 10, 8).toISOString(),
    dueAt: new Date(2026, 9, 10, 8, 30).toISOString(),
    estimatedMinutes: 30,
    calendarOccurrences: [
      {
        _id: 'occurrence-1',
        startAt: new Date(2026, 9, 10, 12).toISOString(),
        dueAt: new Date(2026, 9, 10, 12, 30).toISOString(),
        estimatedMinutes: 30,
      },
      {
        _id: 'occurrence-2',
        startAt: new Date(2026, 9, 11, 12).toISOString(),
        dueAt: new Date(2026, 9, 11, 12, 30).toISOString(),
        estimatedMinutes: 30,
      },
    ],
  };

  const grouped = groupTasksByCalendarDay([task], [day, new Date(2026, 9, 11)]);
  const firstDayEvents = grouped.get(dateKey(day));
  assert.equal(firstDayEvents.length, 2);
  assert.deepEqual(firstDayEvents.map((event) => event._id), ['one-task', 'one-task']);
  assert.deepEqual(
    firstDayEvents.map(getCalendarEventKey),
    ['one-task:primary', 'one-task:occurrence-1']
  );
  assert.equal(grouped.get(dateKey(new Date(2026, 9, 11))).length, 1);
});
test('uses one default duration for every calendar calculation', () => {
  assert.equal(DEFAULT_TASK_DURATION_MINUTES, 30);
  assert.equal(getTaskDurationMinutes({}), 30);
  assert.equal(getTaskDurationMinutes({ estimatedMinutes: 0 }), 30);
  assert.equal(getTaskDurationMinutes({ estimatedMinutes: 45 }), 45);
  assert.equal(getTaskDurationMinutes({ estimatedMinutes: 2000 }), 1440);
});

test('clips an overnight block to midnight and starts it at midnight on the next day', () => {
  const firstDay = new Date(2026, 9, 10);
  const secondDay = new Date(2026, 9, 11);
  const task = {
    startAt: new Date(2026, 9, 10, 23, 30).toISOString(),
    estimatedMinutes: 60,
  };

  const first = getTaskCalendarDisplay(task, firstDay);
  assert.equal(first.kind, 'scheduled');
  assert.equal(first.startMs, new Date(2026, 9, 10, 23, 30).getTime());
  assert.equal(first.endMs, new Date(2026, 9, 11, 0, 0).getTime());

  const second = getTaskCalendarDisplay(task, secondDay);
  assert.equal(second.kind, 'scheduled');
  assert.equal(second.startMs, secondDay.getTime());
  assert.equal(second.endMs, new Date(2026, 9, 11, 0, 30).getTime());
});

test('shows a deadline-only task at its due time instead of hiding it', () => {
  const day = new Date(2026, 9, 12);
  const task = { dueAt: new Date(2026, 9, 12, 17).toISOString() };

  const display = getTaskCalendarDisplay(task, day);
  assert.equal(display.kind, 'deadline');
  assert.equal(display.startMs, new Date(2026, 9, 12, 17).getTime());
  assert.equal(display.endMs, new Date(2026, 9, 12, 17, 30).getTime());
});

test('shows a later deadline at its due time on the due day', () => {
  const startDay = new Date(2026, 9, 10);
  const dueDay = new Date(2026, 9, 12);
  const task = {
    startAt: new Date(2026, 9, 10, 9).toISOString(),
    dueAt: new Date(2026, 9, 12, 17).toISOString(),
    estimatedMinutes: 60,
  };

  assert.equal(getTaskCalendarDisplay(task, startDay).kind, 'scheduled');
  const dueDisplay = getTaskCalendarDisplay(task, dueDay);
  assert.equal(dueDisplay.kind, 'deadline');
  assert.equal(dueDisplay.startMs, new Date(2026, 9, 12, 17).getTime());
});

test('treats dueAt as the block end when it matches the scheduled duration', () => {
  const day = new Date(2026, 9, 10);
  const task = {
    startAt: new Date(2026, 9, 10, 9).toISOString(),
    dueAt: new Date(2026, 9, 10, 10).toISOString(),
    estimatedMinutes: 60,
  };

  const display = getTaskCalendarDisplay(task, day);
  assert.equal(display.kind, 'scheduled');
  assert.equal(display.startMs, new Date(2026, 9, 10, 9).getTime());
  assert.equal(display.endMs, new Date(2026, 9, 10, 10).getTime());
});

test('unmerge puts one task back at the top cell of the merged block', () => {
  const blockStart = new Date(2026, 9, 10, 4);
  const schedule = getSequentialUnmergeSchedule(
    { startAt: new Date(2026, 9, 10, 9).toISOString(), estimatedMinutes: 120 },
    blockStart,
    0
  );

  assert.equal(new Date(schedule.startAt).getHours(), 4);
  assert.equal(new Date(schedule.startAt).getMinutes(), 0);
  assert.equal(schedule.estimatedMinutes, 60);
});

test('unmerge lays multiple tasks out one cell at a time from the top', () => {
  const blockStart = new Date(2026, 9, 10, 4);
  const starts = ['Đi học', 'Đi chơi', 'Đi ngủ'].map((title, index) => {
    const schedule = getSequentialUnmergeSchedule({ title }, blockStart, index);
    return new Date(schedule.startAt).getHours();
  });

  assert.deepEqual(starts, [4, 5, 6]);
});

test('unmerge keeps the snapshot schedule when the merged block has no start', () => {
  const startAt = new Date(2026, 9, 10, 9).toISOString();
  const schedule = getSequentialUnmergeSchedule({ startAt, estimatedMinutes: 45 }, null, 0);

  assert.equal(schedule.startAt, startAt);
  assert.equal(schedule.estimatedMinutes, 45);
});

test('dragging upward into merged blocks keeps both blocks fully selected', () => {
  const firstMerge = resolveCellDragRange(6, 6, 3, 5);
  assert.deepEqual(firstMerge, { anchorHour: 6, focusHour: 3 });

  const secondMerge = resolveCellDragRange(6, 6, 1, 2);
  assert.deepEqual(secondMerge, { anchorHour: 6, focusHour: 1 });
});

test('dragging upward from inside a merged block keeps its lower cells selected', () => {
  assert.deepEqual(
    resolveCellDragRange(3, 5, 1, 2),
    { anchorHour: 5, focusHour: 1 }
  );
});

test('dragging downward from inside a merged block keeps its upper cells selected', () => {
  assert.deepEqual(
    resolveCellDragRange(3, 5, 6, 6),
    { anchorHour: 3, focusHour: 6 }
  );
});

test('dragging into a merged block from either side selects every merged cell', () => {
  assert.deepEqual(
    resolveCellDragRange(2, 2, 4, 6),
    { anchorHour: 2, focusHour: 6 }
  );
  assert.deepEqual(
    resolveCellDragRange(8, 8, 4, 6),
    { anchorHour: 8, focusHour: 4 }
  );
});

test('a task overlapping any part of a merged range resolves to the whole merge', () => {
  const merges = [{ startHour: 4, endHour: 6 }];

  assert.deepEqual(getOverlappingCellMerge(6, 6, merges), merges[0]);
  assert.deepEqual(getOverlappingCellMerge(4, 4, merges), merges[0]);
  assert.equal(getOverlappingCellMerge(7, 7, merges), null);
});

test('merging empty cells replaces overlaps and toggles an exact merged range off', () => {
  const existing = [
    { startHour: 2, endHour: 3 },
    { startHour: 8, endHour: 9 },
  ];

  assert.deepEqual(
    toggleCalendarCellMerge(existing, 3, 5),
    [
      { startHour: 3, endHour: 5 },
      { startHour: 8, endHour: 9 },
    ]
  );
  assert.deepEqual(
    toggleCalendarCellMerge(existing, 2, 3),
    [{ startHour: 8, endHour: 9 }]
  );
});

test('merging tasks with empty cells preserves task snapshots and covers the selected range', () => {
  const tasks = [
    {
      _id: 'later',
      title: 'Second',
      startAt: new Date(2026, 9, 10, 5).toISOString(),
      estimatedMinutes: 60,
    },
    {
      _id: 'first',
      title: 'First',
      startAt: new Date(2026, 9, 10, 4).toISOString(),
      estimatedMinutes: 60,
    },
  ];
  const start = new Date(2026, 9, 10, 4).getTime();
  const end = new Date(2026, 9, 10, 7).getTime();
  const merge = buildCalendarTaskMerge(tasks, start, end);

  assert.equal(merge.survivor._id, 'first');
  assert.deepEqual(merge.others.map((task) => task._id), ['later']);
  assert.equal(merge.title, 'First\nSecond');
  assert.equal(merge.durationMinutes, 180);
  assert.deepEqual(merge.snapshot.map((task) => task.taskId), ['first', 'later']);
});

test('same-sized tasks cannot overlap even when one occupies a merged frame', () => {
  const task = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 10).toISOString(),
    estimatedMinutes: 60,
  };
  const mergesByDate = { '2026-10-10': [{ startHour: 10, endHour: 11 }] };
  const collision = findSameSizeCalendarCollision(
    [task],
    {
      startMs: new Date(2026, 9, 10, 10).getTime(),
      endMs: new Date(2026, 9, 10, 12).getTime(),
    },
    undefined,
    mergesByDate
  );

  assert.equal(collision?._id, 'task-a');
});

test('same-sized collision detection accepts calendar note records', () => {
  const task = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 10).toISOString(),
    estimatedMinutes: 60,
  };
  const collision = findSameSizeCalendarCollision(
    [task],
    {
      startMs: new Date(2026, 9, 10, 10).getTime(),
      endMs: new Date(2026, 9, 10, 12).getTime(),
    },
    undefined,
    { '2026-10-10': { content: '', merges: [{ startHour: 10, endHour: 11 }] } }
  );

  assert.equal(collision?._id, 'task-a');
});

test('same-sized collision detection ignores the moved task and permits unequal sizes', () => {
  const task = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 10).toISOString(),
    estimatedMinutes: 120,
  };
  const candidate = {
    startMs: new Date(2026, 9, 10, 10).getTime(),
    endMs: new Date(2026, 9, 10, 12).getTime(),
  };

  assert.equal(
    findSameSizeCalendarCollision([task], candidate, 'task-a:primary'),
    undefined
  );
  assert.equal(findSameSizeCalendarCollision([task], {
    startMs: candidate.startMs,
    endMs: new Date(2026, 9, 10, 11).getTime(),
  }), undefined);
});

test('placement preserves both task records when their ranges overlap', () => {
  const task = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 3).toISOString(),
    estimatedMinutes: 180,
  };
  const plan = planCalendarTaskPlacement([task], {
    _id: 'task-b',
    title: 'B',
    createdAt: new Date(2026, 9, 1).toISOString(),
    startAt: new Date(2026, 9, 10, 1).toISOString(),
    estimatedMinutes: 420,
  });

  assert.deepEqual(plan.segments.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[1, 3], [6, 8]]);
  assert.deepEqual(plan.overlappingTasks.map(({ _id }) => _id), ['task-a']);
  assert.deepEqual(plan.compositeSegments.map(({ identityKeys }) => identityKeys.length), [1, 2, 1]);
  assert.deepEqual(plan.absorbedTasks.map(({ _id }) => _id), ['task-a']);
  assert.equal(plan.splitTasks.length, 0);
  assert.deepEqual(plan.mergedPieces.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[3, 6]]);
});

test('placement splits both tasks into independent non-overlap and merged pieces', () => {
  const taskA = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 1).toISOString(),
    estimatedMinutes: 180,
  };
  const taskB = {
    _id: 'task-b',
    title: 'B',
    startAt: new Date(2026, 9, 10, 2).toISOString(),
    estimatedMinutes: 180,
  };
  const plan = planCalendarTaskPlacement(
    [taskA, taskB],
    {
      _id: 'task-a',
      title: 'A',
      startAt: new Date(2026, 9, 10, 1).toISOString(),
      estimatedMinutes: 180,
    },
    {},
    'task-a:primary'
  );

  assert.deepEqual(plan.segments.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[1, 2]]);
  assert.deepEqual(plan.splitTasks.map(({ task, segments }) => [
    task._id,
    segments.map(({ startMs, endMs }) => [
      new Date(startMs).getHours(),
      new Date(endMs).getHours(),
    ]),
  ]), [['task-b', [[4, 5]]]]);
  assert.deepEqual(plan.absorbedTasks, []);
  assert.deepEqual(plan.mergedPieces.map(({ startMs, endMs, members }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
    members.map(({ task }) => task._id),
  ]), [[2, 4, ['task-a', 'task-b']]]);
});

test('placement keeps unshared cells of a fully absorbed task out of the merged piece', () => {
  const taskA = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 1).toISOString(),
    estimatedMinutes: 120,
  };
  const taskB = {
    _id: 'task-b',
    title: 'B',
    startAt: new Date(2026, 9, 10, 2).toISOString(),
    estimatedMinutes: 120,
  };
  const plan = planCalendarTaskPlacement(
    [taskA, taskB],
    {
      _id: 'task-a',
      title: 'A',
      startAt: new Date(2026, 9, 10, 1).toISOString(),
      estimatedMinutes: 120,
    },
    {},
    'task-a:primary'
  );

  assert.deepEqual(plan.segments.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[1, 2]]);
  assert.deepEqual(plan.splitTasks.map(({ task, segments }) => [
    task._id,
    segments.map(({ startMs, endMs }) => [
      new Date(startMs).getHours(),
      new Date(endMs).getHours(),
    ]),
  ]), [['task-b', [[3, 4]]]]);
  assert.deepEqual(plan.mergedPieces.map(({ startMs, endMs }) => [
    new Date(startMs).getHours(),
    new Date(endMs).getHours(),
  ]), [[2, 3]]);
});

test('placement clips a fully covered candidate to its real duration', () => {
  const taskB = {
    _id: 'task-b',
    title: 'B',
    startAt: new Date(2026, 9, 10, 2).toISOString(),
    estimatedMinutes: 120,
  };
  const plan = planCalendarTaskPlacement(
    [taskB],
    {
      title: 'C',
      startAt: new Date(2026, 9, 10, 2, 30).toISOString(),
      estimatedMinutes: 30,
    },
    {},
    'candidate-c'
  );

  assert.deepEqual(plan.segments, []);
  assert.deepEqual(plan.absorbedTasks, []);
  assert.deepEqual(plan.splitTasks.map(({ task, segments }) => [
    task._id,
    segments.map(({ startMs, endMs }) => [
      new Date(startMs).getHours(),
      new Date(startMs).getMinutes(),
      new Date(endMs).getHours(),
      new Date(endMs).getMinutes(),
    ]),
  ]), [['task-b', [[2, 0, 2, 30], [3, 0, 4, 0]]]]);
  assert.deepEqual(plan.mergedPieces.map(({ startMs, endMs, estimatedMinutes }) => [
    new Date(startMs).getHours(),
    new Date(startMs).getMinutes(),
    new Date(endMs).getHours(),
    new Date(endMs).getMinutes(),
    estimatedMinutes,
  ]), [[2, 30, 3, 0, 30]]);
});

test('merged titles keep each task name only once', () => {
  assert.equal(buildCalendarMergedTitle([
    { task: { title: 'B\nC' } },
    { task: { title: 'C' } },
  ]), 'B\nC');
  assert.equal(buildCalendarMergedTitle([
    { task: { title: 'A' } },
    { task: { title: 'B' } },
    { task: { title: 'A' } },
  ]), 'A\nB');
});

test('placement merging a C piece into a BC piece keeps the title BC', () => {
  const taskBC = {
    _id: 'task-bc',
    title: 'B\nC',
    startAt: new Date(2026, 9, 10, 3).toISOString(),
    estimatedMinutes: 60,
  };
  const taskC = {
    _id: 'task-c',
    title: 'C',
    startAt: new Date(2026, 9, 10, 4).toISOString(),
    estimatedMinutes: 60,
  };
  const plan = planCalendarTaskPlacement(
    [taskBC, taskC],
    {
      _id: 'task-c',
      title: 'C',
      startAt: new Date(2026, 9, 10, 3).toISOString(),
      estimatedMinutes: 60,
    },
    {},
    'task-c:primary'
  );

  assert.equal(plan.mergedPieces.length, 1);
  assert.equal(buildCalendarMergedTitle(plan.mergedPieces[0].members), 'B\nC');
  assert.deepEqual(
    plan.mergedPieces[0].members.map(({ task }) => task.title),
    ['B\nC', 'C']
  );
});

test('calendar segment day span returns whole-hour merge frames', () => {
  const span = getCalendarSegmentDaySpan({
    startMs: new Date(2026, 9, 10, 2).getTime(),
    endMs: new Date(2026, 9, 10, 5).getTime(),
  });
  assert.deepEqual(span, { dayKey: '2026-10-10', startHour: 2, endHour: 4 });
  assert.equal(getCalendarSegmentDaySpan({
    startMs: new Date(2026, 9, 10, 22).getTime(),
    endMs: new Date(2026, 9, 11, 2).getTime(),
  }), null);
});

test('sweep-line merge uses half-open ranges for shared and exclusive areas', () => {
  const task = (id, start, end) => ({
    _id: id,
    title: id,
    startMs: start,
    endMs: end,
  });
  const cases = [
    { inputs: [task('A', 1, 4), task('B', 1, 2)], expected: [['A', 'B'], ['A'], ['A']] },
    { inputs: [task('A', 1, 4), task('B', 3, 4)], expected: [['A'], ['A'], ['A', 'B']] },
    { inputs: [task('A', 2, 3), task('B', 1, 4)], expected: [['B'], ['A', 'B'], ['B']] },
    { inputs: [task('A', 3, 4), task('B', 1, 4)], expected: [['B'], ['B'], ['A', 'B']] },
    { inputs: [task('A', 1, 4), task('B', 3, 6)], expected: [['A'], ['A', 'B'], ['B']] },
    { inputs: [task('A', 1, 6), task('B', 3, 5)], expected: [['A'], ['A', 'B'], ['A']] },
    { inputs: [task('A', 1, 4), task('B', 2, 5)], expected: [['A'], ['A', 'B'], ['B']] },
    { inputs: [task('A', 1, 3), task('B', 3, 5)], expected: [['A'], ['B']] },
    {
      inputs: [task('A', 1, 3), task('B', 2, 4), task('C', 2, 5)],
      expected: [['A'], ['A', 'B', 'C'], ['B', 'C'], ['C']],
    },
    {
      inputs: [task('A', 1, 8), task('B', 2, 3), task('C', 5, 6)],
      expected: [['A'], ['A', 'B'], ['A'], ['A'], ['A', 'C'], ['A'], ['A']],
    },
    {
      inputs: [task('A', 1, 4), task('B', 3, 6), task('C', 5, 8)],
      expected: [['A'], ['A', 'B'], ['B'], ['B', 'C'], ['C']],
    },
  ];

  for (const { inputs, expected } of cases) {
    const result = buildCalendarMergeSegments(inputs.map(({ _id, startMs, endMs }) => ({
      task: { _id, title: _id },
      startMs,
      endMs,
    })));
    assert.equal(result.valid, true);
    const collapsedExpected = expected.filter((members, index) => (
      index === 0 || JSON.stringify(members) !== JSON.stringify(expected[index - 1])
    ));
    assert.deepEqual(
      result.segments.map(({ identityKeys }) => identityKeys.map((key) => key.split(':')[0])),
      collapsedExpected
    );
  }
});

test('merge engine deduplicates identity ranges without filling gaps or using titles', () => {
  const sameTitleDifferentTasks = buildCalendarMergeSegments([
    { task: { _id: 'A', title: 'Same' }, startMs: 1, endMs: 3 },
    { task: { _id: 'B', title: 'Same' }, startMs: 2, endMs: 4 },
  ]);
  assert.deepEqual(
    sameTitleDifferentTasks.segments.map(({ identityKeys }) => identityKeys),
    [['A:primary'], ['A:primary', 'B:primary'], ['B:primary']]
  );
  assert.equal(getCalendarTaskIdentity({
    _id: 'A',
    calendarOccurrenceId: 'occ-1',
  }), 'A:occ-1');

  const repeatedIdentity = buildCalendarMergeSegments([
    { identity: 'same', task: { _id: 'A' }, startMs: 1, endMs: 3 },
    { identity: 'same', task: { _id: 'A' }, startMs: 4, endMs: 6 },
  ]);
  assert.deepEqual(
    repeatedIdentity.segments.map(({ startMs, endMs }) => [startMs, endMs]),
    [[1, 3], [4, 6]]
  );
});

test('same-title members in an overlapping segment render as one merged group', () => {
  const groups = groupCalendarMergeMembersByTitle([
    {
      identity: 'task-a:primary',
      task: { _id: 'task-a', title: 'Same title', createdAt: '2026-11-01T10:00:00Z' },
    },
    {
      identity: 'task-b:primary',
      task: { _id: 'task-b', title: 'Same title', createdAt: '2026-11-02T10:00:00Z' },
    },
    {
      identity: 'task-c:primary',
      task: { _id: 'task-c', title: 'Different title' },
    },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].title, 'Same title');
  assert.deepEqual(groups[0].members.map(({ identity }) => identity), [
    'task-b:primary',
    'task-a:primary',
  ]);
  assert.equal(groups[0].task._id, 'task-b');
});

test('merge engine rejects invalid ranges and missing identities', () => {
  const result = buildCalendarMergeSegments([
    { task: { _id: 'A' }, startMs: 2, endMs: 2 },
    { task: { title: 'No identity' }, startMs: 1, endMs: 2 },
  ]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.conflicts.map(({ code }) => code), ['invalid-range', 'missing-identity']);
});

test('placement does not deduplicate different task IDs with the same title', () => {
  const existing = {
    _id: 'task-a',
    title: 'Same',
    startAt: new Date(2026, 9, 10, 3).toISOString(),
    estimatedMinutes: 180,
  };
  const candidate = {
    _id: 'task-b',
    title: 'Same',
    startAt: new Date(2026, 9, 10, 1).toISOString(),
    estimatedMinutes: 420,
  };
  const plan = planCalendarTaskPlacement([existing], candidate);

  assert.equal(plan.survivor._id, 'task-b');
  assert.equal(plan.durationMinutes, 420);
  assert.deepEqual(plan.sameTitleTasks, []);
  assert.deepEqual(plan.overlappingTasks.map(({ _id }) => _id), ['task-a']);
  assert.equal(plan.compositeSegments.some((segment) => segment.identityKeys.length === 2), true);
});

test('merging an existing merged task flattens its snapshots', () => {
  const task = {
    _id: 'merged',
    title: 'Merged',
    startAt: new Date(2026, 9, 10, 4).toISOString(),
    mergedTasks: [
      { taskId: 'original-1', title: 'Original 1' },
      { taskId: 'original-2', title: 'Original 2' },
    ],
  };
  const merge = buildCalendarTaskMerge(
    [task],
    new Date(2026, 9, 10, 4).getTime(),
    new Date(2026, 9, 10, 6).getTime()
  );

  assert.deepEqual(merge.snapshot.map((entry) => entry.taskId), ['original-1', 'original-2']);
  assert.equal(merge.durationMinutes, 120);
});

test('expands one selected task to cover the union of its cells and the selection', () => {
  const task = {
    _id: 'task-a',
    title: 'A',
    startAt: new Date(2026, 9, 10, 3).toISOString(),
    estimatedMinutes: 180,
  };

  assert.deepEqual(
    getCalendarTaskMergeRange(task, new Date(2026, 9, 10), 4, 7),
    {
      startHour: 3,
      endHour: 7,
      startAt: new Date(2026, 9, 10, 3).toISOString(),
      dueAt: new Date(2026, 9, 10, 8).toISOString(),
      durationMinutes: 300,
    }
  );
});

test('classifies task drag intent by dominant axis', () => {
  assert.equal(getTaskDragIntent(3, 3), null);
  assert.equal(getTaskDragIntent(0, -20), 'select');
  assert.equal(getTaskDragIntent(0, 20), 'select');
  assert.equal(getTaskDragIntent(-20, 4), 'move');
  assert.equal(getTaskDragIntent(20, 4), 'move');
  assert.equal(getTaskDragIntent(8, 8), 'select');
});

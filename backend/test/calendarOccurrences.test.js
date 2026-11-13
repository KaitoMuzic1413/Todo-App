import test from 'node:test';
import assert from 'node:assert/strict';
import Task from '../src/models/Task.js';
import {
  getAdjacentCalendarOccurrences,
  getSingleUnmergedSchedule,
  replaceCalendarOccurrenceSegments,
} from '../src/utils/calendarOccurrences.js';

test('finds every adjacent occurrence of the same task on one local day', () => {
  const occurrences = [
    {
      occurrenceId: 'earlier',
      startAt: '2026-10-10T08:00:00.000Z',
      estimatedMinutes: 60,
    },
    {
      occurrenceId: 'selected',
      startAt: '2026-10-10T10:00:00.000Z',
      estimatedMinutes: 30,
    },
    {
      occurrenceId: 'middle',
      startAt: '2026-10-10T09:00:00.000Z',
      estimatedMinutes: 60,
    },
    {
      occurrenceId: 'gap',
      startAt: '2026-10-10T11:00:01.000Z',
      estimatedMinutes: 30,
    },
  ];

  assert.deepEqual(
    getAdjacentCalendarOccurrences(occurrences, 'selected', 'UTC')
      .map(({ occurrenceId }) => occurrenceId),
    ['earlier', 'middle', 'selected']
  );
});

test('merges overlapping occurrences in the same-day connected range', () => {
  const occurrences = [
    {
      occurrenceId: 'selected',
      startAt: '2026-10-10T09:00:00.000Z',
      estimatedMinutes: 120,
    },
    {
      occurrenceId: 'overlapping',
      startAt: '2026-10-10T10:00:00.000Z',
      estimatedMinutes: 120,
    },
  ];

  assert.deepEqual(
    getAdjacentCalendarOccurrences(occurrences, 'selected', 'UTC')
      .map(({ occurrenceId }) => occurrenceId),
    ['selected', 'overlapping']
  );
});

test('does not merge across a local day boundary or a time gap', () => {
  const occurrences = [
    {
      occurrenceId: 'selected',
      startAt: '2026-10-10T23:30:00.000Z',
      estimatedMinutes: 30,
    },
    {
      occurrenceId: 'next-day',
      startAt: '2026-10-11T00:00:00.000Z',
      estimatedMinutes: 30,
    },
    {
      occurrenceId: 'gap',
      startAt: '2026-10-10T22:59:00.000Z',
      estimatedMinutes: 30,
    },
  ];

  assert.deepEqual(getAdjacentCalendarOccurrences(occurrences, 'selected', 'UTC'), []);
});

test('unmerging repeated same-title occurrences keeps one event in the top cell', () => {
  const schedule = getSingleUnmergedSchedule({
    startAt: '2026-10-10T09:00:00.000Z',
    dueAt: '2026-10-10T11:00:00.000Z',
    mergedOccurrences: [
      { occurrenceId: 'primary', startAt: '2026-10-10T09:00:00.000Z' },
      { occurrenceId: 'second', startAt: '2026-10-10T10:00:00.000Z' },
    ],
  });

  assert.equal(schedule.startAt.toISOString(), '2026-10-10T09:00:00.000Z');
  assert.equal(schedule.dueAt.toISOString(), '2026-10-10T10:00:00.000Z');
  assert.equal(schedule.estimatedMinutes, 60);
  assert.equal(getSingleUnmergedSchedule({ startAt: null }), null);
});

test('splits a calendar task into two persisted schedules without merging them back', () => {
  const task = new Task({
    userId: '507f1f77bcf86cd799439011',
    title: 'A',
    startAt: new Date('2026-10-10T03:00:00.000Z'),
    dueAt: new Date('2026-10-10T08:00:00.000Z'),
    estimatedMinutes: 300,
  });
  const segments = [
    {
      startAt: new Date('2026-10-10T03:00:00.000Z'),
      dueAt: new Date('2026-10-10T05:00:00.000Z'),
      estimatedMinutes: 120,
    },
    {
      startAt: new Date('2026-10-10T07:00:00.000Z'),
      dueAt: new Date('2026-10-10T08:00:00.000Z'),
      estimatedMinutes: 60,
    },
  ];

  assert.equal(replaceCalendarOccurrenceSegments(task, 'primary', segments), true);
  assert.equal(task.startAt.toISOString(), segments[0].startAt.toISOString());
  assert.equal(task.dueAt.toISOString(), segments[0].dueAt.toISOString());
  assert.equal(task.calendarOccurrences.length, 1);
  assert.equal(task.calendarOccurrences[0].startAt.toISOString(), segments[1].startAt.toISOString());
  assert.equal(task.calendarOccurrences[0].dueAt.toISOString(), segments[1].dueAt.toISOString());
  assert.deepEqual(
    getAdjacentCalendarOccurrences([
      { ...task.toObject(), occurrenceId: 'primary' },
      ...task.calendarOccurrences.map((occurrence) => ({
        ...occurrence.toObject(),
        occurrenceId: String(occurrence._id),
      })),
    ], 'primary', 'UTC'),
    []
  );
});

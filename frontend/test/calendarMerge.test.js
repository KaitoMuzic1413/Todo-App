import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCellMergeSegments, restoreMergeMembers } from '../src/lib/calendarMerge.js';

const origin = '2026-11-13T09:00:00.000Z';
const minutes = (value) => new Date(origin).getTime() + value * 60_000;

const task = (id, title, offsetMinutes, durationMinutes) => ({
  _id: id,
  title,
  startAt: new Date(minutes(offsetMinutes)).toISOString(),
  estimatedMinutes: durationMinutes,
  dueAt: null,
});

test('creates separate AB, ABC and AC merge segments for changing cell membership', () => {
  const base = task('A', 'A', 0, 270);
  const segments = buildCellMergeSegments({
    baseTask: base,
    tasks: [
      base,
      task('B', 'B', 60, 60),
      task('C', 'C', 90, 60),
    ],
    startAt: origin,
    cellCount: 9,
    slotMinutes: 30,
  });

  assert.deepEqual(segments.map(({ memberIds, startCell, endCell }) => ({
    memberIds,
    startCell,
    endCell,
  })), [
    { memberIds: ['A', 'B'], startCell: 2, endCell: 3 },
    { memberIds: ['A', 'B', 'C'], startCell: 3, endCell: 4 },
    { memberIds: ['A', 'C'], startCell: 4, endCell: 5 },
  ]);
});

test('absorbs same-title tasks into the base task without creating a merge segment', () => {
  const base = task('A', '  Study  ', 0, 120);
  const sameTitle = task('A2', 'study', 30, 30);

  assert.deepEqual(buildCellMergeSegments({
    baseTask: base,
    tasks: [base, sameTitle],
    startAt: origin,
    cellCount: 4,
    slotMinutes: 30,
  }), []);
});

test('keeps different merge segments separate when membership changes', () => {
  const base = task('A', 'A', 0, 120);
  const segments = buildCellMergeSegments({
    baseTask: base,
    tasks: [base, task('B', 'B', 0, 30), task('C', 'C', 30, 30)],
    startAt: origin,
    cellCount: 4,
    slotMinutes: 30,
  });

  assert.deepEqual(segments.map(({ memberIds }) => memberIds), [['A', 'B'], ['A', 'C']]);
});

test('unmerge restores each original task identity and schedule snapshot', () => {
  const base = task('A', 'A', 0, 270);
  const other = task('B', 'B', 60, 60);
  const [segment] = buildCellMergeSegments({
    baseTask: base,
    tasks: [base, other],
    startAt: origin,
    cellCount: 9,
    slotMinutes: 30,
  });

  assert.deepEqual(restoreMergeMembers(segment), [
    {
      taskId: 'A',
      title: 'A',
      startAt: base.startAt,
      dueAt: null,
      estimatedMinutes: 270,
    },
    {
      taskId: 'B',
      title: 'B',
      startAt: other.startAt,
      dueAt: null,
      estimatedMinutes: 60,
    },
  ]);
});

test('rejects invalid grid dimensions and missing task identity', () => {
  assert.throws(() => buildCellMergeSegments({
    baseTask: task('', 'A', 0, 30),
    startAt: origin,
    cellCount: 1,
  }), /id/);
  assert.throws(() => buildCellMergeSegments({
    baseTask: task('A', 'A', 0, 30),
    startAt: origin,
    cellCount: 0,
  }), /cellCount/);
});

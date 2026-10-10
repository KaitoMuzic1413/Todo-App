import test from 'node:test';
import assert from 'node:assert/strict';
import Task from '../src/models/Task.js';
import { hasScheduleInput, validateTaskSchedule } from '../src/utils/taskSchedule.js';

test('legacy tasks remain valid without schedule fields', async () => {
  const task = new Task({ userId: '507f1f77bcf86cd799439011', title: 'Legacy task' });
  assert.equal(task.startAt, null);
  assert.equal(task.dueAt, null);
  assert.equal(task.estimatedMinutes, null);
  await task.validate();
});

test('accepts valid schedule fields and normalizes dates and duration', () => {
  const result = validateTaskSchedule({
    startAt: '2026-10-12T08:00:00.000Z',
    dueAt: '2026-10-12T10:00:00.000Z',
    estimatedMinutes: '120',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(result.updates.startAt.toISOString(), '2026-10-12T08:00:00.000Z');
  assert.equal(result.updates.dueAt.toISOString(), '2026-10-12T10:00:00.000Z');
  assert.equal(result.updates.estimatedMinutes, 120);
  assert.equal(result.updates.timeZone, 'Asia/Ho_Chi_Minh');
});

test('rejects invalid dates, durations, time zones, and reversed ranges', () => {
  assert.ok(validateTaskSchedule({ startAt: 'not-a-date' }).error);
  assert.ok(validateTaskSchedule({ estimatedMinutes: 0 }).error);
  assert.ok(validateTaskSchedule({ estimatedMinutes: 1.5 }).error);
  assert.ok(validateTaskSchedule({ timeZone: 'Mars/Olympus' }).error);
  assert.ok(validateTaskSchedule({ startAt: '2026-10-12T10:00:00Z', dueAt: '2026-10-12T08:00:00Z' }).error);
});

test('validates partial updates against already stored schedule values', () => {
  const result = validateTaskSchedule(
    { startAt: '2026-10-12T11:00:00Z' },
    { dueAt: new Date('2026-10-12T10:00:00Z') }
  );
  assert.match(result.error, /cannot be earlier/);
});

test('detects schedule fields without treating ordinary task creation as scheduled', () => {
  assert.equal(hasScheduleInput({ title: 'Task' }), false);
  assert.equal(hasScheduleInput({ title: 'Task', dueAt: null }), true);
});
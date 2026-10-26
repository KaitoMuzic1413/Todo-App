import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, getCalendarDays, getCalendarRange, getDayWarnings, groupTasksByCalendarDay } from '../src/lib/calendarUtils.js';

test('week calendar starts on Monday and spans seven local dates', () => {
  const days = getCalendarDays('week', new Date(2026, 9, 10, 15));
  assert.equal(days.length, 7);
  assert.equal(dateKey(days[0]), '2026-10-5');
  assert.equal(dateKey(days[6]), '2026-10-11');
});

test('month calendar returns a six-week grid containing every date in the month', () => {
  const days = getCalendarDays('month', new Date(2026, 9, 10));
  assert.equal(days.length, 42);
  assert.ok(days.some((date) => dateKey(date) === '2026-10-1'));
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
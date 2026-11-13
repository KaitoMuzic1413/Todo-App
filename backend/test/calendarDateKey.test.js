import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalendarDateKey } from '../src/utils/calendarDateKey.js';

test('normalizes calendar date keys to one canonical form', () => {
  assert.equal(normalizeCalendarDateKey('2026-09-05'), '2026-09-05');
  assert.equal(normalizeCalendarDateKey('2026-9-5'), '2026-09-05');
  assert.equal(normalizeCalendarDateKey(' 2026-9-05 '), '2026-09-05');
});

test('rejects invalid or non-existent calendar dates', () => {
  assert.equal(normalizeCalendarDateKey('2026-02-29'), null);
  assert.equal(normalizeCalendarDateKey('2026-13-01'), null);
  assert.equal(normalizeCalendarDateKey('2026-00-10'), null);
  assert.equal(normalizeCalendarDateKey('2026-10-00'), null);
  assert.equal(normalizeCalendarDateKey('2026-10-32'), null);
  assert.equal(normalizeCalendarDateKey('2026/10/10'), null);
  assert.equal(normalizeCalendarDateKey(''), null);
  assert.equal(normalizeCalendarDateKey(null), null);
});

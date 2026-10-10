import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyAnalyticsBuckets, getCompletionRate } from '../src/lib/analyticsUtils.js';

test('fills daily trend gaps with zero counts in the requested time zone', () => {
  const analytics = {
    range: { start: '2026-10-09T00:00:00.000Z', endExclusive: '2026-10-12T00:00:00.000Z' },
    trend: {
      created: [{ _id: '2026-10-09', count: 2 }],
      completed: [{ _id: '2026-10-11', count: 1 }],
    },
  };
  assert.deepEqual(buildDailyAnalyticsBuckets(analytics, 'UTC'), [
    { key: '2026-10-09', created: 2, completed: 0 },
    { key: '2026-10-10', created: 0, completed: 0 },
    { key: '2026-10-11', created: 0, completed: 1 },
  ]);
});

test('completion rate is zero for empty datasets and rounded for real totals', () => {
  assert.equal(getCompletionRate({ total: 0, completed: 0 }), 0);
  assert.equal(getCompletionRate({ total: 3, completed: 2 }), 67);
});

test('daily buckets follow the requested time-zone calendar dates', () => {
  const analytics = {
    range: { start: '2026-10-10T20:00:00.000Z', endExclusive: '2026-10-12T20:00:00.000Z' },
    trend: { created: [], completed: [] },
  };
  assert.deepEqual(buildDailyAnalyticsBuckets(analytics, 'Asia/Ho_Chi_Minh'), [
    { key: '2026-10-11', created: 0, completed: 0 },
    { key: '2026-10-12', created: 0, completed: 0 },
    { key: '2026-10-13', created: 0, completed: 0 },
  ]);
});
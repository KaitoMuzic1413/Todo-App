import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnalyticsRange } from '../src/utils/analyticsRange.js';

test('resolves supported rolling ranges and preserves IANA time zone', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  const result = resolveAnalyticsRange({ range: '7d', timeZone: 'Asia/Ho_Chi_Minh' }, now);
  assert.equal(result.start.toISOString(), '2026-10-03T12:00:00.000Z');
  assert.equal(result.endExclusive.getTime(), now.getTime() + 1);
  assert.equal(result.timeZone, 'Asia/Ho_Chi_Minh');
});

test('rejects unsupported ranges and invalid time zones', () => {
  assert.match(resolveAnalyticsRange({ range: '365d' }).error, /range must be/);
  assert.match(resolveAnalyticsRange({ range: '7d', timeZone: 'Moon/Tranquility' }).error, /timeZone must be/);
});
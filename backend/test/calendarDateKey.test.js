import test from 'node:test';
import assert from 'node:assert/strict';
import { getDateKeyAliases, normalizeDateKey } from '../src/utils/calendarDateKey.js';

test('normalizes valid date keys to zero-padded ISO format', () => {
  assert.equal(normalizeDateKey('2026-9-5'), '2026-09-05');
  assert.equal(normalizeDateKey('2026-09-05'), '2026-09-05');
});

test('rejects impossible dates and malformed keys', () => {
  assert.equal(normalizeDateKey('2026-2-30'), null);
  assert.equal(normalizeDateKey('2026-13-1'), null);
  assert.equal(normalizeDateKey('26-09-05'), null);
  assert.equal(normalizeDateKey('2026/09/05'), null);
});

test('returns all legacy zero-padding variants without duplicates', () => {
  assert.deepEqual(getDateKeyAliases('2026-09-05'), [
    '2026-9-5',
    '2026-9-05',
    '2026-09-5',
    '2026-09-05',
  ]);
});

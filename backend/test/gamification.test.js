import test from 'node:test';
import assert from 'node:assert/strict';
import GamificationEvent from '../src/models/GamificationEvent.js';
import { getAchievements, getActivityKeys, getBestStreak, getCurrentStreak, getGoalBonusEvents, getLevelProgress, getTaskCompletionIdempotencyKey } from '../src/utils/gamification.js';

test('activity date and Monday week key use the configured time zone', () => {
  const result = getActivityKeys(new Date('2026-10-11T18:00:00.000Z'), 'Asia/Ho_Chi_Minh');
  assert.deepEqual(result, { activityDate: '2026-10-12', weekStart: '2026-10-12' });
});

test('current streak counts from today or yesterday and stops at the first missing date', () => {
  assert.equal(getCurrentStreak(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10'), 3);
  assert.equal(getCurrentStreak(['2026-10-08', '2026-10-09'], '2026-10-10'), 2);
  assert.equal(getCurrentStreak(['2026-10-07', '2026-10-09'], '2026-10-10'), 1);
  assert.equal(getCurrentStreak([], '2026-10-10'), 0);
});

test('best streak derives the longest consecutive activity sequence', () => {
  assert.equal(getBestStreak(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06']), 3);
  assert.equal(getBestStreak([]), 0);
});

test('XP level progress advances at each hundred XP', () => {
  assert.deepEqual(getLevelProgress(0), { level: 1, currentLevelXp: 0, nextLevelXp: 100, progressPercent: 0 });
  assert.deepEqual(getLevelProgress(275), { level: 3, currentLevelXp: 75, nextLevelXp: 100, progressPercent: 75 });
});

test('achievement badges unlock from persisted completion and streak totals', () => {
  assert.deepEqual(getAchievements(10, 5).map(({ unlocked }) => unlocked), [true, true, true, false]);
});

test('daily and weekly goal bonuses unlock only at their actual thresholds', () => {
  assert.deepEqual(getGoalBonusEvents({ dailyCompletionCount: 2, weeklyCompletionCount: 14, activityDate: '2026-10-12', weekStart: '2026-10-12' }), []);
  assert.deepEqual(getGoalBonusEvents({ dailyCompletionCount: 3, weeklyCompletionCount: 15, activityDate: '2026-10-12', weekStart: '2026-10-12' }), [
    { eventType: 'dailyGoal', idempotencyKey: 'dailyGoal:2026-10-12', xp: 20, activityDate: '2026-10-12', weekStart: '2026-10-12' },
    { eventType: 'weeklyGoal', idempotencyKey: 'weeklyGoal:2026-10-12', xp: 50, activityDate: '2026-10-12', weekStart: '2026-10-12' },
  ]);
});

test('completion idempotency key is stable for the same task across reopening', () => {
  assert.equal(getTaskCompletionIdempotencyKey('task-123'), 'task:task-123:complete');
  assert.equal(getTaskCompletionIdempotencyKey('task-123'), getTaskCompletionIdempotencyKey('task-123'));
});

test('XP ledger enforces unique idempotency keys per user', () => {
  const uniqueLedgerIndex = GamificationEvent.schema.indexes().find(([keys, options]) => (
    keys.userId === 1 && keys.idempotencyKey === 1 && options.unique
  ));
  assert.ok(uniqueLedgerIndex);
});
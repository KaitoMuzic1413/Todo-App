import test from 'node:test';
import assert from 'node:assert/strict';
import FocusSession from '../src/models/FocusSession.js';
import { getElapsedSeconds, getRemainingSeconds } from '../src/utils/focusTimer.js';

test('focus session schema accepts a persisted running session', async () => {
  const session = new FocusSession({
    userId: '507f1f77bcf86cd799439011',
    activeUserId: '507f1f77bcf86cd799439011',
    mode: 'focus',
    status: 'running',
    durationSeconds: 1500,
    remainingSeconds: 1500,
    startedAt: new Date('2026-10-10T10:00:00.000Z'),
    segmentStartedAt: new Date('2026-10-10T10:00:00.000Z'),
    endsAt: new Date('2026-10-10T10:25:00.000Z'),
  });
  await session.validate();
  assert.equal(session.elapsedSeconds, 0);
  assert.equal(session.actualSeconds, 0);
});

test('focus session schema rejects invalid mode and duration', async () => {
  const session = new FocusSession({
    userId: '507f1f77bcf86cd799439011',
    mode: 'deep-work',
    durationSeconds: 30,
    remainingSeconds: 30,
    startedAt: new Date(),
  });
  await assert.rejects(session.validate(), (error) => (
    Boolean(error.errors.mode) && Boolean(error.errors.durationSeconds)
  ));
});

test('running timer derives elapsed and remaining from timestamps', () => {
  const now = new Date('2026-10-10T10:10:00.000Z');
  const session = {
    status: 'running',
    durationSeconds: 1500,
    elapsedSeconds: 120,
    segmentStartedAt: new Date('2026-10-10T10:05:00.000Z'),
    endsAt: new Date('2026-10-10T10:30:00.000Z'),
    remainingSeconds: 1500,
  };
  assert.equal(getElapsedSeconds(session, now), 420);
  assert.equal(getRemainingSeconds(session, now), 1200);
});

test('paused timer restores persisted remaining time without advancing', () => {
  const session = { status: 'paused', durationSeconds: 1500, elapsedSeconds: 600, remainingSeconds: 900 };
  assert.equal(getElapsedSeconds(session, new Date()), 600);
  assert.equal(getRemainingSeconds(session, new Date()), 900);
});

test('timer math clamps elapsed and remaining values at valid bounds', () => {
  const session = {
    status: 'running',
    durationSeconds: 120,
    elapsedSeconds: 200,
    segmentStartedAt: new Date('2026-10-10T10:00:00.000Z'),
    endsAt: new Date('2026-10-10T09:59:00.000Z'),
  };
  assert.equal(getElapsedSeconds(session, new Date('2026-10-10T11:00:00.000Z')), 120);
  assert.equal(getRemainingSeconds(session, new Date('2026-10-10T11:00:00.000Z')), 0);
});
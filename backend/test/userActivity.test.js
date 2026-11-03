import test from 'node:test';
import assert from 'node:assert/strict';
import { touchUserActivity } from '../src/utils/userActivity.js';

test('activity tracking only matches users whose activity timestamp is stale or notice is pending', async () => {
  const now = new Date('2026-11-03T12:00:00.000Z');
  let captured;
  const UserModel = {
    async updateOne(filter, update) {
      captured = { filter, update };
      return { acknowledged: true };
    },
  };

  await touchUserActivity(UserModel, 'user-123', now);

  assert.equal(captured.filter._id, 'user-123');
  assert.equal(captured.filter.$or[0].lastActiveAt.$lte.toISOString(), '2026-11-03T11:55:00.000Z');
  assert.deepEqual(captured.update.$set, {
    lastActiveAt: now,
    inactiveDeletionNoticeSentAt: null,
  });
});

test('activity tracking skips missing user ids', async () => {
  const UserModel = {
    async updateOne() {
      throw new Error('Should not query without a user id');
    },
  };

  assert.equal(await touchUserActivity(UserModel, null), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimTaskForDeletion,
  deleteTasksWithAttachmentsSafely,
  releaseTaskDeletionClaim,
  TASK_DELETION_CLAIM_LEASE_MS,
} from '../src/utils/taskCleanup.js';

test('claims only deleted tasks without a fresh cleanup claim', async () => {
  const now = new Date('2026-11-03T12:00:00.000Z');
  let captured;
  const TaskModel = {
    findOneAndUpdate(filter, update, options) {
      captured = { filter, update, options };
      return { select: async () => ({ _id: 'task-1', userId: 'user-1' }) };
    },
  };

  const claimed = await claimTaskForDeletion(TaskModel, {
    taskId: 'task-1',
    userId: 'user-1',
    now,
    deletedBefore: new Date('2026-10-01T00:00:00.000Z'),
  });

  assert.equal(captured.filter.isDeleted, true);
  assert.equal(captured.filter.deletedAt.$lte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(
    captured.filter.$or[1].cleanupClaimedAt.$lte.getTime(),
    now.getTime() - TASK_DELETION_CLAIM_LEASE_MS
  );
  assert.deepEqual(captured.update.$set, { cleanupClaimedAt: now });
  assert.equal(captured.options.new, true);
  assert.deepEqual(claimed, { _id: 'task-1', userId: 'user-1', cleanupClaimedAt: now });
});

test('releases only the matching task deletion claim', async () => {
  let captured;
  const TaskModel = {
    updateOne(filter, update) {
      captured = { filter, update };
      return Promise.resolve({ modifiedCount: 1 });
    },
  };
  const task = { _id: 'task-1', userId: 'user-1', cleanupClaimedAt: new Date() };

  await releaseTaskDeletionClaim(TaskModel, task);

  assert.deepEqual(captured.filter, {
    _id: task._id,
    userId: task.userId,
    cleanupClaimedAt: task.cleanupClaimedAt,
  });
  assert.deepEqual(captured.update.$set, { cleanupClaimedAt: null });
});

test('deletes attachments before the task and releases claim on failure', async () => {
  const order = [];
  const result = await deleteTasksWithAttachmentsSafely(
    [{ _id: 'task-1' }],
    {
      async deleteAttachments() { order.push('attachments'); },
      async deleteTask() { order.push('task'); return { deletedCount: 1 }; },
      async releaseTask() { order.push('release'); },
    }
  );

  assert.deepEqual(order, ['attachments', 'task']);
  assert.deepEqual(result, { deletedCount: 1, failures: [] });

  const failedOrder = [];
  const failed = await deleteTasksWithAttachmentsSafely(
    [{ _id: 'task-2' }],
    {
      async deleteAttachments() { failedOrder.push('attachments'); throw new Error('GridFS unavailable'); },
      async deleteTask() { failedOrder.push('task'); return { deletedCount: 1 }; },
      async releaseTask() { failedOrder.push('release'); },
    }
  );

  assert.deepEqual(failedOrder, ['attachments', 'release']);
  assert.equal(failed.deletedCount, 0);
  assert.equal(failed.failures[0].taskId, 'task-2');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteTasksWithAttachmentsSafely } from '../src/utils/taskCleanup.js';

test('deletes a task only after its linked attachments are deleted', async () => {
  const order = [];
  const result = await deleteTasksWithAttachmentsSafely(
    [{ _id: 'task-1' }],
    {
      async deleteAttachments() { order.push('attachments'); },
      async deleteTask() { order.push('task'); return { deletedCount: 1 }; },
    }
  );

  assert.deepEqual(order, ['attachments', 'task']);
  assert.deepEqual(result, { deletedCount: 1, failures: [] });
});

test('keeps a task when linked attachment deletion fails', async () => {
  let taskDeleteCalled = false;
  const result = await deleteTasksWithAttachmentsSafely(
    [{ _id: 'task-2' }],
    {
      async deleteAttachments() { throw new Error('GridFS unavailable'); },
      async deleteTask() { taskDeleteCalled = true; return { deletedCount: 1 }; },
    }
  );

  assert.equal(taskDeleteCalled, false);
  assert.equal(result.deletedCount, 0);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].taskId, 'task-2');
});

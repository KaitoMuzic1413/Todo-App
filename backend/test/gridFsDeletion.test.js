import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteGridFsFileIfExists, deleteGridFsFilesSafely } from '../src/utils/deleteGridFsFiles.js';

test('deletes files sequentially and reports only successful ids for metadata cleanup', async () => {
  const files = [
    { _id: 'metadata-1', fileId: 'file-1' },
    { _id: 'metadata-2', fileId: 'file-2' },
    { _id: 'metadata-3', fileId: 'file-3' },
  ];
  const attempted = [];
  const result = await deleteGridFsFilesSafely(files, async (fileId) => {
    attempted.push(fileId);
    if (fileId === 'file-2') throw new Error('GridFS unavailable');
  });

  assert.deepEqual(attempted, ['file-1', 'file-2', 'file-3']);
  assert.deepEqual(result.deletedIds, ['metadata-1', 'metadata-3']);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, 'metadata-2');
  assert.match(result.failures[0].error.message, /GridFS unavailable/);
});

test('returns empty results when there are no files to delete', async () => {
  const result = await deleteGridFsFilesSafely([], async () => {
    throw new Error('Should not be called');
  });

  assert.deepEqual(result, { deletedIds: [], failures: [] });
});

test('treats an already-missing GridFS file as an idempotent deletion', async () => {
  let deleteCalled = false;
  const bucket = {
    find() {
      return { async hasNext() { return false; } };
    },
    async delete() {
      deleteCalled = true;
    },
  };

  assert.equal(await deleteGridFsFileIfExists(bucket, 'missing-file'), false);
  assert.equal(deleteCalled, false);
});

test('deletes a GridFS file only after confirming its metadata exists', async () => {
  let deleteCalled = false;
  const bucket = {
    find(filter) {
      assert.deepEqual(filter, { _id: 'file-1' });
      return { async hasNext() { return true; } };
    },
    async delete(fileId) {
      assert.equal(fileId, 'file-1');
      deleteCalled = true;
    },
  };

  assert.equal(await deleteGridFsFileIfExists(bucket, 'file-1'), true);
  assert.equal(deleteCalled, true);
});

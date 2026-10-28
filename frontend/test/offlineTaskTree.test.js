import test from 'node:test';
import assert from 'node:assert/strict';
import { insertTaskTree, removeTaskTree, updateTaskTree } from '../src/lib/offlineTaskTree.js';

const baseTasks = () => ([
  { _id: 'parent-a', title: 'A', subtasks: [{ _id: 'child-a1', title: 'A1', status: 'active' }] },
  { _id: 'parent-b', title: 'B', subtasks: [] },
]);

test('inserts new top-level tasks first and replaces the same id', () => {
  const tasks = baseTasks();
  const next = insertTaskTree(tasks, { _id: 'parent-c', title: 'C', parentTaskId: null });
  assert.deepEqual(next.map((task) => task._id), ['parent-c', 'parent-a', 'parent-b']);
  assert.equal(tasks.length, 2);
});

test('inserts subtasks under their parent without duplicating them', () => {
  const next = insertTaskTree(baseTasks(), { _id: 'child-a2', parentTaskId: 'parent-a', title: 'A2' });
  assert.deepEqual(next[0].subtasks.map((task) => task._id), ['child-a1', 'child-a2']);
  assert.equal(next.length, 2);
});

test('updates tasks nested below the top level', () => {
  const next = updateTaskTree(baseTasks(), 'child-a1', (task) => ({ ...task, status: 'complete' }));
  assert.equal(next[0].subtasks[0].status, 'complete');
  assert.equal(baseTasks()[0].subtasks[0].status, 'active');
});

test('removes parent tasks with their children and child tasks independently', () => {
  assert.deepEqual(removeTaskTree(baseTasks(), 'parent-a').map((task) => task._id), ['parent-b']);
  assert.deepEqual(
    removeTaskTree(baseTasks(), 'child-a1')[0].subtasks,
    []
  );
});

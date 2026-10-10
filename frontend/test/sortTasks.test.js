import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTasks } from '../src/lib/sortTasks.js';

const sampleTasks = [
  { title: 'Zeta', createdAt: '2026-10-08T12:00:00.000Z', important: false },
  { title: 'Alpha', createdAt: '2026-10-10T12:00:00.000Z', important: true },
  { title: 'Beta', createdAt: '2026-10-09T12:00:00.000Z', important: false },
];

test('sorts recent tasks first by default without mutating input', () => {
  const sorted = sortTasks(sampleTasks);
  assert.deepEqual(sorted.map(({ title }) => title), ['Alpha', 'Beta', 'Zeta']);
  assert.equal(sampleTasks[0].title, 'Zeta');
});

test('sorts title and importance in the requested direction', () => {
  assert.deepEqual(sortTasks(sampleTasks, { sortBy: 'title', sortDirection: 'asc' }).map(({ title }) => title), ['Alpha', 'Beta', 'Zeta']);
  assert.deepEqual(sortTasks(sampleTasks, { sortBy: 'important', sortDirection: 'desc' }).map(({ title }) => title), ['Alpha', 'Zeta', 'Beta']);
});
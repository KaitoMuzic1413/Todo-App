import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import { validatePreferenceUpdates } from '../src/utils/userPreferences.js';

test('existing user documents receive personalization defaults', () => {
  const user = new User({ email: 'prefs@example.com', password: 'hashed-password' });
  assert.deepEqual(user.preferences.toObject(), {
    theme: 'dark',
    accent: 'violet',
    language: 'en',
    taskView: 'list',
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });
});

test('model rejects invalid preference enum values', async () => {
  const user = new User({ email: 'prefs@example.com', password: 'hashed-password' });
  user.preferences.taskView = 'carousel';
  await assert.rejects(user.validate(), (error) => Boolean(error.errors['preferences.taskView']));
});

test('accepts valid partial preference updates', () => {
  assert.deepEqual(
    validatePreferenceUpdates({ taskView: 'kanban', accent: 'emerald' }),
    { updates: { 'preferences.taskView': 'kanban', 'preferences.accent': 'emerald' } }
  );
});

test('rejects unsupported values', () => {
  assert.deepEqual(validatePreferenceUpdates({ theme: 'neon' }), {
    error: 'Invalid preference value for theme.',
  });
});

test('rejects unknown properties rather than allowing arbitrary user updates', () => {
  assert.deepEqual(validatePreferenceUpdates({ isAdmin: true }), {
    error: 'Invalid preference value for isAdmin.',
  });
});

test('rejects empty and non-object preference patches', () => {
  assert.match(validatePreferenceUpdates({}).error, /At least one preference/);
  assert.match(validatePreferenceUpdates(null).error, /must be an object/);
  assert.match(validatePreferenceUpdates([]).error, /must be an object/);
});
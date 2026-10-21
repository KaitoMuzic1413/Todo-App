import test from 'node:test';
import assert from 'node:assert/strict';
import Notification from '../src/models/Notification.js';
import NotificationRecipient from '../src/models/NotificationRecipient.js';
import { validateNotificationInput } from '../src/utils/notificationValidation.js';

test('notification model accepts supported in-app notification data', async () => {
  const notification = new Notification({
    title: '  Reminder  ',
    content: 'A task is due soon.',
    type: 'reminder',
    createdBy: '507f1f77bcf86cd799439011',
    targetType: 'all',
  });
  await notification.validate();
  assert.equal(notification.title, 'Reminder');
});

test('notification model requires a target for a single-user notification', async () => {
  const notification = new Notification({
    title: 'Private',
    content: 'Only for one account.',
    type: 'system',
    createdBy: '507f1f77bcf86cd799439011',
    targetType: 'user',
  });
  await assert.rejects(notification.validate(), (error) => Boolean(error.errors.targetId));
});

test('recipient read status is stored per user and defaults to unread', async () => {
  const recipient = new NotificationRecipient({
    notificationId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
  });
  await recipient.validate();
  assert.equal(recipient.isRead, false);
  assert.equal(recipient.readAt, null);
});

test('notification input normalizes title and one-user email', () => {
  assert.deepEqual(validateNotificationInput({
    title: '  Hello  ',
    content: 'Full message',
    type: 'system',
    audience: { type: 'user', email: ' PERSON@example.com ' },
  }), {
    value: {
      title: 'Hello',
      content: 'Full message',
      type: 'system',
      targetType: 'user',
      targetEmail: 'person@example.com',
    },
  });
});

test('notification input rejects unsupported types, long content, and unresolved audiences', () => {
  const base = { title: 'Hello', content: 'Message', type: 'system', audience: { type: 'all' } };
  assert.match(validateNotificationInput({ ...base, type: 'secret' }).error, /supported notification type/);
  assert.match(validateNotificationInput({ ...base, content: 'x'.repeat(5001) }).error, /5000/);
  assert.match(validateNotificationInput({ ...base, audience: { type: 'group' } }).error, /supported recipient audience/);
});

test('notification input requires a valid email for a single-user recipient', () => {
  const result = validateNotificationInput({
    title: 'Hello', content: 'Message', type: 'system', audience: { type: 'user', email: 'not-an-email' },
  });
  assert.match(result.error, /valid recipient email/);
});

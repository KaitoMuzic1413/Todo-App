import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { default: Notification } = await import('../src/models/Notification.js');
const { default: NotificationRecipient } = await import('../src/models/NotificationRecipient.js');
const { deleteAdminNotification } = await import('../src/controllers/notificationsController.js');
const { publishNotificationEvent, subscribeNotificationEvents } = await import('../src/utils/notificationEvents.js');

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test('deleting a sent notification removes every recipient copy', async (t) => {
  const notificationId = '507f1f77bcf86cd799439011';
  const userIds = ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'];

  t.mock.method(Notification, 'findById', () => ({
    select: () => ({
      lean: async () => ({ _id: notificationId }),
    }),
  }));
  t.mock.method(NotificationRecipient, 'find', () => ({
    distinct: async () => userIds,
  }));
  const deleteRecipients = t.mock.method(NotificationRecipient, 'deleteMany', async () => ({ deletedCount: userIds.length }));
  const deleteNotification = t.mock.method(Notification, 'deleteOne', async () => ({ deletedCount: 1 }));

  const res = createResponse();
  await deleteAdminNotification({ params: { id: notificationId } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { deleted: true });
  assert.deepEqual(deleteRecipients.mock.calls[0].arguments[0], { notificationId });
  assert.deepEqual(deleteNotification.mock.calls[0].arguments[0], { _id: notificationId });
});

test('notification events only reach subscribed users', () => {
  const writes = [];
  const response = { write: (chunk) => writes.push(chunk) };
  const unsubscribe = subscribeNotificationEvents('user-a', response);

  publishNotificationEvent(['user-a', 'user-b'], {
    type: 'notification-deleted',
    notificationId: 'notification-1',
  });

  assert.equal(writes.length, 1);
  assert.match(writes[0], /"type":"notification-deleted"/);
  assert.match(writes[0], /"notificationId":"notification-1"/);

  unsubscribe();

  publishNotificationEvent(['user-a'], {
    type: 'notification-deleted',
    notificationId: 'notification-2',
  });

  assert.equal(writes.length, 1);
});

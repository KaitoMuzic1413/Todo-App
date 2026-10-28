import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.OTP_SECRET = 'test-otp-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { default: RefreshToken } = await import('../src/models/RefreshToken.js');
const { default: User } = await import('../src/models/User.js');
const { logout, refreshSession } = await import('../src/controllers/authControllers.js');

const USER_ID = '507f1f77bcf86cd799439011';
const REFRESH_TOKEN = 'refresh-token-value';

const createResponse = () => ({
  statusCode: null,
  body: null,
  cookieCall: null,
  clearedCookie: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  cookie(name, value, options) {
    this.cookieCall = { name, value, options };
  },
  clearCookie(name, options) {
    this.clearedCookie = { name, options };
  },
});

const createRequest = () => ({
  headers: { cookie: `todo_refresh=${encodeURIComponent(REFRESH_TOKEN)}`, 'user-agent': 'test' },
  ip: '127.0.0.1',
  get(name) {
    return this.headers[name.toLowerCase()];
  },
});

test('logout revokes every refresh token and bumps the session version', async (t) => {
  const findOne = t.mock.method(RefreshToken, 'findOne', async () => ({ userId: USER_ID }));
  const deleteMany = t.mock.method(RefreshToken, 'deleteMany', async () => ({ deletedCount: 3 }));
  const updateOne = t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  const res = createResponse();

  await logout(createRequest(), res);

  assert.equal(findOne.mock.callCount(), 1);
  assert.equal(deleteMany.mock.callCount(), 1);
  assert.deepEqual(deleteMany.mock.calls[0].arguments[0], { userId: USER_ID });
  assert.equal(updateOne.mock.callCount(), 1);
  assert.deepEqual(updateOne.mock.calls[0].arguments[0], { _id: USER_ID });
  assert.deepEqual(updateOne.mock.calls[0].arguments[1], { $inc: { sessionVersion: 1 } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.clearedCookie.name, 'todo_refresh');
  assert.equal(res.clearedCookie.options.httpOnly, true);
});

test('refresh rejects an expired token and removes it', async (t) => {
  let deleted = false;
  t.mock.method(RefreshToken, 'findOne', async () => ({
    userId: USER_ID,
    expiresAt: new Date(Date.now() - 1000),
    deleteOne: async () => {
      deleted = true;
    },
  }));
  const res = createResponse();

  await refreshSession(createRequest(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(deleted, true);
  assert.equal(res.cookieCall, null);
  assert.equal(res.clearedCookie.name, 'todo_refresh');
});

test('refresh revokes all sessions when the token session version is stale', async (t) => {
  t.mock.method(RefreshToken, 'findOne', async () => ({
    userId: USER_ID,
    sessionVersion: 0,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  t.mock.method(User, 'findById', () => ({
    select: async () => ({ _id: USER_ID, sessionVersion: 1 }),
  }));
  const deleteMany = t.mock.method(RefreshToken, 'deleteMany', async () => ({ deletedCount: 2 }));
  const res = createResponse();

  await refreshSession(createRequest(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(deleteMany.mock.callCount(), 1);
  assert.deepEqual(deleteMany.mock.calls[0].arguments[0], { userId: USER_ID });
  assert.equal(res.clearedCookie.name, 'todo_refresh');
});

test('concurrent refresh requests reuse one atomically rotated successor token', async (t) => {
  const record = {
    _id: '507f1f77bcf86cd799439012',
    userId: USER_ID,
    sessionVersion: 0,
    expiresAt: new Date(Date.now() + 60_000),
    rotatedAt: null,
    replacementTokenEncrypted: null,
    replacementTokenExpiresAt: null,
  };
  t.mock.method(RefreshToken, 'findOne', async () => record);
  let rotationClaimed = false;
  t.mock.method(RefreshToken, 'findOneAndUpdate', async (_query, update) => {
    if (rotationClaimed) return null;
    rotationClaimed = true;
    Object.assign(record, update.$set);
    return record;
  });
  t.mock.method(RefreshToken, 'findById', async () => record);
  const insertedSessions = new Map();
  const upsert = t.mock.method(RefreshToken, 'updateOne', async (query, update) => {
    insertedSessions.set(query.tokenHash, update.$setOnInsert);
    return { upsertedCount: 1 };
  });
  t.mock.method(User, 'findById', () => ({
    select: async () => ({
      _id: USER_ID,
      email: 'user@example.com',
      name: 'Test User',
      isAdmin: false,
      sessionVersion: 0,
    }),
  }));
  const firstResponse = createResponse();
  const secondResponse = createResponse();

  await Promise.all([
    refreshSession(createRequest(), firstResponse),
    refreshSession(createRequest(), secondResponse),
  ]);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.ok(record.rotatedAt instanceof Date);
  assert.ok(record.expiresAt.getTime() <= Date.now() + 61_000);
  assert.ok(record.replacementTokenEncrypted);
  assert.equal(typeof firstResponse.body.token, 'string');
  assert.equal(firstResponse.body.user.email, 'user@example.com');
  assert.equal(firstResponse.cookieCall.name, 'todo_refresh');
  assert.equal(firstResponse.cookieCall.options.httpOnly, true);
  assert.equal(secondResponse.cookieCall.value, firstResponse.cookieCall.value);
  assert.equal(insertedSessions.size, 1);
  assert.equal(upsert.mock.callCount(), 2);
});

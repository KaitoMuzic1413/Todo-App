import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'test';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.OTP_SECRET = 'test-otp-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';
for (const key of ['EMAIL_PROVIDER', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM']) {
  delete process.env[key];
}

const { default: User } = await import('../src/models/User.js');
const { default: RefreshToken } = await import('../src/models/RefreshToken.js');
const { default: Notification } = await import('../src/models/Notification.js');
const { default: NotificationRecipient } = await import('../src/models/NotificationRecipient.js');
const { env } = await import('../src/config/env.js');
const { login, register } = await import('../src/controllers/authControllers.js');

const users = new Map();
let nextUserId = 0;

const createUserDocument = (input) => {
  nextUserId += 1;
  const user = {
    _id: `507f1f77bcf86cd79943${String(nextUserId).padStart(4, '0')}`,
    name: '',
    avatarUrl: '',
    isAdmin: false,
    emailVerified: true,
    sessionVersion: 0,
    lastActiveAt: null,
    inactiveDeletionNoticeSentAt: null,
    ...input,
  };
  user.save = async () => {
    users.set(user.email, user);
    return user;
  };
  return user;
};

const emptyNotificationQuery = () => ({
  sort: () => ({
    select: () => ({
      lean: async () => null,
    }),
  }),
});

const installModelMocks = (t, { onboardingFails = false } = {}) => {
  users.clear();
  t.mock.method(User, 'findOne', async ({ email }) => users.get(email) || null);
  t.mock.method(User, 'create', async (input) => {
    const user = createUserDocument(input);
    users.set(user.email, user);
    return user;
  });
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(RefreshToken, 'create', async () => ({}));
  t.mock.method(Notification, 'findOne', () => {
    if (onboardingFails) throw new Error('notification store unavailable');
    return emptyNotificationQuery();
  });
  t.mock.method(NotificationRecipient, 'bulkWrite', async () => ({}));
};

const createResponse = () => ({
  statusCode: null,
  body: null,
  cookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  },
  clearCookie() {
    return this;
  },
});

const createRequest = (body) => ({
  body,
  ip: '127.0.0.1',
  get: () => 'node-test',
});

test('register then login succeeds with normalized email and a hashed password', async (t) => {
  installModelMocks(t);
  const password = 'Password123';

  const registerResponse = createResponse();
  await register(createRequest({
    email: '  Mixed.Case@Example.com ',
    password,
    name: '  Mixed User  ',
  }), registerResponse);

  assert.equal(registerResponse.statusCode, 201);
  assert.equal(registerResponse.body.verificationRequired, false);
  assert.equal(registerResponse.body.message, 'Account created successfully.');

  const stored = users.get('mixed.case@example.com');
  assert.ok(stored, 'user should be stored under the normalized email');
  assert.notEqual(stored.password, password);
  assert.equal(await bcrypt.compare(password, stored.password), true);

  const loginResponse = createResponse();
  await login(createRequest({
    email: 'MIXED.CASE@EXAMPLE.COM',
    password,
  }), loginResponse);

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(typeof loginResponse.body.token, 'string');
  assert.ok(loginResponse.body.token.length > 0);
  assert.equal(loginResponse.body.user.email, 'mixed.case@example.com');
  assert.equal('password' in loginResponse.body.user, false);
  assert.equal(loginResponse.cookies.length, 1);
  assert.equal(loginResponse.cookies[0].name, 'todo_refresh');
});

test('wrong password and unknown account return the same 401 payload', async (t) => {
  installModelMocks(t);
  const password = 'Password123';

  await register(createRequest({ email: 'user@example.com', password }), createResponse());

  const wrongPasswordResponse = createResponse();
  await login(createRequest({ email: 'USER@example.com', password: 'WrongPass123' }), wrongPasswordResponse);

  const unknownAccountResponse = createResponse();
  await login(createRequest({ email: 'missing@example.com', password }), unknownAccountResponse);

  assert.equal(wrongPasswordResponse.statusCode, 401);
  assert.equal(unknownAccountResponse.statusCode, 401);
  assert.deepEqual(wrongPasswordResponse.body, {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
  });
  assert.deepEqual(unknownAccountResponse.body, wrongPasswordResponse.body);
});

test('registering an existing account does not overwrite the stored password', async (t) => {
  installModelMocks(t);
  const originalPassword = 'Password123';

  const firstRegister = createResponse();
  await register(createRequest({ email: 'old@example.com', password: originalPassword }), firstRegister);
  assert.equal(firstRegister.statusCode, 201);

  const duplicateRegister = createResponse();
  await register(createRequest({ email: ' OLD@example.com ', password: 'Different123' }), duplicateRegister);
  assert.equal(duplicateRegister.statusCode, 409);
  assert.equal(duplicateRegister.body.exists, true);

  const loginResponse = createResponse();
  await login(createRequest({ email: 'old@example.com', password: originalPassword }), loginResponse);
  assert.equal(loginResponse.statusCode, 200);

  const changedPasswordResponse = createResponse();
  await login(createRequest({ email: 'old@example.com', password: 'Different123' }), changedPasswordResponse);
  assert.equal(changedPasswordResponse.statusCode, 401);
});

test('registration still succeeds when onboarding notifications fail', async (t) => {
  installModelMocks(t, { onboardingFails: true });

  const response = createResponse();
  await register(createRequest({ email: 'onboarding@example.com', password: 'Password123' }), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.message, 'Account created successfully.');
  assert.ok(users.has('onboarding@example.com'));
});

test('registration stays successful when the verification email cannot be sent', async (t) => {
  installModelMocks(t);
  const previousVerificationSetting = env.emailVerificationRequired;
  env.emailVerificationRequired = true;

  try {
    const password = 'Password123';
    const response = createResponse();
    await register(createRequest({ email: 'pending@example.com', password }), response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.verificationRequired, true);

    const stored = users.get('pending@example.com');
    assert.ok(stored);
    assert.equal(stored.emailVerified, false);
    assert.equal(typeof stored.emailVerificationTokenHash, 'string');
    assert.equal(await bcrypt.compare(password, stored.password), true);

    const loginResponse = createResponse();
    await login(createRequest({ email: 'pending@example.com', password }), loginResponse);
    assert.equal(loginResponse.statusCode, 403);
    assert.equal(loginResponse.body.code, 'EMAIL_NOT_VERIFIED');
  } finally {
    env.emailVerificationRequired = previousVerificationSetting;
  }
});

test('register rejects invalid email and password shapes without writing a user', async (t) => {
  installModelMocks(t);

  const invalidEmail = createResponse();
  await register(createRequest({ email: 'not-an-email', password: 'Password123' }), invalidEmail);
  assert.equal(invalidEmail.statusCode, 400);

  const weakPassword = createResponse();
  await register(createRequest({ email: 'user@example.com', password: 'short' }), weakPassword);
  assert.equal(weakPassword.statusCode, 400);

  const missingPassword = createResponse();
  await register(createRequest({ email: 'user@example.com' }), missingPassword);
  assert.equal(missingPassword.statusCode, 400);

  assert.equal(users.size, 0);
});

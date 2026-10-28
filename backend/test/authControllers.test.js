import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.OTP_SECRET = 'test-otp-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { default: User } = await import('../src/models/User.js');
const { forgotPassword, login, register, resetPassword, verifyResetOtp } = await import('../src/controllers/authControllers.js');

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

test('auth endpoints reject malformed body shapes and email types with 400 responses', async () => {
  const cases = [
    [register, null],
    [register, { email: ['user@example.com'], password: 'Password123' }],
    [login, { email: { value: 'user@example.com' }, password: 'Password123' }],
    [forgotPassword, { email: ['user@example.com'] }],
    [verifyResetOtp, null],
    [resetPassword, 'not-an-object'],
  ];

  for (const [handler, body] of cases) {
    const response = createResponse();
    await handler({ body }, response);
    assert.equal(response.statusCode, 400);
  }
});

test('forgot password returns the same response when the mail provider rejects delivery', async (t) => {
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    resetPasswordOtpHash: null,
    resetPasswordOtpExpires: null,
    resetPasswordOtpAttempts: 0,
    resetPasswordOtpRequestedAt: null,
    async save() {},
  };
  t.mock.method(User, 'findOne', async () => user);
  const updateOne = t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 503,
    async text() { return 'provider unavailable'; },
  }));
  process.env.EMAIL_PROVIDER = 'sendgrid';
  process.env.SENDGRID_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'noreply@example.com';

  const response = createResponse();
  await forgotPassword({ body: { email: ' USER@example.com ' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'If an account exists for that email, a reset code will be sent shortly.');
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(updateOne.mock.callCount(), 1);
  assert.deepEqual(updateOne.mock.calls[0].arguments[0], {
    _id: user._id,
    resetPasswordOtpHash: user.resetPasswordOtpHash,
  });
  assert.deepEqual(updateOne.mock.calls[0].arguments[1], {
    $unset: { resetPasswordOtpHash: 1, resetPasswordOtpExpires: 1 },
    $set: { resetPasswordOtpAttempts: 0 },
  });
  assert.ok(user.resetPasswordOtpRequestedAt instanceof Date);
});

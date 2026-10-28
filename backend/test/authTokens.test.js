import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.OTP_SECRET = 'test-otp-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';

const {
  createAccessToken,
  createRefreshTokenValue,
  decryptRefreshToken,
  encryptRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} = await import('../src/utils/authTokens.js');
const { default: verifyToken } = await import('../src/middleware/authMiddleware.js');
const { requireTrustedOrigin } = await import('../src/middleware/requestGuards.js');

const fakeResponse = () => ({
  statusCode: null,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
});

test('access tokens carry the user, session version, and access type', () => {
  const token = createAccessToken({ _id: '507f1f77bcf86cd799439011', sessionVersion: 4 });
  const decoded = verifyAccessToken(token);

  assert.equal(decoded.userId, '507f1f77bcf86cd799439011');
  assert.equal(decoded.sessionVersion, 4);
  assert.equal(decoded.type, 'access');
});

test('expired access tokens are rejected', () => {
  const expired = jwt.sign(
    { userId: '507f1f77bcf86cd799439011', sessionVersion: 0, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );

  assert.throws(() => verifyAccessToken(expired), /expired/i);
});

test('legacy tokens without the access type are rejected before any user lookup', async () => {
  const legacy = jwt.sign(
    { userId: '507f1f77bcf86cd799439011', sessionVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const req = { headers: { authorization: `Bearer ${legacy}` } };
  const res = fakeResponse();
  let nextCalled = false;

  await verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Token invalid or expired!');
});

test('cookie-auth requests require the application header and an allowed origin', () => {
  const request = (headers) => {
    const req = {
      headers,
      get(name) {
        return headers[name.toLowerCase()];
      },
    };
    const res = fakeResponse();
    let nextCalled = false;
    requireTrustedOrigin(req, res, () => {
      nextCalled = true;
    });
    return { res, nextCalled };
  };

  const missingHeader = request({ origin: 'http://localhost:5173' });
  assert.equal(missingHeader.nextCalled, false);
  assert.equal(missingHeader.res.statusCode, 403);

  const disallowedOrigin = request({
    'x-requested-with': 'XMLHttpRequest',
    origin: 'https://evil.example.com',
  });
  assert.equal(disallowedOrigin.nextCalled, false);
  assert.equal(disallowedOrigin.res.statusCode, 403);

  const allowed = request({
    'x-requested-with': 'XMLHttpRequest',
    origin: 'http://localhost:5173',
  });
  assert.equal(allowed.nextCalled, true);

  const native = request({ 'x-requested-with': 'XMLHttpRequest' });
  assert.equal(native.nextCalled, true);
});

test('refresh tokens are unpredictable and stored only as hashes', () => {
  const first = createRefreshTokenValue();
  const second = createRefreshTokenValue();
  const firstHash = hashRefreshToken(first);

  assert.notEqual(first, second);
  assert.ok(first.length >= 60);
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.notEqual(firstHash, first);
  assert.equal(hashRefreshToken(first), firstHash);
});

test('rotated refresh tokens are encrypted and authenticated at rest', () => {
  const refreshToken = createRefreshTokenValue();
  const encrypted = encryptRefreshToken(refreshToken);
  const [iv, authTag, ciphertext] = encrypted.split('.');
  const alteredIv = `${iv[0] === 'a' ? 'b' : 'a'}${iv.slice(1)}`;

  assert.notEqual(encrypted, refreshToken);
  assert.equal(decryptRefreshToken(encrypted), refreshToken);
  assert.throws(() => decryptRefreshToken(`${alteredIv}.${authTag}.${ciphertext}`));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.MONGODB_CONNECTIONSTRING = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.OTP_SECRET = 'test-otp-secret-0123456789abcdef';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { default: app } = await import('../src/server.js');
const { isAllowedOrigin } = await import('../src/config/env.js');

test('development allows private LAN frontend origins on the Vite port', () => {
  assert.equal(isAllowedOrigin('http://10.10.1.118:5173'), true);
  assert.equal(isAllowedOrigin('http://192.168.1.20:5173'), true);
  assert.equal(isAllowedOrigin('http://172.20.0.5:5173'), true);
  assert.equal(isAllowedOrigin('http://10.10.1.118:5001'), false);
  assert.equal(isAllowedOrigin('http://8.8.8.8:5173'), false);
});

test('CORS preflight completes before database and route authentication middleware', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const { port } = server.address();
  const origin = 'http://localhost:5174';
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,x-requested-with',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/i);
  assert.match(response.headers.get('access-control-allow-headers'), /X-Requested-With/i);
});

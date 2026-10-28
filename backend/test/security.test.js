import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { validateFileSignature } from '../src/utils/fileValidation.js';
import { createRateLimiter } from '../src/middleware/rateLimit.js';

const envModuleUrl = new URL('../src/config/env.js', import.meta.url).href;
const requiredEnvKeys = ['JWT_SECRET', 'OTP_SECRET', 'MONGODB_CONNECTIONSTRING', 'FRONTEND_URL'];

const baseEnv = () => {
  const env = { ...process.env };
  for (const key of requiredEnvKeys) delete env[key];
  return env;
};

test('file validation rejects HTML disguised as plain text', () => {
  const result = validateFileSignature({
    buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
    mimeType: 'text/plain',
  });
  assert.equal(result.valid, false);
});

test('file validation rejects content that does not match the declared type', () => {
  const result = validateFileSignature({
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    mimeType: 'image/png',
  });
  assert.equal(result.valid, false);
});

test('file validation rejects SVG uploads even when declared as SVG', () => {
  const result = validateFileSignature({
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    mimeType: 'image/svg+xml',
  });
  assert.equal(result.valid, false);
});

test('file validation accepts files with a matching signature', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  const result = validateFileSignature({ buffer: png, mimeType: 'image/png' });
  assert.equal(result.valid, true);
});

test('environment validation fails fast when required secrets are missing', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}')`],
    { cwd: os.tmpdir(), env: baseEnv(), encoding: 'utf8' }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required environment variable/);
});

test('rate limiter returns 429 after the configured threshold', () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: 2,
    keyGenerator: () => 'test-key',
  });

  const run = () => {
    const response = {
      statusCode: 200,
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
    };
    let nextCalled = false;
    limiter({ ip: '127.0.0.1' }, response, () => {
      nextCalled = true;
    });
    return { response, nextCalled };
  };

  assert.equal(run().nextCalled, true);
  assert.equal(run().nextCalled, true);

  const limited = run();
  assert.equal(limited.nextCalled, false);
  assert.equal(limited.response.statusCode, 429);
  assert.match(limited.response.body.message, /Too many/);
  assert.equal(limited.response.headers['Retry-After'] > 0, true);
});

test('CORS allowlist includes the app origin but never the opaque null origin', () => {
  const script = `import('${envModuleUrl}').then(({ allowedOrigins }) => {
    if (allowedOrigins.has('null')) process.exit(3);
    if (!allowedOrigins.has('https://app.example.com')) process.exit(4);
    if (!allowedOrigins.has('capacitor://localhost')) process.exit(5);
  })`;

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: os.tmpdir(),
      env: {
        ...baseEnv(),
        NODE_ENV: 'development',
        MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
        FRONTEND_URL: 'https://app.example.com',
        CORS_ORIGINS: 'capacitor://localhost,tauri://localhost',
        JWT_SECRET: 'a'.repeat(40),
        OTP_SECRET: 'b'.repeat(40),
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
});

test('development CORS accepts localhost dev-server ports but production stays restricted', () => {
  const script = `import('${envModuleUrl}').then(({ isAllowedOrigin }) => {
    if (!isAllowedOrigin('http://localhost:5174')) process.exit(3);
    if (!isAllowedOrigin('http://127.0.0.1:3000')) process.exit(4);
    if (isAllowedOrigin('http://localhost.example.com:5174')) process.exit(5);
  })`;
  const development = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: os.tmpdir(),
    env: {
      ...baseEnv(),
      NODE_ENV: 'development',
      MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
      FRONTEND_URL: 'http://localhost:5173',
      JWT_SECRET: 'a'.repeat(40),
      OTP_SECRET: 'b'.repeat(40),
    },
    encoding: 'utf8',
  });
  assert.equal(development.status, 0, development.stderr);

  const production = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}').then(({ isAllowedOrigin }) => { if (isAllowedOrigin('http://localhost:5174')) process.exit(6); })`],
    {
      cwd: os.tmpdir(),
      env: {
        ...baseEnv(),
        NODE_ENV: 'production',
        MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
        FRONTEND_URL: 'https://app.example.com',
        JWT_SECRET: 'a'.repeat(40),
        OTP_SECRET: 'b'.repeat(40),
      },
      encoding: 'utf8',
    }
  );
  assert.equal(production.status, 0, production.stderr);
});

test('environment validation rejects short secrets and accepts strong ones', () => {
  const weak = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}')`],
    {
      cwd: os.tmpdir(),
      env: {
        ...baseEnv(),
        MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
        FRONTEND_URL: 'http://localhost:5173',
        JWT_SECRET: 'too-short',
        OTP_SECRET: 'also-too-short',
      },
      encoding: 'utf8',
    }
  );
  assert.notEqual(weak.status, 0);
  assert.match(weak.stderr, /at least 32 characters/);

  const strong = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}').then(({ env }) => { if (env.jwtSecret.length < 32) process.exit(2); })`],
    {
      cwd: os.tmpdir(),
      env: {
        ...baseEnv(),
        MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
        FRONTEND_URL: 'http://localhost:5173',
        JWT_SECRET: 'a'.repeat(40),
        OTP_SECRET: 'b'.repeat(40),
      },
      encoding: 'utf8',
    }
  );
  assert.equal(strong.status, 0);
});

test('production environment rejects insecure frontend origins', () => {
  const base = {
    ...baseEnv(),
    NODE_ENV: 'production',
    MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
    JWT_SECRET: 'a'.repeat(40),
    OTP_SECRET: 'b'.repeat(40),
  };
  const insecure = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}')`],
    { cwd: os.tmpdir(), env: { ...base, FRONTEND_URL: 'http://app.example.com' }, encoding: 'utf8' }
  );
  assert.notEqual(insecure.status, 0);
  assert.match(insecure.stderr, /must use HTTPS in production/);

  const secure = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}')`],
    { cwd: os.tmpdir(), env: { ...base, FRONTEND_URL: 'https://app.example.com' }, encoding: 'utf8' }
  );
  assert.equal(secure.status, 0, secure.stderr);
});

test('email verification is only enabled when an email provider is configured', () => {
  const base = {
    ...baseEnv(),
    NODE_ENV: 'production',
    MONGODB_CONNECTIONSTRING: 'mongodb://127.0.0.1:27017/test',
    FRONTEND_URL: 'https://app.example.com',
    JWT_SECRET: 'a'.repeat(40),
    OTP_SECRET: 'b'.repeat(40),
    EMAIL_VERIFICATION_REQUIRED: 'true',
  };
  for (const key of ['EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_USER', 'EMAIL_PASS', 'SENDGRID_API_KEY', 'RESEND_API_KEY']) {
    delete base[key];
  }

  const readFlag = (env) => spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${envModuleUrl}').then(({ env }) => console.log(env.emailVerificationRequired))`],
    { cwd: os.tmpdir(), env, encoding: 'utf8' }
  );

  const withoutProvider = readFlag(base);
  assert.equal(withoutProvider.status, 0, withoutProvider.stderr);
  assert.equal(withoutProvider.stdout.trim(), 'false');

  const withProvider = readFlag({
    ...base,
    EMAIL_PROVIDER: 'sendgrid',
    EMAIL_FROM: 'noreply@example.com',
    SENDGRID_API_KEY: 'test-key',
  });
  assert.equal(withProvider.status, 0, withProvider.stderr);
  assert.equal(withProvider.stdout.trim(), 'true');
});

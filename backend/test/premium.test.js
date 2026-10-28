import test from 'node:test';
import assert from 'node:assert/strict';
import InviteCode from '../src/models/InviteCode.js';
import PushSubscription from '../src/models/PushSubscription.js';
import {
  FREE_ATTACHMENT_LIMIT,
  FREE_TASK_LIMIT,
  PREMIUM_ATTACHMENT_LIMIT,
  PREMIUM_TASK_LIMIT,
  getPremiumUntil,
  getQuotaLimits,
  isPremiumActive,
} from '../src/utils/premium.js';

test('premium status requires an active flag and a future expiry', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(isPremiumActive({ premium: { isPremium: true, expiresAt: '2026-02-01T00:00:00.000Z' } }, now), true);
  assert.equal(isPremiumActive({ premium: { isPremium: true, expiresAt: '2025-12-01T00:00:00.000Z' } }, now), false);
  assert.equal(isPremiumActive({ premium: { isPremium: false, expiresAt: '2026-02-01T00:00:00.000Z' } }, now), false);
  assert.equal(isPremiumActive({ premium: { isPremium: true, expiresAt: null } }, now), true);
});

test('the later of expiry and legacy unlimited access is used', () => {
  const premium = {
    expiresAt: '2026-02-01T00:00:00.000Z',
    unlimitedUntil: '2026-03-01T00:00:00.000Z',
  };
  assert.equal(getPremiumUntil({ premium }).toISOString(), '2026-03-01T00:00:00.000Z');
});

test('quota limits switch between free and premium plans', () => {
  assert.deepEqual(getQuotaLimits(false), { tasks: FREE_TASK_LIMIT, attachments: FREE_ATTACHMENT_LIMIT });
  assert.deepEqual(getQuotaLimits(true), { tasks: PREMIUM_TASK_LIMIT, attachments: PREMIUM_ATTACHMENT_LIMIT });
  assert.ok(PREMIUM_TASK_LIMIT > FREE_TASK_LIMIT);
  assert.ok(PREMIUM_ATTACHMENT_LIMIT > FREE_ATTACHMENT_LIMIT);
});

test('invite codes normalize casing and use safe defaults', async () => {
  const invite = new InviteCode({
    code: '  kaito-test  ',
    createdBy: '507f1f77bcf86cd799439011',
  });
  await invite.validate();
  assert.equal(invite.code, 'KAITO-TEST');
  assert.equal(invite.planDays, 30);
  assert.equal(invite.maxUses, 1);
  assert.equal(invite.usedCount, 0);
  assert.equal(invite.isActive, true);
});

test('push subscriptions require HTTPS endpoint fields and encryption keys', async () => {
  const subscription = new PushSubscription({
    userId: '507f1f77bcf86cd799439012',
    endpoint: 'https://push.example.com/subscription',
    keys: { p256dh: 'public-key', auth: 'auth-secret' },
  });
  await subscription.validate();
  assert.equal(subscription.failureCount, 0);

  const invalid = new PushSubscription({ userId: '507f1f77bcf86cd799439012' });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors.endpoint || error.errors['keys.p256dh']));
});

import webpush from 'web-push';
import { env } from '../config/env.js';
import PushSubscription from '../models/PushSubscription.js';

let configured = false;

if (env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

export const isWebPushConfigured = () => configured;

export const getVapidPublicKey = () => (configured ? env.vapidPublicKey : '');

const removeExpiredSubscription = async (subscriptionId) => {
  await PushSubscription.deleteOne({ _id: subscriptionId }).catch(() => {});
};

export const sendPushToUser = async (userId, { title, body, url = '/home', tag, data = {} }) => {
  if (!configured) return 0;

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (!subscriptions.length) return 0;

  const payload = JSON.stringify({
    title: String(title || 'Kaito Todo').slice(0, 120),
    body: String(body || '').slice(0, 500),
    url,
    tag: tag || `kaito-${Date.now()}`,
    data,
  });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, payload, { TTL: 3600, urgency: 'high' });
      await PushSubscription.updateOne(
        { _id: subscription._id },
        { $set: { lastSuccessAt: new Date(), failureCount: 0 } }
      );
      return true;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await removeExpiredSubscription(subscription._id);
        return false;
      }
      await PushSubscription.updateOne(
        { _id: subscription._id },
        { $inc: { failureCount: 1 } }
      ).catch(() => {});
      console.error(`Web push delivery failed with status ${error?.statusCode || 'unknown'}.`);
      return false;
    }
  }));

  return results.filter((result) => result.status === 'fulfilled' && result.value).length;
};

export const sendPushToUsers = async (userIds, payload) => {
  if (!configured || !userIds.length) return 0;
  let delivered = 0;
  for (let index = 0; index < userIds.length; index += 25) {
    const batch = userIds.slice(index, index + 25);
    const counts = await Promise.all(batch.map((userId) => sendPushToUser(userId, payload)));
    delivered += counts.reduce((total, count) => total + count, 0);
  }
  return delivered;
};

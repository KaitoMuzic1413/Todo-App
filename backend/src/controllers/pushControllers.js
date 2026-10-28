import PushSubscription from '../models/PushSubscription.js';
import { getVapidPublicKey, isWebPushConfigured } from '../utils/webPush.js';

const parseSubscription = (body) => {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';

  if (!endpoint || !p256dh || !auth) return null;

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (endpoint.length > 2048 || p256dh.length > 256 || auth.length > 128) return null;

  return { endpoint, keys: { p256dh, auth } };
};

export const getPushConfig = (req, res) => {
  res.status(200).json({
    enabled: isWebPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
};

export const subscribeToPush = async (req, res) => {
  if (!isWebPushConfigured()) {
    return res.status(503).json({ message: 'Push notifications are not configured.' });
  }

  const subscription = parseSubscription(req.body);
  if (!subscription) {
    return res.status(400).json({ message: 'A valid HTTPS push subscription is required.' });
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: req.user.userId,
          keys: subscription.keys,
          userAgent: String(req.get('user-agent') || '').slice(0, 512),
          failureCount: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ subscribed: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    return res.status(500).json({ message: 'Unable to save push subscription.' });
  }
};

export const unsubscribeFromPush = async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
  if (!endpoint) return res.status(400).json({ message: 'A push endpoint is required.' });

  try {
    await PushSubscription.deleteOne({ endpoint, userId: req.user.userId });
    return res.status(200).json({ subscribed: false });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return res.status(500).json({ message: 'Unable to remove push subscription.' });
  }
};

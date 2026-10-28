import { fetchPushConfig, removePushSubscription, savePushSubscription } from './api';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

export const isPushSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
);

const getRegistration = async () => {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.ready;
};

export const getPushState = async () => {
  if (!isPushSupported()) {
    return { supported: false, configured: false, permission: 'unsupported', subscribed: false };
  }

  let configured;
  try {
    const { data } = await fetchPushConfig();
    configured = Boolean(data?.enabled && data?.publicKey);
  } catch {
    configured = false;
  }

  let subscribed;
  try {
    const registration = await getRegistration();
    subscribed = Boolean(await registration?.pushManager.getSubscription());
  } catch {
    subscribed = false;
  }

  return {
    supported: true,
    configured,
    permission: Notification.permission,
    subscribed,
  };
};

export const enablePushNotifications = async () => {
  if (!isPushSupported()) throw new Error('PUSH_UNSUPPORTED');

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('PUSH_PERMISSION_DENIED');

  const { data } = await fetchPushConfig();
  if (!data?.enabled || !data?.publicKey) throw new Error('PUSH_NOT_CONFIGURED');

  const registration = await getRegistration();
  if (!registration) throw new Error('PUSH_UNSUPPORTED');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  await savePushSubscription(subscription.toJSON());
  return subscription;
};

export const disablePushNotifications = async () => {
  if (!isPushSupported()) return;

  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
};

export const syncPushSubscription = async () => {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await savePushSubscription(subscription.toJSON());
};

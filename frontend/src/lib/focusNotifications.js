import { Capacitor } from '@capacitor/core';

const FOCUS_NOTIFICATION_CHANNEL = 'focus-timer-alarm-v1';

const getNotificationId = (sessionId) => {
  const id = Number.parseInt(String(sessionId).slice(-7), 16);
  return Number.isFinite(id) && id > 0 ? id : 1;
};

export const requestFocusNotificationPermission = async () => {
  try {
    if (Capacitor.getPlatform() === 'android') {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
      return permission.display === 'granted';
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'default') return (await Notification.requestPermission()) === 'granted';
    return Notification.permission === 'granted';
  } catch (error) {
    console.error('Could not request focus notification permission:', error);
    return false;
  }
};

export const checkFocusNotificationPermission = async () => {
  try {
    if (Capacitor.getPlatform() === 'android') {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.checkPermissions();
      return permission.display === 'granted';
    }
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  } catch (error) {
    console.error('Could not check focus notification permission:', error);
    return false;
  }
};

export const scheduleFocusAlarm = async (session, title, body, channelName, channelDescription) => {
  if (Capacitor.getPlatform() !== 'android' || !session?._id || !session.endsAt) return null;

  const at = new Date(session.endsAt);
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return null;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return { permissionDenied: true };

  await LocalNotifications.createChannel({
    id: FOCUS_NOTIFICATION_CHANNEL,
    name: channelName,
    description: channelDescription,
    importance: 5,
    sound: 'focus_alarm',
    vibration: true,
  });

  const id = getNotificationId(session._id);
  await LocalNotifications.cancel({ notifications: [{ id }] });
  const result = await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: FOCUS_NOTIFICATION_CHANNEL,
      schedule: { at, allowWhileIdle: true },
      isExactNotification: true,
      foreground: true,
      extra: { focusSessionId: String(session._id) },
    }],
  });
  return result;
};

export const cancelFocusAlarm = async (sessionId) => {
  if (Capacitor.getPlatform() !== 'android' || !sessionId) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: getNotificationId(sessionId) }] });
};

export const notifyFocusSessionCompleted = (title, body) => {
  if (Capacitor.getPlatform() === 'android') return;
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

import { useEffect } from 'react';
import { syncPushSubscription } from '@/lib/push';

const PushSubscriptionSync = () => {
  useEffect(() => {
    const sync = () => {
      if (!localStorage.getItem('todo-user')) return;
      syncPushSubscription().catch(() => {});
    };
    const timer = window.setTimeout(sync, 1500);
    window.addEventListener('todo-auth-changed', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('todo-auth-changed', sync);
    };
  }, []);

  return null;
};

export default PushSubscriptionSync;

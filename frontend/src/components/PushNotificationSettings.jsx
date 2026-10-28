import { useEffect, useState } from 'react';
import { BellRing, LoaderCircle, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushState,
} from '@/lib/push';
import { useLanguage } from '@/lib/i18n';

const PushNotificationSettings = () => {
  const { t } = useLanguage();
  const [state, setState] = useState({ supported: true, configured: false, permission: 'default', subscribed: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const nextState = await getPushState();
      if (active) {
        setState(nextState);
        setLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const enable = async () => {
    try {
      setBusy(true);
      await enablePushNotifications();
      setState((current) => ({ ...current, permission: 'granted', subscribed: true }));
      toast.success(t.pushEnabled);
    } catch (error) {
      const code = error?.message;
      if (code === 'PUSH_PERMISSION_DENIED') toast.error(t.pushDenied);
      else if (code === 'PUSH_NOT_CONFIGURED') toast.error(t.pushNotConfigured);
      else if (code === 'PUSH_UNSUPPORTED') toast.error(t.pushUnsupported);
      else toast.error(t.pushEnableFailed);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    try {
      setBusy(true);
      await disablePushNotifications();
      setState((current) => ({ ...current, subscribed: false }));
      toast.success(t.pushDisabled);
    } catch {
      toast.error(t.pushEnableFailed);
    } finally {
      setBusy(false);
    }
  };

  const enabled = state.subscribed && state.permission === 'granted';

  return (
    <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75 lg:col-span-2'>
      <div className='flex items-start gap-3'>
        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200'>
          <BellRing className='h-5 w-5' />
        </span>
        <div className='min-w-0 flex-1'>
          <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.pushNotifications}</h2>
          <p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>{t.pushDescription}</p>
          <p className='mt-1 text-xs font-medium text-amber-700 dark:text-amber-300'>{t.pushRequired}</p>
        </div>
      </div>

      <div className='mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300'>
          {enabled ? <ShieldCheck className='h-4 w-4 text-emerald-500' /> : <ShieldOff className='h-4 w-4 text-slate-400' />}
          <span>
            {!state.supported
              ? t.pushUnsupported
              : !state.configured
                ? t.pushNotConfigured
                : enabled
                  ? t.pushEnabled
                  : state.permission === 'denied'
                    ? t.pushDenied
                    : t.pushDisabled}
          </span>
        </div>
        <button
          type='button'
          onClick={() => void (enabled ? disable() : enable())}
          disabled={loading || busy || !state.supported || (!state.configured && !enabled) || state.permission === 'denied'}
          className='inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
        >
          {loading || busy ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <BellRing className='h-4 w-4' />}
          {enabled ? t.disablePush : t.enablePush}
        </button>
      </div>
    </section>
  );
};

export default PushNotificationSettings;

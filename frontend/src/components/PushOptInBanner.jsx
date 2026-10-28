import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { enablePushNotifications, getPushState } from '@/lib/push';
import { useLanguage } from '@/lib/i18n';

const DISMISS_KEY = 'kaito-push-prompt-dismissed';

const hasStoredUser = () => {
  try {
    return Boolean(JSON.parse(localStorage.getItem('todo-user') || 'null')?._id);
  } catch {
    return false;
  }
};

const PushOptInBanner = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let timer;

    const evaluate = () => {
      window.clearTimeout(timer);
      if (!hasStoredUser() || sessionStorage.getItem(DISMISS_KEY) === '1') {
        setVisible(false);
        return;
      }
      timer = window.setTimeout(async () => {
        const state = await getPushState();
        if (active && state.supported && state.configured && state.permission === 'default') setVisible(true);
      }, 1500);
    };

    evaluate();
    window.addEventListener('todo-auth-changed', evaluate);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('todo-auth-changed', evaluate);
    };
  }, []);

  if (!visible) return null;

  const enable = async () => {
    try {
      setBusy(true);
      await enablePushNotifications();
      setVisible(false);
      toast.success(t.pushEnabled);
    } catch (error) {
      if (error?.message === 'PUSH_PERMISSION_DENIED') toast.error(t.pushDenied);
      else if (error?.message === 'PUSH_NOT_CONFIGURED') toast.error(t.pushNotConfigured);
      else toast.error(t.pushEnableFailed);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <aside className='fixed bottom-4 right-4 z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-violet-200 bg-white p-4 shadow-2xl dark:border-violet-900/70 dark:bg-slate-900'>
      <div className='flex items-start gap-3'>
        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'>
          <BellRing className='h-5 w-5' />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-semibold text-slate-900 dark:text-white'>{t.pushPromptTitle}</p>
          <p className='mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300'>{t.pushPromptBody}</p>
          <div className='mt-3 flex items-center gap-2'>
            <button
              type='button'
              onClick={() => void enable()}
              disabled={busy}
              className='rounded-2xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60'
            >
              {busy ? t.pushEnabling : t.enablePush}
            </button>
            <button type='button' onClick={dismiss} className='rounded-2xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'>
              {t.pushLater}
            </button>
          </div>
        </div>
        <button type='button' onClick={dismiss} aria-label={t.close} className='rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'>
          <X className='h-4 w-4' />
        </button>
      </div>
    </aside>
  );
};

export default PushOptInBanner;

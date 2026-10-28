import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/i18n';
import { countAllPendingOfflineOperations, flushOfflineOperations } from '@/lib/offlineQueue';

const getStoredUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('todo-user') || 'null')?._id || null;
  } catch {
    return null;
  }
};

const OfflineStatus = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(countAllPendingOfflineOperations);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setOnline(navigator.onLine);
      setPending(countAllPendingOfflineOperations());
    };

    const flush = async () => {
      const userId = getStoredUserId();
      if (!userId || !navigator.onLine) return;
      setSyncing(true);
      try {
        await flushOfflineOperations(userId);
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
        await queryClient.invalidateQueries({ queryKey: ['gamification'] });
      } finally {
        updateStatus();
        setSyncing(false);
      }
    };

    const handleOnline = () => {
      updateStatus();
      void flush();
    };

    const timer = window.setInterval(() => {
      updateStatus();
      if (navigator.onLine && countAllPendingOfflineOperations() > 0) void flush();
    }, 5000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', updateStatus);
    if (navigator.onLine) window.setTimeout(() => void flush(), 1200);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', updateStatus);
    };
  }, [queryClient]);

  if (online && pending === 0 && !syncing) return null;

  return (
    <div role='status' className='fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-3xl border border-slate-700 bg-slate-950/95 px-4 py-2.5 text-xs font-medium text-slate-100 shadow-2xl backdrop-blur'>
      {syncing ? (
        <RefreshCw className='h-4 w-4 animate-spin text-sky-300' />
      ) : online ? (
        <Wifi className='h-4 w-4 text-emerald-300' />
      ) : (
        <CloudOff className='h-4 w-4 text-amber-300' />
      )}
      <span>{syncing ? t.offlineSyncing : online ? t.offlinePending.replace('{count}', String(pending)) : t.offlineMode}</span>
    </div>
  );
};

export default OfflineStatus;

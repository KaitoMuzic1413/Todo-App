import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { fetchActiveFocusSession, fetchFocusSummary, fetchTasks, startFocusSession, updateFocusSession } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const FOCUS_SETTINGS_KEY = 'todo-focus-settings';
const DEFAULT_DURATIONS = { focus: 25, shortBreak: 5, longBreak: 15 };

const getStoredUser = () => {
  try {
    const user = localStorage.getItem('todo-user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const getStoredDurations = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(FOCUS_SETTINGS_KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_DURATIONS).map(([key, fallback]) => {
      const value = Number(stored[key]);
      return [key, Number.isInteger(value) && value >= 1 && value <= 240 ? value : fallback];
    }));
  } catch {
    return DEFAULT_DURATIONS;
  }
};

const formatClock = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const FocusPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [currentUser] = useState(getStoredUser);
  const [mode, setMode] = useState('focus');
  const [durations, setDurations] = useState(getStoredDurations);
  const [taskId, setTaskId] = useState('');
  const [now, setNow] = useState(null);
  const completedNotificationId = useRef(null);

  useEffect(() => {
    if (!currentUser?._id) navigate('/signin', { replace: true });
  }, [currentUser, navigate]);

  useEffect(() => {
    localStorage.setItem(FOCUS_SETTINGS_KEY, JSON.stringify(durations));
  }, [durations]);

  const activeQuery = useQuery({
    queryKey: ['activeFocusSession', currentUser?._id],
    queryFn: async () => (await fetchActiveFocusSession()).data,
    enabled: Boolean(currentUser?._id),
    refetchInterval: 15000,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', currentUser?._id, 'task'],
    queryFn: async () => (await fetchTasks(currentUser._id, 'task')).data || [],
    enabled: Boolean(currentUser?._id),
  });

  const summaryQuery = useQuery({
    queryKey: ['focusSummary', currentUser?._id],
    queryFn: async () => (await fetchFocusSummary()).data,
    enabled: Boolean(currentUser?._id),
  });

  const activeSession = activeQuery.data?.session || null;

  useEffect(() => {
    if (activeSession?.status !== 'running') return undefined;
    const tick = () => setNow(Date.now());
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const timer = window.setInterval(tick, 1000);
    const initialTick = window.setTimeout(tick, 0);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialTick);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeSession?._id, activeSession?.status]);

  const remainingSeconds = useMemo(() => {
    if (!activeSession) return 0;
    if (activeSession.status !== 'running' || !activeSession.endsAt) return activeSession.remainingSeconds;
    if (now === null) return activeSession.remainingSeconds;
    return Math.max(0, Math.ceil((new Date(activeSession.endsAt).getTime() - now) / 1000));
  }, [activeSession, now]);

  const actionMutation = useMutation({
    mutationFn: ({ sessionId, action }) => updateFocusSession(sessionId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['focusSummary', currentUser?._id] });
    },
    onError: (error) => toast.error(error.response?.data?.message || t.focusSaveError),
  });

  const startMutation = useMutation({
    mutationFn: (payload) => startFocusSession(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeFocusSession', currentUser?._id] }),
    onError: (error) => toast.error(error.response?.data?.message || t.focusSaveError),
  });

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running' || remainingSeconds > 0 || actionMutation.isPending) return;
    if (completedNotificationId.current === activeSession._id) return;
    completedNotificationId.current = activeSession._id;
    actionMutation.mutate({ sessionId: activeSession._id, action: 'complete' });
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t.sessionCompleted, { body: activeSession.mode === 'focus' ? t.focusTime : t.focusMode });
    }
    toast.success(t.sessionCompleted);
  }, [activeSession, remainingSeconds, actionMutation, t]);

  useEffect(() => {
    const completedSession = activeQuery.data?.completedSession;
    if (!completedSession || completedNotificationId.current === completedSession._id) return;
    completedNotificationId.current = completedSession._id;
    queryClient.invalidateQueries({ queryKey: ['focusSummary', currentUser?._id] });
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t.sessionCompleted, { body: t.focusTime });
    }
    toast.success(t.sessionCompleted);
  }, [activeQuery.data, currentUser?._id, queryClient, t]);

  const changeDuration = (durationKey, value) => {
    const nextValue = Number(value);
    if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 240) return;
    setDurations((current) => ({ ...current, [durationKey]: nextValue }));
  };

  const startSession = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    startMutation.mutate({
      taskId: taskId || null,
      mode,
      durationSeconds: durations[mode] * 60,
    });
  };

  if (!currentUser?._id) return null;

  const modeOptions = [
    ['focus', t.focus],
    ['shortBreak', t.shortBreak],
    ['longBreak', t.longBreak],
  ];
  const taskList = (tasksQuery.data || []).filter((task) => task.status !== 'complete');
  const linkedTask = taskList.find((task) => task._id === (activeSession?.taskId || taskId));
  const displayMode = activeSession?.mode || mode;
  const sessionStatus = activeSession?.status;
  const isWorking = actionMutation.isPending || startMutation.isPending;

  return (
    <LayoutShell>
      <div className='mx-auto max-w-3xl space-y-5'>
        <Header />
        <header className='flex items-center gap-3'>
          <Timer className='h-7 w-7 text-violet-600' />
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.focusMode}</h1>
            <p className='text-sm text-slate-500 dark:text-slate-400'>{t.notificationPermission}</p>
          </div>
        </header>

        {activeQuery.isError || tasksQuery.isError || summaryQuery.isError ? (
          <div role='alert' className='rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>{t.focusLoadError}</div>
        ) : null}

        <section className='space-y-6 rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/75 sm:p-8'>
          {!activeSession ? (
            <div className='relative mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-full border border-slate-200/80 bg-slate-100/90 p-1.5 shadow-inner dark:border-slate-700 dark:bg-slate-950/70' role='group' aria-label={t.focusMode}>
              <span className='pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-1.5rem)/3)] rounded-full bg-violet-600 shadow-accent-indicator transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' style={{ transform: `translateX(calc(${modeOptions.findIndex(([key]) => key === mode) * 100}% + ${modeOptions.findIndex(([key]) => key === mode) * 6}px))` }} />
              {modeOptions.map(([key, label]) => (
                <button key={key} type='button' aria-pressed={mode === key} onClick={() => setMode(key)} className={`relative z-10 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${mode === key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className='mx-auto flex aspect-square w-full max-w-[17rem] items-center justify-center rounded-full border-[10px] border-violet-100 bg-gradient-to-br from-white via-violet-50 to-indigo-100 shadow-accent-ring dark:border-violet-950 dark:from-slate-900 dark:via-violet-950/40 dark:to-indigo-950/70 dark:shadow-accent-ring' aria-live='off'>
            <span className='font-mono text-6xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-7xl'>
              {formatClock(activeSession ? remainingSeconds : durations[mode] * 60)}
            </span>
          </div>
          <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
            {sessionStatus === 'running' ? t.sessionRunning : sessionStatus === 'paused' ? t.sessionPaused : t[displayMode]}
          </p>

          {!activeSession ? (
            <div className='mx-auto grid max-w-md gap-3 text-left'>
              <label className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                {t.linkTask}
                <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className='h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-900/40'>
                  <option value=''>{t.noLinkedTask}</option>
                  {taskList.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}
                </select>
              </label>
              <div className='grid grid-cols-3 gap-2'>
                {modeOptions.map(([key, label]) => (
                  <label key={key} className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                    {label} ({t.minutes})
                    <input type='number' min='1' max='240' step='1' value={durations[key]} onChange={(event) => changeDuration(key, event.target.value)} className='h-11 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40' />
                  </label>
                ))}
              </div>
            </div>
          ) : linkedTask ? (
            <p className='mx-auto max-w-md truncate rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-200'>{linkedTask.title}</p>
          ) : null}

          <div className='flex flex-wrap justify-center gap-2'>
            {!activeSession ? (
              <button type='button' disabled={isWorking || activeQuery.isLoading} onClick={startSession} className='inline-flex h-12 items-center gap-2 rounded-full bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-accent transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl disabled:opacity-50'>
                <Play className='h-4 w-4' />{t.startSession}
              </button>
            ) : (
              <>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: sessionStatus === 'running' ? 'pause' : 'resume' })} className='inline-flex h-12 items-center gap-2 rounded-full bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-accent transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl disabled:opacity-50'>
                  {sessionStatus === 'running' ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
                  {sessionStatus === 'running' ? t.pauseSession : t.resumeSession}
                </button>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: 'complete' })} className='inline-flex h-12 items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50/70 px-5 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'>
                  <Check className='h-4 w-4' />{t.finishSession}
                </button>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: 'cancel' })} className='inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'>
                  <RotateCcw className='h-4 w-4' />{t.cancelSession}
                </button>
              </>
            )}
          </div>
          {sessionStatus === 'running' && 'Notification' in window && Notification.permission !== 'granted' ? (
            <button type='button' onClick={() => Notification.requestPermission()} className='mx-auto inline-flex items-center gap-1.5 text-xs text-slate-500 underline dark:text-slate-400'><Bell className='h-3.5 w-3.5' />{t.notificationPermission}</button>
          ) : null}
        </section>

        <section className='grid gap-3 sm:grid-cols-2'>
          <div className='rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{summaryQuery.data?.sessions ?? 0}</p>
            <p className='text-xs text-slate-500 dark:text-slate-400'>{t.focusSessions}</p>
          </div>
          <div className='rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{Math.floor((summaryQuery.data?.actualSeconds || 0) / 60)} {t.minutes}</p>
            <p className='text-xs text-slate-500 dark:text-slate-400'>{t.focusTime}</p>
          </div>
        </section>
      </div>
    </LayoutShell>
  );
};

export default FocusPage;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { fetchActiveFocusSession, fetchFocusSummary, fetchTasks, startFocusSession, updateFocusSession } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import {
  cancelFocusAlarm,
  checkFocusNotificationPermission,
  notifyFocusSessionCompleted,
  requestFocusNotificationPermission,
  scheduleFocusAlarm,
} from '@/lib/focusNotifications';

const FOCUS_SETTINGS_KEY = 'todo-focus-settings';
const DEFAULT_DURATIONS = { focus: 25, shortBreak: 5, longBreak: 13 };
const MAX_FOCUS_MINUTES = 240;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getBreakLimits = (focusMinutes) => ({
  shortBreak: Math.max(1, Math.round(focusMinutes * 0.3)),
  longBreak: Math.max(1, Math.round(focusMinutes * 0.5)),
});

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
    const durations = Object.fromEntries(Object.entries(DEFAULT_DURATIONS).map(([key, fallback]) => {
      const value = Number(stored[key]);
      return [key, Number.isInteger(value) && value >= 1 && value <= MAX_FOCUS_MINUTES ? value : fallback];
    }));
    const breakLimits = getBreakLimits(durations.focus);
    return {
      ...durations,
      shortBreak: clamp(durations.shortBreak, 1, breakLimits.shortBreak),
      longBreak: clamp(durations.longBreak, 1, breakLimits.longBreak),
    };
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
  const [durationInputs, setDurationInputs] = useState(() => Object.fromEntries(
    Object.entries(durations).map(([key, value]) => [key, String(value)])
  ));
  const [taskId, setTaskId] = useState('');
  const [now, setNow] = useState(null);
  const [focusNotificationsGranted, setFocusNotificationsGranted] = useState(false);
  const completedNotificationId = useRef(null);
  const completionCheckId = useRef(null);
  const scheduledAlarmKey = useRef(null);

  useEffect(() => {
    if (!currentUser?._id) navigate('/signin', { replace: true });
  }, [currentUser, navigate]);

  useEffect(() => {
    let active = true;
    checkFocusNotificationPermission().then((granted) => {
      if (active) setFocusNotificationsGranted(granted);
    });
    return () => { active = false; };
  }, []);

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
  const refreshActiveSession = activeQuery.refetch;

  const scheduleAlarm = useCallback((session) => {
    if (!session?._id || !session.endsAt) return;
    const key = `${session._id}:${session.endsAt}`;
    scheduledAlarmKey.current = key;
    void scheduleFocusAlarm(
      session,
      t.sessionCompleted,
      t[session.mode],
      t.focusAlarmChannelName,
      t.focusAlarmChannelDescription
    )
      .then((result) => {
        if (result?.warning) toast.warning(t.focusAlarmMayBeDelayed);
      })
      .catch((error) => {
        console.error('Could not schedule focus alarm:', error);
        toast.error(t.focusAlarmSetupError);
      });
  }, [t]);

  const cancelAlarm = useCallback((sessionId) => {
    scheduledAlarmKey.current = null;
    if (sessionId) void cancelFocusAlarm(sessionId).catch((error) => console.error('Could not cancel focus alarm:', error));
  }, []);

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
    onSuccess: (response, variables) => {
      if (variables.action === 'resume') scheduleAlarm(response.data.session);
      else cancelAlarm(variables.sessionId);
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['focusSummary', currentUser?._id] });
    },
    onError: (error) => toast.error(error.response?.data?.message || t.focusSaveError),
  });

  const startMutation = useMutation({
    mutationFn: (payload) => startFocusSession(payload),
    onSuccess: (response) => {
      scheduleAlarm(response.data.session);
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession', currentUser?._id] });
    },
    onError: (error) => toast.error(error.response?.data?.message || t.focusSaveError),
  });

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running' || remainingSeconds > 0) return;
    if (completionCheckId.current === activeSession._id) return;

    const sessionId = activeSession._id;
    completionCheckId.current = sessionId;
    void refreshActiveSession().then((result) => {
      if (result.isError || result.data?.session?._id === sessionId) {
        completionCheckId.current = null;
      }
    });
  }, [activeSession?._id, activeSession?.status, activeQuery.dataUpdatedAt, remainingSeconds, refreshActiveSession]);

  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.status !== 'running' || !activeSession.endsAt) {
      cancelAlarm(activeSession._id);
      return;
    }

    const key = `${activeSession._id}:${activeSession.endsAt}`;
    if (scheduledAlarmKey.current !== key) scheduleAlarm(activeSession);
  }, [activeSession?._id, activeSession?.status, activeSession?.endsAt, activeSession?.mode, scheduleAlarm, cancelAlarm]);

  useEffect(() => {
    const completedSession = activeQuery.data?.completedSession;
    if (!completedSession || completedNotificationId.current === completedSession._id) return;
    completedNotificationId.current = completedSession._id;
    queryClient.invalidateQueries({ queryKey: ['focusSummary', currentUser?._id] });
    notifyFocusSessionCompleted(t.sessionCompleted, t[completedSession.mode] || t.focusTime);
    toast.success(t.sessionCompleted);
  }, [activeQuery.data, currentUser?._id, queryClient, t]);

  const changeDuration = (durationKey, rawValue) => {
    setDurationInputs((current) => ({ ...current, [durationKey]: rawValue }));
    if (rawValue === '') return;

    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue)) return;

    const nextFocus = durationKey === 'focus'
      ? clamp(parsedValue, 1, MAX_FOCUS_MINUTES)
      : durations.focus;
    const breakLimits = getBreakLimits(nextFocus);
    const nextDurations = {
      ...durations,
      focus: nextFocus,
      shortBreak: durationKey === 'shortBreak'
        ? clamp(parsedValue, 1, breakLimits.shortBreak)
        : clamp(durations.shortBreak, 1, breakLimits.shortBreak),
      longBreak: durationKey === 'longBreak'
        ? clamp(parsedValue, 1, breakLimits.longBreak)
        : clamp(durations.longBreak, 1, breakLimits.longBreak),
    };

    setDurations(nextDurations);
    setDurationInputs((current) => ({
      ...current,
      [durationKey]: String(nextDurations[durationKey]),
      ...(durationKey === 'focus' && current.shortBreak !== ''
        ? { shortBreak: String(nextDurations.shortBreak) }
        : {}),
      ...(durationKey === 'focus' && current.longBreak !== ''
        ? { longBreak: String(nextDurations.longBreak) }
        : {}),
    }));
  };

  const durationLimits = { focus: MAX_FOCUS_MINUTES, ...getBreakLimits(durations.focus) };
  const hasValidDurations = Object.keys(DEFAULT_DURATIONS).every((key) => (
    durationInputs[key] !== '' && Number(durationInputs[key]) === durations[key]
  ));

  const startSession = async () => {
    const permissionGranted = await requestFocusNotificationPermission();
    setFocusNotificationsGranted(permissionGranted);
    if (!permissionGranted) toast.error(t.focusAlarmPermissionDenied);
    startMutation.mutate({
      taskId: taskId || null,
      mode,
      durationSeconds: durations[mode] * 60,
    });
  };

  const enableFocusNotifications = async () => {
    const permissionGranted = await requestFocusNotificationPermission();
    setFocusNotificationsGranted(permissionGranted);
    if (!permissionGranted) {
      toast.error(t.focusAlarmPermissionDenied);
      return;
    }
    if (activeSession?.status === 'running') {
      scheduledAlarmKey.current = null;
      scheduleAlarm(activeSession);
    }
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
          <div role='alert' className='rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>{t.focusLoadError}</div>
        ) : null}

        <section className='space-y-6 rounded-3xl border border-slate-200/80 bg-white/85 p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/75 sm:p-8'>
          {!activeSession ? (
            <div className='relative mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-3xl border border-slate-200/80 bg-slate-100/90 p-1.5 shadow-inner dark:border-slate-700 dark:bg-slate-950/70' role='group' aria-label={t.focusMode}>
              <span className='pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-1.5rem)/3)] rounded-3xl bg-violet-600 shadow-accent-indicator transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' style={{ transform: `translateX(calc(${modeOptions.findIndex(([key]) => key === mode) * 100}% + ${modeOptions.findIndex(([key]) => key === mode) * 6}px))` }} />
              {modeOptions.map(([key, label]) => (
                <button key={key} type='button' aria-pressed={mode === key} onClick={() => setMode(key)} className={`relative z-10 rounded-3xl px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${mode === key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
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
                <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className='h-11 rounded-3xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-900/40'>
                  <option value=''>{t.noLinkedTask}</option>
                  {taskList.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}
                </select>
              </label>
              <div className='grid grid-cols-3 gap-2'>
                {modeOptions.map(([key, label]) => (
                  <label key={key} className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                    {label} ({t.minutes})
                    <input type='number' min='1' max={durationLimits[key]} step='1' value={durationInputs[key]} onChange={(event) => changeDuration(key, event.target.value)} className='h-11 min-w-0 rounded-3xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40' />
                  </label>
                ))}
              </div>
            </div>
          ) : linkedTask ? (
            <p className='mx-auto max-w-md truncate rounded-3xl bg-violet-50 px-3 py-2 text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-200'>{linkedTask.title}</p>
          ) : null}

          <div className='flex flex-wrap justify-center gap-2'>
            {!activeSession ? (
              <button type='button' disabled={isWorking || activeQuery.isLoading || !hasValidDurations} onClick={startSession} className='inline-flex h-12 items-center gap-2 rounded-3xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-accent transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl disabled:opacity-50'>
                <Play className='h-4 w-4' />{t.startSession}
              </button>
            ) : (
              <>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: sessionStatus === 'running' ? 'pause' : 'resume' })} className='inline-flex h-12 items-center gap-2 rounded-3xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-accent transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl disabled:opacity-50'>
                  {sessionStatus === 'running' ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
                  {sessionStatus === 'running' ? t.pauseSession : t.resumeSession}
                </button>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: 'complete' })} className='inline-flex h-12 items-center gap-2 rounded-3xl border border-emerald-300 bg-emerald-50/70 px-5 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'>
                  <Check className='h-4 w-4' />{t.finishSession}
                </button>
                <button type='button' disabled={isWorking} onClick={() => actionMutation.mutate({ sessionId: activeSession._id, action: 'cancel' })} className='inline-flex h-12 items-center gap-2 rounded-3xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'>
                  <RotateCcw className='h-4 w-4' />{t.cancelSession}
                </button>
              </>
            )}
          </div>
          {sessionStatus === 'running' && !focusNotificationsGranted ? (
            <button type='button' onClick={() => void enableFocusNotifications()} className='mx-auto inline-flex items-center gap-1.5 text-xs text-slate-500 underline dark:text-slate-400'><Bell className='h-3.5 w-3.5' />{t.notificationPermission}</button>
          ) : null}
        </section>

        <section className='grid gap-3 sm:grid-cols-2'>
          <div className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{summaryQuery.data?.sessions ?? 0}</p>
            <p className='text-xs text-slate-500 dark:text-slate-400'>{t.focusSessions}</p>
          </div>
          <div className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            <p className='text-2xl font-bold text-slate-900 dark:text-white'>{Math.floor((summaryQuery.data?.actualSeconds || 0) / 60)} {t.minutes}</p>
            <p className='text-xs text-slate-500 dark:text-slate-400'>{t.focusTime}</p>
          </div>
        </section>
      </div>
    </LayoutShell>
  );
};

export default FocusPage;

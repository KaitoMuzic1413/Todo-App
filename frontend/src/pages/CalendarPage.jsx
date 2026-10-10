import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { fetchCalendarNotes, fetchCalendarTasks, saveCalendarNote, updateTask } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { dateKey, getCalendarDays, getCalendarRange, getDayWarnings, groupTasksByCalendarDay } from '@/lib/calendarUtils';

const EMPTY_TASKS = [];

const getStoredUser = () => {
  try {
    const user = localStorage.getItem('todo-user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const toLocalInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const getTime = (value, locale) => new Intl.DateTimeFormat(locale, {
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(value));

const TaskSchedule = ({ task, t, onSave, onClear, saving }) => {
  const [scheduleField, setScheduleField] = useState(task.startAt ? 'startAt' : 'dueAt');
  const scheduledValue = task[scheduleField];
  
  const submitSchedule = (event) => {
    event.preventDefault();
    const localValue = new FormData(event.currentTarget).get('schedule');
    if (!localValue) return;
    if (scheduleField === 'dueAt' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    onSave(task, scheduleField, new Date(localValue).toISOString());
  };
  
  return (
    <details className='mt-1'>
      <summary className='cursor-pointer text-xs font-medium text-violet-600 dark:text-violet-300'>{t.rescheduleTask}</summary>
      <form onSubmit={submitSchedule} className='mt-2 flex flex-wrap items-center gap-2'>
        <select value={scheduleField} onChange={(event) => setScheduleField(event.target.value)} className='h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'>
          <option value='startAt'>{t.startTime}</option>
          <option value='dueAt'>{t.dueDate}</option>
        </select>
        <input
          name='schedule'
          type='datetime-local'
          required
          defaultValue={toLocalInputValue(scheduledValue)}
          className='h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
          aria-label={t.scheduleTask}
        />
        <button type='submit' disabled={saving} className='rounded-lg bg-violet-600 px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50'>
          {t.saveSchedule}
        </button>
        {scheduledValue ? (
          <button type='button' disabled={saving} onClick={() => onClear(task, scheduleField)} className='rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300'>
            {t.clearSchedule}
          </button>
        ) : null}
      </form>
    </details>
  );
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [currentUser] = useState(getStoredUser);
  const [viewMode, setViewMode] = useState('week');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month, 1)),
  })), [locale]);
  const yearOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => selectedDate.getFullYear() - 15 + index), [selectedDate]);

  useEffect(() => {
    if (!currentUser?._id) navigate('/signin', { replace: true });
  }, [currentUser, navigate]);

  const calendarDays = useMemo(() => getCalendarDays(viewMode, selectedDate), [viewMode, selectedDate]);
  const calendarDateKeys = useMemo(() => calendarDays.map(dateKey), [calendarDays]);
  const calendarRange = useMemo(() => getCalendarRange(calendarDays), [calendarDays]);
  const calendarNotesQuery = useQuery({
    queryKey: ['calendarNotes', currentUser?._id, ...calendarDateKeys],
    queryFn: async () => (await fetchCalendarNotes(calendarDateKeys)).data || {},
    enabled: Boolean(currentUser?._id && calendarDateKeys.length),
  });
  const [noteDrafts, setNoteDrafts] = useState({});
  const submittedNotes = useRef(new Map());
  const taskQuery = useQuery({
    queryKey: ['calendarTasks', currentUser?._id, calendarRange?.start, calendarRange?.endExclusive],
    queryFn: async () => (await fetchCalendarTasks(calendarRange)).data || [],
    enabled: Boolean(currentUser?._id && calendarRange),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ taskId, payload }) => updateTask(taskId, currentUser._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id, 'task'] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
    },
    onError: () => toast.error(t.scheduleSaveError),
  });

  const noteMutation = useMutation({
    mutationFn: ({ key, content }) => saveCalendarNote(key, content),
    onSuccess: (_response, { confirm }) => {
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      if (confirm) toast.success(t.dayNoteSaved);
    },
    onError: (_error, { key, content }) => {
      if (submittedNotes.current.get(key) === content) submittedNotes.current.delete(key);
      toast.error(t.calendarNoteSaveError);
    },
  });

  const saveDayNote = (key, content, confirm = false) => {
    const persistedContent = calendarNotesQuery.data?.[key]?.content || '';
    if (content === persistedContent || submittedNotes.current.get(key) === content) return;
    submittedNotes.current.set(key, content);
    noteMutation.mutate({ key, content, confirm });
  };

  const tasks = taskQuery.data || EMPTY_TASKS;
  const taskByDate = useMemo(() => groupTasksByCalendarDay(tasks, calendarDays), [tasks, calendarDays]);

  const unscheduledTasks = tasks.filter((task) => !task.startAt && !task.dueAt);

  const changePeriod = (direction) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      if (viewMode === 'month') next.setMonth(next.getMonth() + direction);
      else if (viewMode === 'week') next.setDate(next.getDate() + direction * 7);
      else next.setDate(next.getDate() + direction);
      return next;
    });
  };

  const periodLabel = viewMode === 'month'
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(selectedDate)
    : viewMode === 'week'
    ? `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(calendarDays[0])} - ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(calendarDays[6])}`
    : new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(selectedDate);

  const saveSchedule = (task, field, value) => {
    scheduleMutation.mutate({
      taskId: task._id,
      payload: { [field]: value, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
  };

  const clearSchedule = (task, field) => {
    scheduleMutation.mutate({
      taskId: task._id,
      payload: { [field]: null },
    });
  };

  if (!currentUser?._id) return null;

  return (
    <LayoutShell>
      <div className='space-y-5'>
        <Header />
        <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3'>
            <CalendarDays className='h-7 w-7 text-violet-600' />
            <div>
              <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.calendarTitle}</h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>{periodLabel}</p>
              <div className='mt-2 flex items-center gap-2'>
                <select
                  aria-label={t.selectMonth}
                  value={selectedDate.getMonth()}
                  onChange={(event) => setSelectedDate((current) => new Date(current.getFullYear(), Number(event.target.value), 1))}
                  className='h-9 max-w-40 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold capitalize text-slate-700 shadow-sm outline-none transition hover:border-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-violet-900/40'
                >
                  {monthOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select
                  aria-label={t.selectYear}
                  value={selectedDate.getFullYear()}
                  onChange={(event) => setSelectedDate((current) => new Date(Number(event.target.value), current.getMonth(), 1))}
                  className='h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-violet-900/40'
                >
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative grid grid-cols-3 gap-1 rounded-full border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-950/70' role='group' aria-label={t.calendarTitle}>
              <span className='pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1rem)/3)] rounded-full bg-violet-600 shadow-accent-indicator transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' style={{ transform: `translateX(calc(${['day', 'week', 'month'].indexOf(viewMode) * 100}% + ${['day', 'week', 'month'].indexOf(viewMode) * 4}px))` }} />
              {[
                ['day', t.dayView],
                ['week', t.weekView],
                ['month', t.monthView],
              ].map(([key, label]) => (
                <button key={key} type='button' aria-pressed={viewMode === key} onClick={() => setViewMode(key)} className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type='button' onClick={() => setSelectedDate(new Date())} className='rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-200'>
              {t.today}
            </button>
            <button type='button' onClick={() => changePeriod(-1)} aria-label={t.previousPeriod} className='flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-700 dark:hover:bg-violet-500/10'>
              <ChevronLeft className='h-4 w-4' />
            </button>
            <button type='button' onClick={() => changePeriod(1)} aria-label={t.nextPeriod} className='flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-700 dark:hover:bg-violet-500/10'>
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        </header>

        {taskQuery.isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-7' aria-label='Loading calendar'>
            {Array.from({ length: viewMode === 'day' ? 1 : 7 }, (_, index) => <div key={index} className='h-36 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800' />)}
          </div>
        ) : taskQuery.isError ? (
          <section className='rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>
            <p>{t.calendarLoadError}</p>
            <button type='button' onClick={() => taskQuery.refetch()} className='mt-3 font-semibold underline'>{t.retry}</button>
          </section>
        ) : (
          <section className='overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-md dark:border-slate-800 dark:bg-slate-900/70'>
            {viewMode !== 'day' ? (
              <div className='grid grid-cols-7 border-b border-slate-200 dark:border-slate-800'>
                {calendarDays.slice(0, 7).map((date) => (
                  <div key={dateKey(date)} className='px-1 py-2 text-center text-xs font-semibold text-slate-500 sm:px-2 sm:text-xs'>
                    {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
                  </div>
                ))}
              </div>
            ) : null}
            <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : viewMode === 'week' ? 'grid-cols-1 sm:grid-cols-7' : 'grid-cols-7'}`}>
              {calendarDays.map((date) => {
                const dayTasks = taskByDate.get(dateKey(date)) || [];
                const warnings = getDayWarnings(dayTasks, date);
                const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                const dayKey = dateKey(date);
                const noteValue = noteDrafts[dayKey] ?? calendarNotesQuery.data?.[dayKey]?.content ?? '';
                return (
                  <div key={dayKey} className={`group flex min-h-28 flex-col border-b border-r border-slate-200 p-1.5 transition-colors focus-within:bg-violet-50/50 dark:border-slate-800 dark:focus-within:bg-violet-950/20 sm:min-h-36 sm:p-2 ${viewMode === 'month' && !isCurrentMonth ? 'bg-slate-50/70 text-slate-400 dark:bg-slate-950/30' : ''}`}>
                    <div className='mb-1 flex items-center justify-between gap-1'>
                      <button type='button' onClick={() => { setSelectedDate(date); setViewMode('day'); }} className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all ${dateKey(date) === dateKey(new Date()) ? 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-accent' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-violet-700 dark:hover:bg-violet-500/10'}`}>
                        {date.getDate()}
                      </button>
                      <div className='flex gap-1'>
                        {warnings.overlaps ? <AlertTriangle className='h-3.5 w-3.5 text-amber-500' aria-label={t.overlapWarning} title={t.overlapWarning} /> : null}
                        {warnings.overloaded ? <AlertTriangle className='h-3.5 w-3.5 text-rose-500' aria-label={t.overloadedDay} title={t.overloadedDay} /> : null}
                      </div>
                    </div>
                    <div className='space-y-1'>
                      {(viewMode === 'month' ? dayTasks.slice(0, 2) : dayTasks).map((task) => (
                        <article key={task._id} className='rounded-lg border border-violet-200 bg-violet-50/80 px-1.5 py-1 text-xs text-slate-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-slate-200 sm:px-2 sm:text-xs'>
                          <p className='truncate font-medium'>{task.title}</p>
                          <p className='flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 sm:text-xs'>
                            <Clock className='h-3 w-3 shrink-0' />
                            {task.startAt && dateKey(new Date(task.startAt)) === dateKey(date)
                              ? getTime(task.startAt, locale)
                              : task.startAt && dateKey(new Date(task.startAt)) !== dateKey(date)
                              ? t.continuesLabel
                              : `${t.dueDate} ${getTime(task.dueAt, locale)}`}
                            {task.estimatedMinutes ? ` · ${task.estimatedMinutes}m` : ''}
                          </p>
                          {viewMode !== 'month' ? <TaskSchedule task={task} t={t} onSave={saveSchedule} onClear={clearSchedule} saving={scheduleMutation.isPending} /> : null}
                        </article>
                      ))}
                      {viewMode === 'month' && dayTasks.length > 2 ? <p className='px-1 text-xs text-slate-500'>+{dayTasks.length - 2}</p> : null}
                    </div>
                    <label className='mt-1 flex min-h-8 flex-1'>
                      <span className='sr-only'>{t.dayNote} — {date.toLocaleDateString(locale)}</span>
                      <textarea
                        rows={viewMode === 'month' ? 1 : 2}
                        maxLength={4000}
                        value={noteValue}
                        enterKeyHint='enter'
                        onChange={(event) => setNoteDrafts((current) => ({ ...current, [dayKey]: event.target.value }))}
                        onKeyDown={(event) => {
                          const mobileKeyboard = window.matchMedia('(pointer: coarse)').matches;
                          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !mobileKeyboard) {
                            event.preventDefault();
                            saveDayNote(dayKey, event.currentTarget.value, true);
                          }
                        }}
                        onBlur={(event) => {
                          saveDayNote(dayKey, event.currentTarget.value);
                        }}
                        className='h-full min-h-8 w-full flex-1 resize-none rounded-md border-0 bg-slate-950/10 px-2 py-1.5 text-xs leading-4 text-slate-700 outline-none ring-0 placeholder:text-transparent focus:bg-slate-950/10 focus:outline-none focus:ring-0 dark:bg-slate-950/40 dark:text-slate-200 dark:focus:bg-slate-950/40 sm:text-xs'
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className='rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-md dark:border-slate-800 dark:bg-slate-900/70'>
          <h2 className='mb-3 text-sm font-semibold text-slate-900 dark:text-white'>{t.unscheduledTasks}</h2>
          {taskQuery.isError ? (
            <p className='text-sm text-rose-600 dark:text-rose-300'>{t.calendarLoadError}</p>
          ) : taskQuery.isLoading ? (
            <div className='h-12 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800' />
          ) : unscheduledTasks.length ? (
            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
              {unscheduledTasks.map((task) => (
                <article key={task._id} className='rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-md dark:border-slate-700 dark:bg-slate-950/40'>
                  <p className='truncate text-sm font-medium text-slate-800 dark:text-slate-100'>{task.title}</p>
                  <TaskSchedule task={task} t={t} onSave={saveSchedule} onClear={clearSchedule} saving={scheduleMutation.isPending} />
                </article>
              ))}
            </div>
          ) : (
            <p className='text-sm text-slate-500 dark:text-slate-400'>{t.noUnscheduledTasks || 'All tasks have a schedule.'}</p>
          )}
        </section>
      </div>
    </LayoutShell>
  );
};

export default CalendarPage;

import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  List,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import SelectMenu from '@/components/ui/select-menu';
import {
  fetchCalendarNotes,
  fetchCalendarTasks,
  fetchTasks,
  saveCalendarNote,
  updateTask,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import {
  dateKey,
  getCalendarDays,
  getCalendarRange,
  getDayWarnings,
  groupTasksByCalendarDay,
} from '@/lib/calendarUtils';

const EMPTY_TASKS = [];
const HOURS_IN_DAY = Array.from({ length: 24 }, (_, i) => i);

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

const formatTimeOnly = (value, locale) => {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [currentUser] = useState(getStoredUser);

  const [viewMode, setViewMode] = useState('week'); // 'month' | 'week' | 'day' | 'agenda'
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const scheduleTaskSelectId = useId();
  const scheduleStartTimeId = useId();
  const scheduleDurationId = useId();
  const scheduleDeadlineId = useId();

  // Dialog State (Google Calendar-style Quick Note & Event Modal)
  const [activeModal, setActiveModal] = useState(null); // { mode: 'note' | 'task', date: Date, task: object | null }
  const [noteInput, setNoteInput] = useState('');
  const [taskScheduleForm, setTaskScheduleForm] = useState({
    taskId: '',
    startAt: '',
    dueAt: '',
    estimatedMinutes: 30,
  });

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        value: month,
        label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month, 1)),
      })),
    [locale]
  );

  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, index) => selectedDate.getFullYear() - 10 + index),
    [selectedDate]
  );

  useEffect(() => {
    if (!currentUser?._id) navigate('/signin', { replace: true });
  }, [currentUser, navigate]);

  const calendarDays = useMemo(
    () => getCalendarDays(viewMode === 'agenda' ? 'week' : viewMode, selectedDate),
    [viewMode, selectedDate]
  );
  const calendarDateKeys = useMemo(() => calendarDays.map(dateKey), [calendarDays]);
  const calendarRange = useMemo(() => getCalendarRange(calendarDays), [calendarDays]);

  // Query calendar notes for current visible date keys
  const calendarNotesQuery = useQuery({
    queryKey: ['calendarNotes', currentUser?._id, ...calendarDateKeys],
    queryFn: async () => (await fetchCalendarNotes(calendarDateKeys)).data || {},
    enabled: Boolean(currentUser?._id && calendarDateKeys.length),
  });

  // Query scheduled tasks for visible calendar range
  const taskQuery = useQuery({
    queryKey: ['calendarTasks', currentUser?._id, calendarRange?.start, calendarRange?.endExclusive],
    queryFn: async () => (await fetchCalendarTasks(calendarRange)).data || [],
    enabled: Boolean(currentUser?._id && calendarRange),
  });

  // Query all user tasks (to allow scheduling unscheduled tasks)
  const allTasksQuery = useQuery({
    queryKey: ['tasks', currentUser?._id, 'task'],
    queryFn: async () => (await fetchTasks(currentUser._id, 'task')).data || [],
    enabled: Boolean(currentUser?._id),
  });

  const tasks = taskQuery.data || EMPTY_TASKS;
  const allTasks = allTasksQuery.data || EMPTY_TASKS;
  const taskByDate = useMemo(
    () => groupTasksByCalendarDay(tasks, calendarDays),
    [tasks, calendarDays]
  );

  const unscheduledTasks = useMemo(
    () => allTasks.filter((task) => !task.startAt && !task.dueAt && task.status !== 'complete'),
    [allTasks]
  );

  // Mutation: Save / Delete Day Note
  const noteMutation = useMutation({
    mutationFn: ({ key, content }) => saveCalendarNote(key, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      toast.success(t.dayNoteSaved || 'Đã lưu ghi chú ngày');
      setActiveModal(null);
    },
    onError: () => {
      toast.error(t.calendarNoteSaveError || 'Không thể lưu ghi chú ngày');
    },
  });

  // Mutation: Save Task Schedule
  const scheduleMutation = useMutation({
    mutationFn: ({ taskId, payload }) => updateTask(taskId, currentUser._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
      toast.success(language === 'vi' ? 'Đã cập nhật lịch công việc' : 'Schedule updated');
      setActiveModal(null);
    },
    onError: () => {
      toast.error(t.scheduleSaveError || 'Không thể lưu lịch');
    },
  });

  // Navigation handlers
  const changePeriod = (direction) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      if (viewMode === 'month') next.setMonth(next.getMonth() + direction);
      else if (viewMode === 'week' || viewMode === 'agenda')
        next.setDate(next.getDate() + direction * 7);
      else next.setDate(next.getDate() + direction);
      return next;
    });
  };

  const jumpToToday = () => {
    setSelectedDate(new Date());
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        selectedDate
      );
    }
    if (viewMode === 'week' || viewMode === 'agenda') {
      const first = calendarDays[0] || selectedDate;
      const last = calendarDays[6] || selectedDate;
      return `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
        first
      )} – ${new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(last)}`;
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(selectedDate);
  }, [viewMode, locale, selectedDate, calendarDays]);

  // Modal Open Handlers
  const openNoteModal = (date) => {
    const key = dateKey(date);
    const existingContent = calendarNotesQuery.data?.[key]?.content || '';
    setNoteInput(existingContent);
    setActiveModal({ mode: 'note', date, task: null });
  };

  const openTaskScheduleModal = (date, task = null, hour = null) => {
    const keyDate = new Date(date);
    if (typeof hour === 'number') {
      keyDate.setHours(hour, 0, 0, 0);
    }
    const initialStart = task?.startAt || (typeof hour === 'number' ? keyDate.toISOString() : '');
    const initialDue = task?.dueAt || '';

    setTaskScheduleForm({
      taskId: task?._id || (unscheduledTasks[0]?._id ?? ''),
      startAt: toLocalInputValue(initialStart),
      dueAt: toLocalInputValue(initialDue),
      estimatedMinutes: task?.estimatedMinutes || 30,
    });
    setActiveModal({ mode: 'task', date, task });
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!activeModal?.date) return;
    const key = dateKey(activeModal.date);
    noteMutation.mutate({ key, content: noteInput.trim() });
  };

  const handleDeleteNote = () => {
    if (!activeModal?.date) return;
    const key = dateKey(activeModal.date);
    noteMutation.mutate({ key, content: '' });
  };

  const handleSaveSchedule = (e) => {
    e.preventDefault();
    if (!taskScheduleForm.taskId) {
      toast.error(language === 'vi' ? 'Vui lòng chọn công việc' : 'Please select a task');
      return;
    }

    const payload = {
      startAt: taskScheduleForm.startAt ? new Date(taskScheduleForm.startAt).toISOString() : null,
      dueAt: taskScheduleForm.dueAt ? new Date(taskScheduleForm.dueAt).toISOString() : null,
      estimatedMinutes: Number(taskScheduleForm.estimatedMinutes) || 30,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    scheduleMutation.mutate({ taskId: taskScheduleForm.taskId, payload });
  };

  const handleClearSchedule = () => {
    if (!taskScheduleForm.taskId) return;
    scheduleMutation.mutate({
      taskId: taskScheduleForm.taskId,
      payload: { startAt: null, dueAt: null },
    });
  };

  // Google Calendar Current Time Red Line Indicator
  const now = new Date();
  const currentDayKey = dateKey(now);
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const currentTimePercentage = (currentMinutesFromMidnight / 1440) * 100;

  if (!currentUser?._id) return null;

  return (
    <LayoutShell>
      <div className='space-y-5 pb-12'>
        <Header />

        {/* Top Google Calendar Control Bar */}
        <header className='flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          {/* Left: App Title & Quick Date Picker */}
          <div className='flex items-center gap-3.5'>
            <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-violet-500/25'>
              <CalendarDays className='h-5 w-5' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h1 className='text-xl font-extrabold text-slate-900 dark:text-white'>
                  {t.calendarTitle}
                </h1>
                <span className='rounded-3xl bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'>
                  Google Style
                </span>
              </div>
              <p className='text-xs font-semibold capitalize text-slate-500 dark:text-slate-400'>
                {periodLabel}
              </p>
            </div>
          </div>

          {/* Center / Right: Google Calendar Navigation & Actions */}
          <div className='flex flex-wrap items-center gap-2'>
            {/* Today Button */}
            <button
              type='button'
              onClick={jumpToToday}
              className='rounded-3xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
            >
              {t.today}
            </button>

            {/* Prev / Next Chevrons */}
            <div className='flex items-center rounded-3xl border border-slate-200 bg-white p-0.5 shadow-xs dark:border-slate-700 dark:bg-slate-900'>
              <button
                type='button'
                onClick={() => changePeriod(-1)}
                aria-label={t.previousPeriod}
                className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-600 hover:bg-slate-100 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-800'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <button
                type='button'
                onClick={() => changePeriod(1)}
                aria-label={t.nextPeriod}
                className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-600 hover:bg-slate-100 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-800'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>

            {/* Month & Year Selectors */}
            <div className='hidden items-center gap-1.5 md:flex'>
              <SelectMenu
                ariaLabel={t.selectMonth}
                value={String(selectedDate.getMonth())}
                onChange={(value) =>
                  setSelectedDate(new Date(selectedDate.getFullYear(), Number(value), 1))
                }
                options={monthOptions.map(({ value, label }) => ({ value: String(value), label }))}
                className='h-9 px-2.5 text-xs font-semibold capitalize'
              />

              <SelectMenu
                ariaLabel={t.selectYear}
                value={String(selectedDate.getFullYear())}
                onChange={(value) =>
                  setSelectedDate(new Date(Number(value), selectedDate.getMonth(), 1))
                }
                options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
                className='h-9 px-2.5 text-xs font-semibold'
              />
            </div>

            {/* View Mode Toggle (Pills) */}
            <div
              className='relative grid grid-cols-4 gap-0.5 rounded-3xl border border-slate-200 bg-slate-100 p-0.5 shadow-inner dark:border-slate-800 dark:bg-slate-950'
              role='tablist'
            >
              {[
                ['month', t.monthView || 'Tháng'],
                ['week', t.weekView || 'Tuần'],
                ['day', t.dayView || 'Ngày'],
                ['agenda', language === 'vi' ? 'Lịch' : 'Agenda'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type='button'
                  onClick={() => setViewMode(key)}
                  className={`relative z-10 rounded-3xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    viewMode === key
                      ? 'text-white'
                      : 'text-slate-600 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-200'
                  }`}
                >
                  {viewMode === key ? (
                    <motion.span
                      layoutId='calendar-view-pill'
                      className='absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-sm'
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  ) : null}
                  <span className='relative z-10 truncate'>{label}</span>
                </button>
              ))}
            </div>

            {/* Quick "+ Tạo" Button (Google Calendar Signature) */}
            <button
              type='button'
              onClick={() => openNoteModal(selectedDate)}
              className='flex items-center gap-1.5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95'
            >
              <Plus className='h-4 w-4' />
              <span>{language === 'vi' ? 'Ghi chú / Lên lịch' : 'Create'}</span>
            </button>
          </div>
        </header>

        {/* Calendar Content Views */}
        {taskQuery.isLoading ? (
          <div className='grid h-96 place-items-center rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50'>
            <div className='flex flex-col items-center gap-3 text-violet-600 dark:text-violet-400'>
              <CalendarIcon className='h-8 w-8 animate-bounce' />
              <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>
                {t.loading}
              </p>
            </div>
          </div>
        ) : taskQuery.isError ? (
          <section className='rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>
            <p>{t.calendarLoadError}</p>
            <button
              type='button'
              onClick={() => taskQuery.refetch()}
              className='mt-3 font-semibold underline'
            >
              {t.retry}
            </button>
          </section>
        ) : viewMode === 'month' ? (
          /* ==================== MONTH VIEW ==================== */
          <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90'>
            {/* Weekday Header */}
            <div className='grid grid-cols-7 border-b border-slate-200/90 bg-slate-50/70 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400'>
              {calendarDays.slice(0, 7).map((date) => (
                <div key={dateKey(date)} className='py-2.5'>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
                </div>
              ))}
            </div>

            {/* 7x6 Day Grid */}
            <div className='grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80'>
              {calendarDays.map((date) => {
                const dayKey = dateKey(date);
                const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                const isToday = dayKey === currentDayKey;
                const dayTasks = taskByDate.get(dayKey) || [];
                const dayNote = calendarNotesQuery.data?.[dayKey]?.content || '';
                const warnings = getDayWarnings(dayTasks, date);

                return (
                  <div
                    key={dayKey}
                    onClick={() => openNoteModal(date)}
                    className={`group relative flex min-h-[110px] cursor-pointer flex-col p-1.5 transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-950/15 sm:min-h-[135px] sm:p-2 ${
                      !isCurrentMonth
                        ? 'bg-slate-50/40 text-slate-400 dark:bg-slate-950/30 dark:text-slate-600'
                        : 'bg-white/40 dark:bg-slate-900/40 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {/* Day Number Row & Hover Add Button */}
                    <div className='mb-1 flex items-center justify-between'>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-3xl text-xs font-extrabold transition-all ${
                          isToday
                            ? 'bg-violet-600 text-white shadow-xs shadow-violet-500/40'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      <div className='flex items-center gap-1'>
                        {warnings.overlaps ? (
                          <AlertTriangle
                            className='h-3.5 w-3.5 text-amber-500'
                            title={t.overlapWarning}
                          />
                        ) : null}
                        {warnings.overloaded ? (
                          <AlertTriangle
                            className='h-3.5 w-3.5 text-rose-500'
                            title={t.overloadedDay}
                          />
                        ) : null}

                        {/* Quick hover add button (Google Calendar style) */}
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskScheduleModal(date);
                          }}
                          className='hidden h-6 w-6 items-center justify-center rounded-3xl text-slate-400 hover:bg-violet-100 hover:text-violet-700 group-hover:flex dark:hover:bg-violet-900/50 dark:hover:text-violet-300'
                          title={language === 'vi' ? 'Lên lịch công việc' : 'Schedule task'}
                        >
                          <Plus className='h-3.5 w-3.5' />
                        </button>
                      </div>
                    </div>

                    {/* Events & Notes Badges Inside Month Cell */}
                    <div className='space-y-1 overflow-hidden'>
                      {/* Day Note Badge (Amber / Violet Styled Pill) */}
                      {dayNote ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openNoteModal(date);
                          }}
                          className='flex items-center gap-1 truncate rounded-3xl border border-amber-200/90 bg-amber-50/90 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-xs transition hover:scale-[1.02] hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200'
                          title={dayNote}
                        >
                          <StickyNote className='h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400' />
                          <span className='truncate'>{dayNote}</span>
                        </div>
                      ) : null}

                      {/* Task Chips (Google Calendar Style) */}
                      {dayTasks.slice(0, dayNote ? 2 : 3).map((task) => {
                        const isStart = Boolean(task.startAt);
                        return (
                          <div
                            key={task._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openTaskScheduleModal(date, task);
                            }}
                            className={`flex items-center gap-1 truncate rounded-3xl border px-2 py-0.5 text-[11px] font-medium transition hover:scale-[1.02] ${
                              isStart
                                ? 'border-violet-200 bg-violet-100/90 text-violet-900 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200'
                                : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <Clock className='h-3 w-3 shrink-0 opacity-70' />
                            {task.startAt ? (
                              <span className='font-bold'>{formatTimeOnly(task.startAt, locale)}</span>
                            ) : null}
                            <span className='truncate'>{task.title}</span>
                          </div>
                        );
                      })}

                      {dayTasks.length > (dayNote ? 2 : 3) ? (
                        <p className='px-1 text-[10px] font-bold text-violet-600 dark:text-violet-400'>
                          +{dayTasks.length - (dayNote ? 2 : 3)} {language === 'vi' ? 'mục khác' : 'more'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : viewMode === 'week' || viewMode === 'day' ? (
          /* ==================== WEEK & DAY VIEW (GOOGLE CALENDAR TIME GRID) ==================== */
          <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90'>
            {/* Header Columns: Days & Date */}
            <div className='flex border-b border-slate-200/90 dark:border-slate-800'>
              <div className='w-14 shrink-0 border-r border-slate-200/90 bg-slate-50/50 p-2 text-center text-[11px] font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-950/30'>
                GMT
              </div>
              <div
                className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-800/80 ${
                  viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
                }`}
              >
                {calendarDays.map((date) => {
                  const dayKey = dateKey(date);
                  const isToday = dayKey === currentDayKey;

                  return (
                    <div
                      key={dayKey}
                      className={`py-3 text-center transition-colors ${
                        isToday ? 'bg-violet-50/30 dark:bg-violet-950/10' : ''
                      }`}
                    >
                      <p className='text-xs font-bold uppercase text-slate-400 dark:text-slate-500'>
                        {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
                      </p>
                      <button
                        type='button'
                        onClick={() => {
                          setSelectedDate(date);
                          setViewMode('day');
                        }}
                        className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-3xl text-sm font-extrabold transition ${
                          isToday
                            ? 'bg-violet-600 text-white shadow-xs shadow-violet-500/40'
                            : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All-Day / Day Notes Sticky Section (Google Calendar signature) */}
            <div className='flex border-b border-slate-200/90 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40'>
              <div className='flex w-14 shrink-0 items-center justify-center border-r border-slate-200/90 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800'>
                Notes
              </div>
              <div
                className={`grid flex-1 divide-x divide-slate-100 p-1.5 dark:divide-slate-800/80 ${
                  viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
                }`}
              >
                {calendarDays.map((date) => {
                  const dayKey = dateKey(date);
                  const dayNote = calendarNotesQuery.data?.[dayKey]?.content || '';

                  return (
                    <div key={dayKey} className='px-1'>
                      {dayNote ? (
                        <div
                          onClick={() => openNoteModal(date)}
                          className='flex cursor-pointer items-center gap-1.5 truncate rounded-3xl border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-xs transition hover:scale-[1.02] dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200'
                          title={dayNote}
                        >
                          <StickyNote className='h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />
                          <span className='truncate'>{dayNote}</span>
                        </div>
                      ) : (
                        <button
                          type='button'
                          onClick={() => openNoteModal(date)}
                          className='flex w-full items-center justify-center gap-1 rounded-3xl border border-dashed border-slate-300/80 py-1 text-[11px] font-medium text-slate-400 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:hover:border-violet-500'
                        >
                          <Plus className='h-3 w-3' />
                          <span>{language === 'vi' ? 'Ghi chú' : 'Add note'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hourly Time Grid (00:00 to 23:00) */}
            <div className='sidebar-scrollbar relative max-h-[620px] overflow-y-auto'>
              <div className='flex'>
                {/* Left Hour Labels */}
                <div className='w-14 shrink-0 divide-y divide-transparent border-r border-slate-200/80 dark:border-slate-800'>
                  {HOURS_IN_DAY.map((hour) => (
                    <div
                      key={hour}
                      className='relative h-14 pr-2 text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500'
                    >
                      <span className='-translate-y-2.5 inline-block'>
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Grid Columns for Each Day */}
                <div
                  className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-800/70 ${
                    viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
                  }`}
                >
                  {calendarDays.map((date) => {
                    const dayKey = dateKey(date);
                    const isToday = dayKey === currentDayKey;
                    const dayTasks = taskByDate.get(dayKey) || [];

                    return (
                      <div
                        key={dayKey}
                        className={`relative divide-y divide-slate-100/90 dark:divide-slate-800/50 ${
                          isToday ? 'bg-violet-50/15 dark:bg-violet-950/5' : ''
                        }`}
                      >
                        {/* Red Line Indicator for Current Time Today */}
                        {isToday ? (
                          <div
                            className='pointer-events-none absolute left-0 right-0 z-20 flex items-center'
                            style={{ top: `${currentTimePercentage}%` }}
                          >
                            <span className='-ml-1.5 h-3 w-3 rounded-full bg-rose-500 shadow-sm' />
                            <div className='h-0.5 flex-1 bg-rose-500' />
                          </div>
                        ) : null}

                        {/* 24 Hour Slots */}
                        {HOURS_IN_DAY.map((hour) => (
                          <div
                            key={hour}
                            onClick={() => openTaskScheduleModal(date, null, hour)}
                            className='group/hour relative h-14 cursor-pointer transition-colors hover:bg-violet-50/50 dark:hover:bg-violet-950/20'
                          >
                            <span className='hidden p-1 text-[9px] font-bold text-violet-500 group-hover/hour:inline-block'>
                              + {String(hour).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}

                        {/* Scheduled Task Blocks Overlaid on Grid */}
                        {dayTasks
                          .filter((t) => t.startAt)
                          .map((task) => {
                            const taskStart = new Date(task.startAt);
                            const startMins = taskStart.getHours() * 60 + taskStart.getMinutes();
                            const duration = task.estimatedMinutes || 45;
                            const topPx = (startMins / 60) * 56; // 56px = h-14 per hour
                            const heightPx = Math.max(30, (duration / 60) * 56);

                            return (
                              <div
                                key={task._id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTaskScheduleModal(date, task);
                                }}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                className='absolute inset-x-1 z-10 cursor-pointer overflow-hidden rounded-3xl border border-violet-300 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-2 text-white shadow-md shadow-violet-500/20 transition-all hover:z-30 hover:scale-[1.01] hover:shadow-lg dark:border-violet-400'
                              >
                                <p className='truncate text-xs font-bold leading-tight'>
                                  {task.title}
                                </p>
                                <p className='flex items-center gap-1 text-[10px] font-semibold opacity-90'>
                                  <Clock className='h-2.5 w-2.5 shrink-0' />
                                  <span>
                                    {formatTimeOnly(task.startAt, locale)} ({duration}m)
                                  </span>
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* ==================== AGENDA VIEW (LỊCH TRÌNH CHI TIẾT) ==================== */
          <section className='space-y-4'>
            {calendarDays.map((date) => {
              const dayKey = dateKey(date);
              const dayTasks = taskByDate.get(dayKey) || [];
              const dayNote = calendarNotesQuery.data?.[dayKey]?.content || '';
              const isToday = dayKey === currentDayKey;

              return (
                <div
                  key={dayKey}
                  className={`overflow-hidden rounded-3xl border p-4 shadow-sm backdrop-blur-md transition ${
                    isToday
                      ? 'border-violet-300 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-950/20'
                      : 'border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80'
                  }`}
                >
                  <div className='flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800'>
                    <div className='flex items-center gap-3'>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-3xl text-sm font-extrabold ${
                          isToday
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <div>
                        <h3 className='text-sm font-bold text-slate-900 dark:text-white'>
                          {new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}
                        </h3>
                        {isToday ? (
                          <span className='text-[11px] font-bold text-violet-600 dark:text-violet-400'>
                            {t.today}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() => openNoteModal(date)}
                        className='flex items-center gap-1 rounded-3xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      >
                        <FileText className='h-3.5 w-3.5 text-amber-500' />
                        <span>{dayNote ? (language === 'vi' ? 'Sửa ghi chú' : 'Edit note') : (language === 'vi' ? 'Thêm ghi chú' : 'Add note')}</span>
                      </button>
                      <button
                        type='button'
                        onClick={() => openTaskScheduleModal(date)}
                        className='flex items-center gap-1 rounded-3xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700'
                      >
                        <Plus className='h-3.5 w-3.5' />
                        <span>{language === 'vi' ? 'Lên lịch' : 'Schedule'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Note Section */}
                  {dayNote ? (
                    <div className='mt-3 flex items-start gap-2.5 rounded-3xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200'>
                      <StickyNote className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
                      <div className='min-w-0 flex-1 whitespace-pre-wrap font-medium'>
                        {dayNote}
                      </div>
                    </div>
                  ) : null}

                  {/* Tasks List for Day */}
                  <div className='mt-3 space-y-2'>
                    {dayTasks.length ? (
                      dayTasks.map((task) => (
                        <div
                          key={task._id}
                          onClick={() => openTaskScheduleModal(date, task)}
                          className='flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200/90 bg-white p-3 shadow-xs transition hover:border-violet-300 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:border-violet-500'
                        >
                          <div className='flex items-center gap-2.5'>
                            <span className='h-2.5 w-2.5 rounded-3xl bg-violet-600' />
                            <div>
                              <p className='text-xs font-bold text-slate-800 dark:text-slate-100'>
                                {task.title}
                              </p>
                              <p className='text-[11px] text-slate-500 dark:text-slate-400'>
                                {task.startAt
                                  ? `${language === 'vi' ? 'Bắt đầu' : 'Starts'} ${formatTimeOnly(task.startAt, locale)} · ${task.estimatedMinutes || 30}m`
                                  : `${t.dueDate} ${formatTimeOnly(task.dueAt, locale)}`}
                              </p>
                            </div>
                          </div>
                          <span className='rounded-3xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300'>
                            {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                          </span>
                        </div>
                      ))
                    ) : !dayNote ? (
                      <p className='text-xs italic text-slate-400'>
                        {language === 'vi' ? 'Không có ghi chú hay lịch trình' : 'No notes or schedule for this day'}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Unscheduled Tasks Section */}
        <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <List className='h-5 w-5 text-violet-600' />
              <h2 className='text-sm font-bold text-slate-900 dark:text-white'>
                {t.unscheduledTasks} ({unscheduledTasks.length})
              </h2>
            </div>
            <span className='text-xs text-slate-400'>
              {language === 'vi' ? 'Bấm để xếp vào lịch' : 'Click to schedule'}
            </span>
          </div>

          {unscheduledTasks.length ? (
            <div className='mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3'>
              {unscheduledTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => openTaskScheduleModal(selectedDate, task)}
                  className='flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-violet-500'
                >
                  <p className='truncate text-xs font-bold text-slate-800 dark:text-slate-100'>
                    {task.title}
                  </p>
                  <button
                    type='button'
                    className='rounded-3xl bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                  >
                    + {language === 'vi' ? 'Lên lịch' : 'Schedule'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
              {t.noUnscheduledTasks || 'Tất cả công việc đã được lên lịch.'}
            </p>
          )}
        </section>
      </div>

      {/* ==================== GOOGLE CALENDAR NOTE & SCHEDULE MODAL ==================== */}
      <AnimatePresence>
        {activeModal ? (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6'
            role='presentation'
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className='flex w-[min(540px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(145deg,#ffffff,#f8faff)] shadow-2xl dark:border-white/10 dark:bg-[linear-gradient(145deg,#13192b,#0f172a)]'
            >
              {/* Modal Header */}
              <header className='flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800'>
                <div>
                  <h3 className='text-base font-extrabold text-slate-900 dark:text-white'>
                    {activeModal.date
                      ? new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(activeModal.date)
                      : t.calendarTitle}
                  </h3>
                  <p className='text-xs text-slate-400'>
                    {activeModal.mode === 'note'
                      ? language === 'vi'
                        ? 'Ghi chú cho ngày này'
                        : 'Day Note'
                      : language === 'vi'
                      ? 'Lên lịch công việc vào khung giờ'
                      : 'Schedule task time block'}
                  </p>
                </div>

                <div className='flex items-center gap-1.5'>
                  {/* Mode switcher tabs inside modal */}
                  <div className='flex rounded-3xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900'>
                    <button
                      type='button'
                      onClick={() => setActiveModal((prev) => ({ ...prev, mode: 'note' }))}
                      className={`rounded-3xl px-3 py-1 text-xs font-bold transition ${
                        activeModal.mode === 'note'
                          ? 'bg-white text-violet-700 shadow-xs dark:bg-violet-600 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      📝 {language === 'vi' ? 'Ghi chú' : 'Note'}
                    </button>
                    <button
                      type='button'
                      onClick={() => setActiveModal((prev) => ({ ...prev, mode: 'task' }))}
                      className={`rounded-3xl px-3 py-1 text-xs font-bold transition ${
                        activeModal.mode === 'task'
                          ? 'bg-white text-violet-700 shadow-xs dark:bg-violet-600 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      ⏱️ {language === 'vi' ? 'Lịch hẹn' : 'Task'}
                    </button>
                  </div>

                  <button
                    type='button'
                    onClick={() => setActiveModal(null)}
                    className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    aria-label={t.close}
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </header>

              {/* Modal Body */}
              <div className='p-6'>
                {activeModal.mode === 'note' ? (
                  /* Form: Day Note (Google Calendar Style) */
                  <form onSubmit={handleSaveNote} className='space-y-4'>
                    <div className='relative'>
                      <label htmlFor='modal-day-note-input' className='sr-only'>
                        {t.dayNote}
                      </label>
                      <textarea
                        id='modal-day-note-input'
                        autoFocus
                        rows={6}
                        maxLength={4000}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder={
                          t.dayNotePlaceholder ||
                          (language === 'vi'
                            ? 'Viết ghi chú quan trọng, nhắc nhở hoặc nhật ký công việc cho ngày này...'
                            : 'Add a private note or log for this day…')
                        }
                        className='w-full rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-900/30'
                      />
                      <span className='absolute bottom-3 right-4 text-[10px] text-slate-400'>
                        {noteInput.length} / 4000
                      </span>
                    </div>

                    <div className='flex items-center justify-between pt-2'>
                      {noteInput ? (
                        <button
                          type='button'
                          onClick={handleDeleteNote}
                          disabled={noteMutation.isPending}
                          className='flex items-center gap-1 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        >
                          <Trash2 className='h-4 w-4' />
                          <span>{language === 'vi' ? 'Xóa ghi chú' : 'Delete note'}</span>
                        </button>
                      ) : <div />}

                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setActiveModal(null)}
                          className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                        >
                          {t.close}
                        </button>
                        <button
                          type='submit'
                          disabled={noteMutation.isPending}
                          className='rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50'
                        >
                          {noteMutation.isPending
                            ? t.loading
                            : language === 'vi'
                            ? 'Lưu ghi chú'
                            : 'Save note'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Form: Task Scheduling */
                  <form onSubmit={handleSaveSchedule} className='space-y-4'>
                    <div>
                      <label htmlFor={scheduleTaskSelectId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                        {language === 'vi' ? 'Chọn công việc' : 'Select Task'}
                      </label>
                      <SelectMenu
                        id={scheduleTaskSelectId}
                        value={taskScheduleForm.taskId}
                        onChange={(value) =>
                          setTaskScheduleForm((prev) => ({ ...prev, taskId: value }))
                        }
                        ariaLabel={language === 'vi' ? 'Chọn công việc' : 'Select Task'}
                        options={allTasks.map((task) => ({
                          value: task._id,
                          label: `${task.title}${task.status === 'complete' ? ' ✓' : ''}`,
                        }))}
                        className='h-10 w-full px-3 text-xs shadow-sm'
                      />
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <label htmlFor={scheduleStartTimeId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                          {t.startTime}
                        </label>
                        <input
                          id={scheduleStartTimeId}
                          type='datetime-local'
                          value={taskScheduleForm.startAt}
                          onChange={(e) =>
                            setTaskScheduleForm((prev) => ({ ...prev, startAt: e.target.value }))
                          }
                          className='h-10 w-full rounded-3xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                        />
                      </div>

                      <div>
                        <label htmlFor={scheduleDurationId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                          {t.estimatedDuration} (m)
                        </label>
                        <input
                          id={scheduleDurationId}
                          type='number'
                          min={5}
                          max={720}
                          step={5}
                          value={taskScheduleForm.estimatedMinutes}
                          onChange={(e) =>
                            setTaskScheduleForm((prev) => ({
                              ...prev,
                              estimatedMinutes: Number(e.target.value),
                            }))
                          }
                          className='h-10 w-full rounded-3xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={scheduleDeadlineId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                        {t.dueDate}
                      </label>
                      <input
                        id={scheduleDeadlineId}
                        type='datetime-local'
                        value={taskScheduleForm.dueAt}
                        onChange={(e) =>
                          setTaskScheduleForm((prev) => ({ ...prev, dueAt: e.target.value }))
                        }
                        className='h-10 w-full rounded-3xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                      />
                    </div>

                    <div className='flex items-center justify-between pt-2'>
                      {activeModal.task?.startAt || activeModal.task?.dueAt ? (
                        <button
                          type='button'
                          onClick={handleClearSchedule}
                          disabled={scheduleMutation.isPending}
                          className='rounded-3xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600'
                        >
                          {t.clearSchedule}
                        </button>
                      ) : <div />}

                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setActiveModal(null)}
                          className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                        >
                          {t.close}
                        </button>
                        <button
                          type='submit'
                          disabled={scheduleMutation.isPending}
                          className='rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50'
                        >
                          {scheduleMutation.isPending
                            ? t.loading
                            : t.saveSchedule || 'Lưu lịch'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </LayoutShell>
  );
};

export default CalendarPage;

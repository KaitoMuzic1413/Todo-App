import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Columns3, LayoutGrid, List, Award, Flame, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import AddTask from '@/components/AddTask';
import DateTimeFilter from '@/components/DateTimeFilter';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import StatsAndFilters from '@/components/StatsAndFilters';
import TaskList from '@/components/TaskList';
import TaskListPagination from '@/components/TaskListPagination';
import { createTask, deleteTask, fetchGamificationSummary, fetchTasks, toggleTaskStatus, updateTask } from '@/lib/api';
import { getCreatedAtRange, isDateInRange } from '@/lib/dateFilters';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useLanguage } from '@/lib/i18n';
import { sortTasks } from '@/lib/sortTasks';

const PAGE_SIZE = 5;

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;

  try {
    const storedUser = localStorage.getItem('todo-user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

const getDateRange = (value) => {
  return getCreatedAtRange(value);
};

const taskMatchesDateRange = (task, value) => {
  const range = getDateRange(value);
  if (!range) return true;

  return isDateInRange(task?.createdAt, range);
};

const HomePage = ({ contentType = 'task' }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterKey, setFilterKey] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const { preferences, savePreferences } = useUserPreferences(currentUser?._id);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const tasksQueryKey = ['tasks', currentUser?._id, contentType];

  const gamificationQuery = useQuery({
    queryKey: ['gamification', currentUser?._id, timeZone],
    queryFn: async () => (await fetchGamificationSummary(timeZone)).data,
    enabled: Boolean(currentUser?._id),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());

    syncUser();
    window.addEventListener('todo-auth-changed', syncUser);

    return () => {
      window.removeEventListener('todo-auth-changed', syncUser);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?._id) {
      navigate('/signin', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const focusNewTask = (event) => {
      if (!event.altKey || event.key.toLowerCase() !== 'n') return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      document.getElementById('new-task-title')?.focus();
    };
    window.addEventListener('keydown', focusNewTask);
    return () => window.removeEventListener('keydown', focusNewTask);
  }, []);

  const toggleTaskMutation = useMutation({
    mutationFn: (taskId) => toggleTaskStatus(taskId, currentUser._id),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previousTasks = queryClient.getQueryData(tasksQueryKey);

      queryClient.setQueryData(tasksQueryKey, (currentTasks) =>
        (Array.isArray(currentTasks) ? currentTasks : []).map((task) => {
          if (task._id !== taskId) return task;
          const nextStatus = task.status === 'complete' ? 'active' : 'complete';
          return {
            ...task,
            status: nextStatus,
            completedAt: nextStatus === 'complete' ? new Date().toISOString() : null,
          };
        })
      );

      return { previousTasks };
    },
    onError: (error, taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(tasksQueryKey, context.previousTasks);
      }
      toast.error(error.response?.data?.message || t.taskUpdateError);
    },
    onSuccess: (response) => {
      if (response?.data?._id) {
        queryClient.setQueryData(tasksQueryKey, (currentTasks) =>
          (Array.isArray(currentTasks) ? currentTasks : []).map((task) => (task._id === response.data._id ? response.data : task))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['gamification', currentUser?._id] });
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: async () => {
      const response = await fetchTasks(currentUser._id, contentType);
      return response.data || [];
    },
    enabled: !!currentUser?._id,
    refetchInterval: toggleTaskMutation.isPending ? false : 3000,
    refetchIntervalInBackground: true,
  });

  const addTaskMutation = useMutation({
    mutationFn: (payload) => createTask({ ...payload, userId: currentUser._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id, contentType] });
      setCurrentPage(1);
    },
    onError: (error) => toast.error(error.response?.data?.message || t.taskCreateError),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => deleteTask(taskId, currentUser._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id, contentType] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, body }) => updateTask(taskId, currentUser._id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id, contentType] });
      queryClient.invalidateQueries({ queryKey: ['gamification', currentUser?._id] });
    },
  });

  const handleAddTask = (payload) => {
    if (!currentUser?._id) return;
    addTaskMutation.mutate(payload);
  };

  const handleToggleTask = (taskId) => {
    if (!currentUser?._id) return;
    toggleTaskMutation.mutate(taskId);
  };

  const handleDeleteTask = (taskId) => {
    if (!currentUser?._id) return;
    deleteTaskMutation.mutate(taskId);
  };

  const handleUpdateTask = (taskId, nextTitle, payload = {}) => {
    if (!currentUser?._id) return;

    const body = { ...(payload || {}) };
    if (nextTitle !== undefined) {
      const trimmed = String(nextTitle || '').trim();
      if (!trimmed) return;
      body.title = trimmed;
    }

    updateTaskMutation.mutate({ taskId, body });
  };

  const updatePreferences = async (nextPreferences) => {
    try {
      await savePreferences(nextPreferences);
    } catch {
      toast.error('Could not save your preferences.');
    }
  };

  const filteredTasks = useMemo(() => {
    let nextTasks = [...tasks];

    if (filterKey === 'important') {
      nextTasks = nextTasks.filter((task) => !!task.important);
    } else if (filterKey === 'pinned') {
      nextTasks = nextTasks.filter((task) => !!task.pinned || task.status === 'pinned');
    } else if (filterKey === 'completed') {
      nextTasks = nextTasks.filter((task) => task.status === 'complete');
    } else if (filterKey === 'pending') {
      nextTasks = nextTasks.filter((task) => task.status !== 'complete');
    }

    if (timeFilter !== 'all') {
      nextTasks = nextTasks.filter((task) => taskMatchesDateRange(task, timeFilter));
    }

    return nextTasks;
  }, [tasks, filterKey, timeFilter]);

  const sortedTasks = useMemo(() => {
    return sortTasks(filteredTasks, {
      sortBy: preferences.sortBy,
      language,
    });
  }, [filteredTasks, language, preferences.sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleTasks = useMemo(
    () => sortedTasks.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [safeCurrentPage, sortedTasks]
  );

  if (!currentUser?._id) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-300'>
        <p className='animate-pulse text-sm font-medium'>Redirecting to Sign In...</p>
      </div>
    );
  }

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />

        <AddTask onAdd={handleAddTask} contentType={contentType} />
        <StatsAndFilters
          tasks={tasks}
          activeFilter={filterKey}
          onFilterChange={(key) => {
            setFilterKey(key);
            setCurrentPage(1);
          }}
          contentType={contentType}
        />

        {contentType === 'task' ? (
          <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            <div className='mb-4 flex items-center gap-2'>
              <Sparkles className='h-4 w-4 text-amber-500' />
              <h2 className='text-sm font-semibold text-slate-900 dark:text-white'>{t.gamification}</h2>
            </div>
            {gamificationQuery.isLoading ? (
              <div className='grid gap-3 sm:grid-cols-3'>
                {Array.from({ length: 3 }, (_, index) => <div key={index} className='h-16 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800' />)}
              </div>
            ) : gamificationQuery.isError ? (
              <p role='alert' className='text-sm text-rose-600 dark:text-rose-300'>{t.progressLoadError}</p>
            ) : gamificationQuery.data ? (
              <div className='grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]'>
                <div className='rounded-3xl bg-violet-50 p-3 dark:bg-violet-950/30'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='text-xs font-medium text-violet-700 dark:text-violet-200'>{t.level} {gamificationQuery.data.level}</span>
                    <span className='text-sm font-bold text-slate-900 dark:text-white'>{gamificationQuery.data.xp} {t.xp}</span>
                  </div>
                  <div className='mt-2 h-2 overflow-hidden rounded-3xl bg-white/80 dark:bg-slate-900'>
                    <div className='h-full rounded-3xl bg-violet-600 transition-[width]' style={{ width: `${gamificationQuery.data.progressPercent}%` }} />
                  </div>
                  <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{gamificationQuery.data.currentLevelXp}/100 {t.xpToNextLevel}</p>
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  <div className='flex items-center gap-2 rounded-3xl border border-slate-200 p-3 dark:border-slate-700'>
                    <Flame className='h-4 w-4 text-orange-500' />
                    <div><p className='text-sm font-bold text-slate-900 dark:text-white'>{gamificationQuery.data.currentStreak}</p><p className='text-xs text-slate-500'>{t.currentStreak}</p></div>
                  </div>
                  <div className='flex items-center gap-2 rounded-3xl border border-slate-200 p-3 dark:border-slate-700'>
                    <Flame className='h-4 w-4 text-amber-500' />
                    <div><p className='text-sm font-bold text-slate-900 dark:text-white'>{gamificationQuery.data.bestStreak}</p><p className='text-xs text-slate-500'>{t.bestStreak}</p></div>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  {[
                    [t.dailyGoal, gamificationQuery.data.dailyGoal],
                    [t.weeklyGoal, gamificationQuery.data.weeklyGoal],
                  ].map(([label, goal]) => (
                    <div key={label} className='rounded-3xl border border-slate-200 p-3 dark:border-slate-700'>
                      <div className='flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400'><span>{label}</span><span>{goal.progress}/{goal.target}</span></div>
                      <div className='mt-2 h-1.5 overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800'><div className='h-full rounded-3xl bg-emerald-500' style={{ width: `${goal.progress / goal.target * 100}%` }} /></div>
                    </div>
                  ))}
                </div>

                <div className='lg:col-span-3'>
                  <p className='mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300'><Award className='h-3.5 w-3.5 text-amber-500' />{t.achievements}</p>
                  <div className='flex flex-wrap gap-2'>
                    {gamificationQuery.data.achievements.map((achievement) => (
                      <span key={achievement.id} className={`rounded-3xl border px-2.5 py-1 text-xs ${achievement.unlocked ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200' : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'}`}>
                        {t[`${achievement.id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())}Badge`] || achievement.id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className='flex flex-row items-center justify-between gap-2 rounded-3xl border border-slate-200/80 bg-white/70 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:gap-3 sm:p-3'>
          <div className='relative grid shrink-0 grid-cols-3 gap-1 rounded-3xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-950/70' role='group' aria-label={t.viewMode}>
            <span className='pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1rem)/3)] rounded-3xl bg-violet-600 shadow-accent-indicator transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' style={{ transform: `translateX(calc(${['list', 'grid', 'kanban'].indexOf(preferences.taskView) * 100}% + ${['list', 'grid', 'kanban'].indexOf(preferences.taskView) * 4}px))` }} />
            {[
              { key: 'list', label: t.listView, Icon: List },
              { key: 'grid', label: t.gridView, Icon: LayoutGrid },
              { key: 'kanban', label: t.kanbanView, Icon: Columns3 },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type='button'
                aria-label={label}
                aria-pressed={preferences.taskView === key}
                title={label}
                onClick={() => {
                  setCurrentPage(1);
                  void updatePreferences({ taskView: key });
                }}
                className={`relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-3xl px-2 text-xs font-semibold transition-colors sm:px-3 ${preferences.taskView === key ? 'text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <Icon className='h-4 w-4' />
                <span className='hidden sm:inline'>{label}</span>
              </button>
            ))}
          </div>

          <div className='flex min-w-0 items-center gap-1.5 sm:gap-2'>
            <label htmlFor='task-sort' className='shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400'>{t.sortBy}</label>
            <select
              id='task-sort'
              value={preferences.sortBy}
              onChange={(event) => void updatePreferences({ sortBy: event.target.value })}
              className='h-9 w-24 min-w-0 rounded-3xl border border-slate-200 bg-white px-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:w-auto sm:max-w-44 sm:px-2'
            >
              <option value='title'>{t.titleSort}</option>
              <option value='createdAt'>{t.createdRecently}</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className='rounded-3xl border border-slate-200 bg-white/80 p-5 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/70'>
            Loading tasks...
          </div>
        ) : (
          <div className='min-h-[460px] space-y-4'>
            {preferences.taskView === 'kanban' ? (
              <div className='grid gap-4 lg:grid-cols-2'>
                {[
                  { key: 'active', label: t.statusPending },
                  { key: 'complete', label: t.statusCompleted },
                ].map(({ key, label }) => (
                  <TaskList
                    key={key}
                    title={label}
                    tasks={visibleTasks.filter((task) => task.status === key)}
                    page={safeCurrentPage}
                    compact
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onUpdate={handleUpdateTask}
                  />
                ))}
              </div>
            ) : (
            <TaskList
              title={
                filterKey === 'important'
                  ? 'Important'
                  : filterKey === 'pinned'
                  ? 'Pinned Files'
                  : filterKey === 'completed'
                  ? 'Completed Tasks'
                  : filterKey === 'pending'
                  ? 'Pending Tasks'
                  : contentType === 'archive'
                  ? 'All Files'
                  : contentType === 'note'
                  ? 'Notes'
                  : contentType === 'list'
                  ? 'Lists'
                  : 'All Tasks'
              }
              tasks={visibleTasks}
              page={safeCurrentPage}
              viewMode={preferences.taskView}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onUpdate={handleUpdateTask}
            />
            )}
          </div>
        )}

        <div className='flex w-full flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center'>
          <TaskListPagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p);
            }}
          />
          <DateTimeFilter
            value={timeFilter}
            onChange={(value) => {
              setTimeFilter(value);
              setCurrentPage(1);
            }}
            isArchive={contentType === 'archive'}
          />
        </div>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default HomePage;

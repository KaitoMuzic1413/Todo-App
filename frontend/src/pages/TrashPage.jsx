import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LayoutShell } from '@/components/LayoutShell';
import { clearTrash, deleteTaskPermanently, fetchTrashTasks, restoreTask } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';
import TaskListPagination from '@/components/TaskListPagination';

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

const TrashPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());
    syncUser();
    window.addEventListener('todo-auth-changed', syncUser);
    return () => window.removeEventListener('todo-auth-changed', syncUser);
  }, []);

  useEffect(() => {
    if (!currentUser?._id) {
      navigate('/login');
      return;
    }

    const loadTrash = async () => {
      try {
        setLoading(true);
        const response = await fetchTrashTasks(currentUser._id, {
          status: statusFilter,
          period: periodFilter,
        });
        setTasks(response.data || []);
        setPage(1);
      } catch (error) {
        console.error('Failed to load trash tasks', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrash();
  }, [currentUser, navigate, statusFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedTasks = useMemo(
    () => tasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [safePage, tasks]
  );

  const handleRestoreTask = async (taskId) => {
    if (!currentUser?._id) return;

    try {
      await restoreTask(taskId, currentUser._id);
      setTasks((previous) => previous.filter((task) => task._id !== taskId));
    } catch (error) {
      console.error('Failed to restore task', error);
    }
  };

  const handleDeletePermanently = async (taskId) => {
    if (!currentUser?._id) return;

    try {
      await deleteTaskPermanently(taskId, currentUser._id);
      setTasks((previous) => previous.filter((task) => task._id !== taskId));
    } catch (error) {
      console.error('Failed to delete task permanently', error);
    }
  };

  const handleClearTrash = async () => {
    if (!currentUser?._id) return;

    try {
      await clearTrash(currentUser._id);
      setTasks([]);
      setPage(1);
    } catch (error) {
      console.error('Failed to clear trash', error);
    }
  };

  if (!currentUser?._id) {
    return null;
  }

  const statusOptions = [
    { key: 'all', label: t.all },
    { key: 'complete', label: t.statusCompleted },
    { key: 'active', label: t.statusPending },
  ];

  const periodOptions = [
    { key: 'all', label: t.allTime },
    { key: 'today', label: t.today },
    { key: 'week', label: t.thisWeek },
    { key: 'month', label: t.thisMonth },
  ];

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <header className='flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-3 justify-center sm:justify-start w-full sm:w-auto'>
              <Trash2 className='h-8 w-8 text-violet-600' />
              <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.trashTitle}</h1>
            </div>

            <button
              type='button'
              onClick={handleClearTrash}
              disabled={!tasks.length}
              className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
            >
              {t.clearAllTrash}
            </button>
          </div>

          <div className='space-y-4'>
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'>
                {t.status}
              </p>
              <div className='relative inline-grid w-full grid-cols-3 gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto'>
                <div
                  className='pointer-events-none absolute inset-y-1 rounded-full bg-violet-600 shadow-[0_12px_30px_rgba(124,58,237,0.35)] transition-all duration-300 ease-out'
                  style={{
                    width: `calc(${100 / 3}% - 0.5rem)`,
                    left: `calc(${Math.max(0, ['all','complete','active'].indexOf(statusFilter)) * (100 / 3)}% + 0.25rem)`,
                  }}
                />

                {statusOptions.map(({ key, label }, idx) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setStatusFilter(key)}
                    className={`relative z-10 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === key
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'>
                {t.today}
              </p>
              <div className='relative inline-grid w-full grid-cols-4 gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto'>
                <div
                  className='pointer-events-none absolute inset-y-1 rounded-full bg-violet-600 shadow-[0_12px_30px_rgba(124,58,237,0.35)] transition-all duration-300 ease-out'
                  style={{
                    width: `calc(${100 / 4}% - 0.5rem)`,
                    left: `calc(${Math.max(0, ['all','today','week','month'].indexOf(periodFilter)) * (100 / 4)}% + 0.25rem)`,
                  }}
                />

                {periodOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setPeriodFilter(key)}
                    className={`relative z-10 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      periodFilter === key
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          {loading ? (
            <div className='py-8 text-center text-slate-500 dark:text-slate-300'>Loading trash...</div>
          ) : pagedTasks.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'>
              {t.noTasksInTrash}
            </div>
          ) : (
            <div className='space-y-3'>
              {pagedTasks.map((task) => (
                <div
                  key={task._id}
                  className='flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:flex-row sm:items-center sm:justify-between'
                >
                  <div className='min-w-0 flex-1'>
                    <p className={`truncate font-medium ${task.status === 'complete' ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                      {task.title}
                    </p>
                    <p className='mt-1 text-xs text-slate-500 dark:text-slate-300'>
                      {task.status === 'complete' ? t.statusCompleted : t.statusPending}
                    </p>
                  </div>

                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      onClick={() => handleRestoreTask(task._id)}
                      className='rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white'
                    >
                      {t.restore}
                    </button>
                    <button
                      type='button'
                      onClick={() => handleDeletePermanently(task._id)}
                      className='rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
                    >
                      {t.deletePermanently}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className='flex flex-col items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row'>
          <TaskListPagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>
    </LayoutShell>
  );
};

export default TrashPage;

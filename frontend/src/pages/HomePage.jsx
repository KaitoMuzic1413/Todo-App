import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import AddTask from '@/components/AddTask';
import DateTimeFilter from '@/components/DateTimeFilter';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import StatsAndFilters from '@/components/StatsAndFilters';
import TaskList from '@/components/TaskList';
import TaskListPagination from '@/components/TaskListPagination';
import { createTask, deleteTask, fetchTasks, toggleTaskStatus, updateTask, getUserQuota } from '@/lib/api';

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

const getDateRangeStart = (value) => {
  const now = new Date();

  if (!value || value === 'all') {
    return null;
  }

  if (value === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (value === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (value === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
};

const taskMatchesDateRange = (task, value) => {
  const minDate = getDateRangeStart(value);
  if (!minDate) return true;

  const candidateDates = [task?.createdAt, task?.updatedAt, task?.completedAt].filter(Boolean);

  return candidateDates.some((dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return date >= minDate;
  });
};

const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [quota, setQuota] = useState({ remaining: Infinity, allowed: 350, created: 0 });
  const [filterKey, setFilterKey] = useState('all');
  const [timeFilter, setTimeFilter] = useState('today');
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const [searchNotFound, setSearchNotFound] = useState(false);

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
      navigate('/login');
      return;
    }

    const loadTasks = async () => {
      try {
        setLoading(true);
        const response = await fetchTasks(currentUser._id);
        setTasks(response.data || []);
        setCurrentPage(1);

        try {
          const q = await getUserQuota(currentUser._id);
          setQuota(q.data || { remaining: Infinity });
        } catch (err) {
          console.warn('Failed to fetch quota', err);
        }
      } catch (error) {
        console.error('Failed to load tasks', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [currentUser, navigate]);

  const filteredTasks = useMemo(() => {
    let nextTasks = [...tasks];

    if (filterKey === 'important') {
      nextTasks = nextTasks.filter((task) => !!task.important);
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

  // -- handle search via URL ?search=term
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || window.location.search);
      const q = params.get('search')?.trim();
      if (!q) {
        setHighlightTaskId(null);
        setSearchNotFound(false);
        return;
      }

      const term = q.toLowerCase();

      // 1) try to find within current filteredTasks
      const idxInFiltered = filteredTasks.findIndex((t) => (t.title || '').toLowerCase().includes(term));
      if (idxInFiltered >= 0) {
        const page = Math.floor(idxInFiltered / PAGE_SIZE) + 1;
        setCurrentPage(page);
        const id = filteredTasks[idxInFiltered]._id;
        setHighlightTaskId(id);
        setSearchNotFound(false);

        // scroll to element after render
        setTimeout(() => {
          const el = document.getElementById(`task-${id}`);
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // remove highlight after 3s
          setTimeout(() => setHighlightTaskId(null), 3000);
        }, 200);

        // remove the search param so subsequent user actions are not overridden
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('search');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch (e) {
          try {
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
          } catch (e2) {
            /* ignore */
          }
        }

        return;
      }

      // 2) broaden: find in all tasks regardless of filters
      const idxInAll = tasks.findIndex((t) => (t.title || '').toLowerCase().includes(term));
      if (idxInAll >= 0) {
        // switch to All view and no time filter so user sees it in All
        setFilterKey('all');
        setTimeFilter('all');

        // compute index within all tasks (after setting filters we'll rely on tasks ordering)
        const page = Math.floor(idxInAll / PAGE_SIZE) + 1;
        setCurrentPage(page);
        const id = tasks[idxInAll]._id;
        setHighlightTaskId(id);
        setSearchNotFound(false);

        setTimeout(() => {
          const el = document.getElementById(`task-${id}`);
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => setHighlightTaskId(null), 3000);
        }, 300);

        // remove the search param so it doesn't keep forcing the view
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('search');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch (e) {
          try {
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
          } catch (e2) {
            /* ignore */
          }
        }

        return;
      }

      // not found
      setHighlightTaskId(null);
      setSearchNotFound(true);

      // clear search param even if not found so user can interact freely
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('search');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (e) {
        try {
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        } catch (e2) {
          /* ignore */
        }
      }
    } catch (err) {
      console.error('Search handling failed', err);
    }
  }, [filteredTasks, tasks, location.search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleTasks = useMemo(
    () => filteredTasks.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [safeCurrentPage, filteredTasks]
  );

  const handleAddTask = async (title) => {
    if (!currentUser?._id) return;

    if (quota.remaining !== Infinity && quota.remaining <= 0) {
      const go = window.confirm('Bạn đã hết lượt tạo task trong tuần. Muốn nâng cấp lên Premium?');
      if (go) navigate('/premium');
      return;
    }

    try {
      const response = await createTask({ userId: currentUser._id, title });
      setTasks((previous) => [response.data, ...previous]);
      setCurrentPage(1);

      try {
        const q = await getUserQuota(currentUser._id);
        setQuota(q.data || quota);
      } catch (err) {
        console.warn('Failed to refresh quota after create', err);
      }
    } catch (error) {
      console.error('Failed to create task', error);
      if (error?.response?.data?.code === 'quota_exceeded') {
        const go = window.confirm('Bạn đã hết lượt tạo task trong tuần. Muốn nâng cấp lên Premium?');
        if (go) navigate('/premium');
      }
    }
  };

  const handleToggleTask = async (taskId) => {
    if (!currentUser?._id) return;

    try {
      const response = await toggleTaskStatus(taskId, currentUser._id);
      setTasks((previous) =>
        previous.map((task) => (task._id === taskId ? response.data : task))
      );
    } catch (error) {
      console.error('Failed to toggle task', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!currentUser?._id) return;

    try {
      await deleteTask(taskId, currentUser._id);
      setTasks((previous) => previous.filter((task) => task._id !== taskId));
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleUpdateTask = async (taskId, nextTitle, payload = {}) => {
    if (!currentUser?._id) return;

    try {
      const body = { ...(payload || {}) };
      if (nextTitle !== undefined) {
        const trimmed = String(nextTitle || '').trim();
        if (!trimmed) return;
        body.title = trimmed;
      }

      const response = await updateTask(taskId, currentUser._id, body);
      setTasks((previous) =>
        previous.map((task) => (task._id === taskId ? response.data : task))
      );
    } catch (error) {
      console.error('Failed to update task', error);
    }
  };

  if (!currentUser?._id) {
    return null;
  }

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />

        <AddTask onAdd={handleAddTask} />

        <StatsAndFilters
          tasks={filteredTasks}
          activeFilter={filterKey}
          onFilterChange={(key) => {
            setFilterKey(key);
            setCurrentPage(1);
            setHighlightTaskId(null);
            setSearchNotFound(false);
          }}
        />

        {loading ? (
          <div className='rounded-[28px] border border-slate-200 bg-white/80 p-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
            Loading tasks...
          </div>
        ) : (
          <>
            {quota?.remaining !== Infinity && quota?.remaining <= 10 ? (
              <div className='mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
                Cảnh báo: Chỉ còn {quota.remaining} lượt tạo task trong tuần. Hãy cân nhắc nâng cấp Premium.
              </div>
            ) : null}

            <div className='space-y-4'>
              {filterKey === 'all' || filterKey === 'important' ? (
                <TaskList
                  title={filterKey === 'important' ? 'Important Tasks' : 'All Tasks'}
                  tasks={visibleTasks}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onUpdate={handleUpdateTask}
                  highlightTaskId={highlightTaskId}
                />
              ) : (
                <TaskList
                  title={filterKey === 'completed' ? 'Completed Tasks' : 'Pending Tasks'}
                  tasks={visibleTasks}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onUpdate={handleUpdateTask}
                  highlightTaskId={highlightTaskId}
                />
              )}
            </div>
          </>
        )}

        <div className='flex w-full flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center'>
          <TaskListPagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p);
              setHighlightTaskId(null);
              setSearchNotFound(false);
            }}
          />
          <DateTimeFilter
            value={timeFilter}
            onChange={(value) => {
              setTimeFilter(value);
              setCurrentPage(1);
              setHighlightTaskId(null);
              setSearchNotFound(false);
            }}
          />
        </div>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default HomePage;

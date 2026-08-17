import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import AddTask from '@/components/AddTask';
import DateTimeFilter from '@/components/DateTimeFilter';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import StatsAndFilters from '@/components/StatsAndFilters';
import TaskList from '@/components/TaskList';
import TaskListPagination from '@/components/TaskListPagination';
import { createTask, deleteTask, fetchTasks, toggleTaskStatus, updateTask } from '@/lib/api';

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
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterKey, setFilterKey] = useState('all');
  const [timeFilter, setTimeFilter] = useState('today');

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

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleTasks = useMemo(
    () => filteredTasks.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [safeCurrentPage, filteredTasks]
  );

  const handleAddTask = async (title) => {
    if (!currentUser?._id) return;

    try {
      const response = await createTask({ userId: currentUser._id, title });
      setTasks((previous) => [response.data, ...previous]);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to create task', error);
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
          }}
        />

        {loading ? (
          <div className='rounded-[28px] border border-slate-200 bg-white/80 p-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
            Loading tasks...
          </div>
        ) : (
          <div className='space-y-4'>
            <TaskList
              title={
                filterKey === 'important'
                  ? 'Important Tasks'
                  : filterKey === 'completed'
                  ? 'Completed Tasks'
                  : filterKey === 'pending'
                  ? 'Pending Tasks'
                  : 'All Tasks'
              }
              tasks={visibleTasks}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onUpdate={handleUpdateTask}
            />
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
          />
        </div>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default HomePage;
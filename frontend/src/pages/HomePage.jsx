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

const HomePage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visibleTasks = useMemo(
    () => tasks.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [safeCurrentPage, tasks]
  );

  const handleAddTask = async (title) => {
    if (!currentUser?._id) return;

    // enforce weekly limit of 350 creations per user (client-side enforcement)
    try {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const createdLast7Days = tasks.filter((t) => new Date(t.createdAt) >= weekAgo).length;
      const baseLimit = 350;
      // read any premium extra quota from localStorage (simulated purchase)
      const premium = JSON.parse(localStorage.getItem('todo-premium') || 'null');
      const extraQuota = premium && premium.expiresAt && premium.expiresAt > Date.now() ? (premium.extraQuota || premium.extra || 0) : 0;

      if (createdLast7Days >= baseLimit + extraQuota) {
        // redirect to premium page
        navigate('/premium');
        return;
      }

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

        <StatsAndFilters tasks={tasks} />

        {loading ? (
          <div className='rounded-[28px] border border-slate-200 bg-white/80 p-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70'>
            Loading tasks...
          </div>
        ) : (
          <TaskList tasks={visibleTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} onUpdate={handleUpdateTask} />
        )}

        <div className='flex flex-col items-center justify-between gap-6 sm:flex-row'>
          <TaskListPagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          <DateTimeFilter />
        </div>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default HomePage;

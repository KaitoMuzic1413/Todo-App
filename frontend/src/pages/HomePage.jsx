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

const HomePage = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [quota, setQuota] = useState({ remaining: Infinity, allowed: 350, created: 0 });
  const [filterKey, setFilterKey] = useState('all');

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

        // fetch quota
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

  // apply filter (all | important | pending | completed) - Bỏ lọc today
  const filteredTasks = useMemo(() => {
    if (!filterKey || filterKey === 'all') return tasks;
    if (filterKey === 'important') return tasks.filter((t) => !!t.important);
    if (filterKey === 'completed') return tasks.filter((t) => t.status === 'complete');
    if (filterKey === 'pending') return tasks.filter((t) => t.status !== 'complete');
    return tasks;
  }, [tasks, filterKey]);

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

        {/* Component StatsAndFilters cần đảm bảo ở bên trong nó đã ẩn nút Today */}
        <StatsAndFilters tasks={tasks} onFilterChange={(key) => { setFilterKey(key); setCurrentPage(1); }} />

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
                // Nếu ở All tasks hoặc Important: hiển thị gộp chung vào 1 danh sách duy nhất
                <TaskList title={filterKey === 'important' ? 'Important Tasks' : 'All Tasks'} tasks={visibleTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} onUpdate={handleUpdateTask} />
              ) : (
                // Nếu lọc riêng Pending hoặc Completed: hiển thị theo từng nhóm cụ thể
                <TaskList title={filterKey === 'completed' ? 'Completed Tasks' : 'Pending Tasks'} tasks={visibleTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} onUpdate={handleUpdateTask} />
              )}
            </div>
          </>
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
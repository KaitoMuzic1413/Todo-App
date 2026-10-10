import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchTasks } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const getStoredUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('todo-user') || 'null')?._id || null;
  } catch {
    return null;
  }
};

const DueTaskReminderWatcher = () => {
  const { t } = useLanguage();
  const [userId, setUserId] = useState(getStoredUserId);
  const checking = useRef(false);

  useEffect(() => {
    const syncUser = () => setUserId(getStoredUserId());
    window.addEventListener('todo-auth-changed', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('todo-auth-changed', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    const checkDueTasks = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const response = await fetchTasks(userId, 'task');
        const now = Date.now();
        const tasks = response.data || [];
        for (const task of tasks) {
          if (task.status === 'complete' || !task.dueAt) continue;
          const dueTime = new Date(task.dueAt).getTime();
          const remaining = dueTime - now;
          if (!Number.isFinite(dueTime) || remaining <= 0 || remaining > 30 * 60 * 1000) continue;

          const reminderKey = `todo-due-reminder:${userId}:${task._id}:${dueTime}`;
          if (localStorage.getItem(reminderKey)) continue;
          localStorage.setItem(reminderKey, 'sent');

          const taskTitle = task.title || t.newTask;
          if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(t.dueSoonTitle, {
              body: t.dueSoonBody.replace('{title}', taskTitle),
              tag: reminderKey,
            });
            notification.onclick = () => {
              window.focus();
              window.location.assign('/calendar');
            };
          } else {
            toast.info(t.dueSoonBody.replace('{title}', taskTitle));
          }
        }
      } catch {
        // Network errors are retried on the next poll.
      } finally {
        checking.current = false;
      }
    };

    checkDueTasks();
    const timer = window.setInterval(checkDueTasks, 60 * 1000);
    window.addEventListener('focus', checkDueTasks);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkDueTasks);
    };
  }, [userId, t]);

  return null;
};

export default DueTaskReminderWatcher;

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendarNotes, fetchCalendarTasks, fetchTasks } from '@/lib/api';
import { groupTasksByCalendarDay } from '@/lib/calendarUtils';
import { EMPTY_TASKS } from '@/lib/calendarPageHelpers';

const useCalendarData = ({
  currentUser,
  calendarDateKeys,
  calendarRange,
  calendarDays,
}) => {
  const calendarNotesQuery = useQuery({
    queryKey: ['calendarNotes', currentUser?._id, ...calendarDateKeys],
    queryFn: async () => (await fetchCalendarNotes(calendarDateKeys)).data || {},
    enabled: Boolean(currentUser?._id && calendarDateKeys.length),
  });

  const taskQuery = useQuery({
    queryKey: ['calendarTasks', currentUser?._id, calendarRange?.start, calendarRange?.endExclusive],
    queryFn: async () => (await fetchCalendarTasks(calendarRange)).data || [],
    enabled: Boolean(currentUser?._id && calendarRange),
  });

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
    () => allTasks.filter((task) => (
      !task.startAt
      && !task.dueAt
      && !task.calendarOccurrences?.length
      && task.status !== 'complete'
    )),
    [allTasks]
  );

  return {
    calendarNotesQuery,
    taskQuery,
    allTasksQuery,
    tasks,
    allTasks,
    taskByDate,
    unscheduledTasks,
  };
};

export default useCalendarData;

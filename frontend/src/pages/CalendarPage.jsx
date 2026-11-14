import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock,
  Combine,
  Copy,
  FileText,
  List,
  Move,
  Plus,
  Scissors,
  Split,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import SelectMenu from '@/components/ui/select-menu';
import DateTimePicker from '@/components/ui/date-time-picker';
import {
  createTask,
  deleteTask,
  fetchCalendarNotes,
  fetchCalendarTasks,
  fetchTasks,
  saveCalendarNote,
  updateTask,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import {
  buildCalendarMergeSegments,
  dateKey,
  getCalendarDays,
  getCalendarRange,
  getDayWarnings,
  buildCalendarTaskMerge,
  getCalendarTaskMergeRange,
  getOverlappingCellMerge,
  getSequentialUnmergeSchedule,
  getCalendarEventKey,
  getTaskCalendarOccurrences,
  mergeAdjacentSameTitleBlocks,
  planCalendarTaskPlacement,
  getTaskCalendarDisplay,
  resolveCellDragRange,
  getTaskDurationMinutes,
  getCalendarTaskBlockRange,
  isCalendarMergeOccupied,
  groupTasksByCalendarDay,
  splitCalendarTaskRange,
  startOfDay,
  toggleCalendarCellMerge,
} from '@/lib/calendarUtils';

const EMPTY_TASKS = [];
const HOURS_IN_DAY = Array.from({ length: 24 }, (_, i) => i);
const NEW_TASK_ID = '__new-task__';

// Timestamp helper used by pointer handlers (kept at module scope so the
// React Compiler purity rule doesn't flag Date.now() usage).
const nowMs = () => Date.now();

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

// Shared task-block bounds, matching exactly what the week/day grid renders.
const getTaskBlockBounds = (task) => {
  const startMs = new Date(task.startAt).getTime();
  return { startMs, endMs: startMs + getTaskDurationMinutes(task) * 60000 };
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { t, language, formatText } = useLanguage();
  const queryClient = useQueryClient();
  const [currentUser] = useState(getStoredUser);

  const [viewMode, setViewMode] = useState('week'); // 'month' | 'week' | 'day' | 'agenda'
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  const scheduleTaskSelectId = useId();
  const scheduleStartTimeId = useId();
  const scheduleDeadlineId = useId();
  const scheduleNewTitleId = useId();

  // Dialog State (Google Calendar-style Quick Note & Event Modal)
  const [activeModal, setActiveModal] = useState(null); // { mode: 'note' | 'task', date: Date, task: object | null }
  const [noteInput, setNoteInput] = useState('');
  const [taskScheduleForm, setTaskScheduleForm] = useState({
    taskId: '',
    startAt: '',
    dueAt: '',
    newTitle: '',
  });

  // Excel-style time grid selection (press & hold, drag, release for menu)
  const [cellSelection, setCellSelection] = useState(null); // { anchorDay, anchorHour, focusDay, focusHour }
  const [cellMenu, setCellMenu] = useState(null); // { x, y }
  const [cellsSelecting, setCellsSelecting] = useState(false);
  const [calendarClipboard, setCalendarClipboard] = useState(null); // { mode: 'copy' | 'cut', items: [...] }
  const [movingTask, setMovingTask] = useState(null); // { taskId, title, dayIndex, startHour, spanHours, durationMinutes, sourceMerge }
  const movingTaskRef = useRef(null);
  const [resizingTask, setResizingTask] = useState(null);
  const resizingTaskRef = useRef(null);
  const resizeDragMovedRef = useRef(false);
  const moveTaskCandidateRef = useRef(null);
  const moveDragActiveRef = useRef(false);
  const moveDragMovedRef = useRef(false);
  const moveDragStartRef = useRef({ x: 0, y: 0 });
  const isSelectingCellsRef = useRef(false);
  // Timestamp until which clicks are suppressed (right after a drag/long press).
  const suppressClickUntilRef = useRef(0);
  const cellDragAnchorRef = useRef(null);
  const cellDragFocusRef = useRef(null);
  const cellDragStartFocusRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const touchStartPositionRef = useRef(null);
  const lastTouchPositionRef = useRef(null);
  // Timestamp of the last fired long press (touch) — ignores the synthetic
  // mousedown/contextmenu the browser emits right after it.
  const longPressAtRef = useRef(0);
  const cellMenuRef = useRef(null);
  const noteHydratedKeyRef = useRef(null);
  const calendarGridRef = useRef(null);

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

  // Reset any cell selection when the visible calendar range changes.
  const calendarDateKeysSignature = useMemo(() => calendarDateKeys.join('|'), [calendarDateKeys]);
  const [selectionKeysSignature, setSelectionKeysSignature] = useState(calendarDateKeysSignature);
  if (selectionKeysSignature !== calendarDateKeysSignature) {
    setSelectionKeysSignature(calendarDateKeysSignature);
    if (cellMenu || cellSelection) {
      setCellMenu(null);
      setCellSelection(null);
    }
  }

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
    () => allTasks.filter((task) => (
      !task.startAt
      && !task.dueAt
      && !task.calendarOccurrences?.length
      && task.status !== 'complete'
    )),
    [allTasks]
  );

  const removeCalendarTask = async (task, occurrenceId = task.calendarOccurrenceId || 'primary') => {
    if (task.createdFromCalendar) {
      return deleteTask(task._id, currentUser._id);
    }
    if (occurrenceId !== 'primary') {
      return updateTask(task._id, currentUser._id, {
        removeCalendarOccurrenceId: occurrenceId,
      });
    }
    return updateTask(task._id, currentUser._id, {
      startAt: null,
      dueAt: null,
      estimatedMinutes: null,
      mergedTasks: null,
      clearMergedOccurrences: true,
    });
  };

  const splitCalendarTasksAtRange = useCallback(async (
    startMs,
    endMs,
    excludedEventKey,
    calendarTaskList = tasks
  ) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const mergeUpdates = new Map();
    const latestNotes = (await fetchCalendarNotes(calendarDateKeys)).data || {};
    const affectedTasks = getTaskCalendarOccurrences(calendarTaskList)
      .filter((task) => task.status !== 'complete'
        && getCalendarEventKey(task) !== excludedEventKey
        && task.startAt)
      .map((task) => {
        const taskStart = new Date(task.startAt);
        const taskDayKey = dateKey(taskStart);
        const merges = latestNotes[taskDayKey]?.merges || [];
        const effectiveRange = getCalendarTaskBlockRange(task, merges);
        if (!effectiveRange) return task;
        return {
          ...task,
          startAt: new Date(effectiveRange.startMs).toISOString(),
          dueAt: new Date(effectiveRange.endMs).toISOString(),
          estimatedMinutes: Math.round((effectiveRange.endMs - effectiveRange.startMs) / 60000),
        };
      })
      .filter((task) => {
        const rangeStart = new Date(task.startAt).getTime();
        return rangeStart < endMs
          && rangeStart + getTaskDurationMinutes(task) * 60000 > startMs;
      });

    for (const task of affectedTasks) {
      const occurrenceId = task.calendarOccurrenceId || 'primary';
      const taskStart = new Date(task.startAt);
      const taskEnd = new Date(taskStart.getTime() + getTaskDurationMinutes(task) * 60000);
      const taskDayKey = dateKey(taskStart);
      const remainingSegments = splitCalendarTaskRange(task, startMs, endMs);
      if (dateKey(new Date(taskEnd.getTime() - 1)) === taskDayKey) {
        const startHour = taskStart.getHours();
        const endHour = Math.min(23, Math.ceil(
          (taskEnd.getTime() - startOfDay(taskStart).getTime()) / 3600000
        ) - 1);
        const current = mergeUpdates.get(taskDayKey) || {
          key: taskDayKey,
          merges: (latestNotes[taskDayKey]?.merges || []).filter(
            (merge) => merge.startHour > endHour || merge.endHour < startHour
          ),
        };
        for (const segment of remainingSegments) {
          if (dateKey(new Date(segment.endMs - 1)) !== taskDayKey) continue;
          const segmentStart = new Date(segment.startMs);
          const segmentEnd = new Date(segment.endMs);
          const segmentStartHour = segmentStart.getHours();
          const segmentEndHour = Math.min(23, Math.ceil(
            (segmentEnd.getTime() - startOfDay(segmentStart).getTime()) / 3600000
          ) - 1);
          if (segmentEndHour > segmentStartHour) {
            current.merges.push({ startHour: segmentStartHour, endHour: segmentEndHour });
          }
        }
        mergeUpdates.set(taskDayKey, current);
      }
      const scheduleFor = ({ startMs: segmentStart, endMs: segmentEnd }) => ({
        startAt: new Date(segmentStart).toISOString(),
        dueAt: new Date(segmentEnd).toISOString(),
        estimatedMinutes: Math.max(1, Math.round((segmentEnd - segmentStart) / 60000)),
        timeZone,
      });
      await updateTask(task._id, currentUser._id, {
        replaceCalendarOccurrenceSegments: {
          occurrenceId,
          segments: remainingSegments.map(scheduleFor),
        },
      });
    }
    if (affectedTasks.length) {
      for (const update of mergeUpdates.values()) {
        const deduplicated = [...new Map(
          update.merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
        ).values()].sort((left, right) => left.startHour - right.startHour);
        update.merges = deduplicated;
        await saveCalendarNote(update.key, undefined, deduplicated);
      }
      if (mergeUpdates.size) {
        const notesQueryKey = ['calendarNotes', currentUser._id, ...calendarDateKeys];
        queryClient.setQueryData(notesQueryKey, (notes = {}) => ({
          ...notes,
          ...Object.fromEntries([...mergeUpdates].map(([key, update]) => [
            key,
            { ...notes[key], merges: update.merges },
          ])),
        }));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] }),
        queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] }),
      ]);
    }
    return [...mergeUpdates.values()];
  }, [calendarDateKeys, currentUser, queryClient, tasks]);

  const writeCalendarOccurrenceSegments = useCallback(async (
    taskId,
    occurrenceId,
    segments,
    timeZone
  ) => {
    if (!segments.length) {
      return occurrenceId !== 'primary'
        ? updateTask(taskId, currentUser._id, { removeCalendarOccurrenceId: occurrenceId })
        : updateTask(taskId, currentUser._id, {
            startAt: null,
            dueAt: null,
            estimatedMinutes: null,
            mergedTasks: null,
            clearMergedOccurrences: true,
          });
    }

    const toSchedule = ({ startMs, endMs, estimatedMinutes }) => ({
      startAt: new Date(startMs).toISOString(),
      dueAt: new Date(endMs).toISOString(),
      estimatedMinutes: estimatedMinutes
        || Math.max(1, Math.round((endMs - startMs) / 60000)),
      timeZone,
    });
    const response = await updateTask(taskId, currentUser._id, {
      replaceCalendarOccurrenceSegments: {
        occurrenceId,
        segments: segments.slice(0, 2).map(toSchedule),
      },
    });
    for (const segment of segments.slice(2)) {
      await updateTask(taskId, currentUser._id, {
        addCalendarOccurrence: toSchedule(segment),
      });
    }
    return response;
  }, [currentUser]);

  const writeCalendarPlacementChanges = useCallback(async (
    splitTasks,
    removedTasks,
    mergesByDate,
    timeZone
  ) => {
    const mergeUpdates = new Map();
    const getMerges = (key) => {
      if (!mergeUpdates.has(key)) {
        mergeUpdates.set(key, [...(mergesByDate[key]?.merges || [])]);
      }
      return mergeUpdates.get(key);
    };
    const getTaskMergeFrame = (task) => {
      if (!task?.startAt) return null;
      const start = new Date(task.startAt);
      const startHour = start.getHours();
      const endHour = Math.min(23, Math.ceil(
        (start.getTime() + getTaskDurationMinutes(task) * 60000 - startOfDay(start).getTime())
        / 3600000
      ) - 1);
      const dayKey = dateKey(start);
      const frame = getMerges(dayKey).find(
        (merge) => merge.startHour === startHour && merge.endHour >= endHour
      );
      return frame ? { dayKey, frame } : null;
    };
    const removeTaskMergeFrame = (task) => {
      const linked = getTaskMergeFrame(task);
      if (!linked) return false;
      mergeUpdates.set(linked.dayKey, getMerges(linked.dayKey).filter((merge) => !(
        merge.startHour === linked.frame.startHour
        && merge.endHour === linked.frame.endHour
      )));
      return true;
    };
    const addSegmentMergeFrames = (key, segments) => {
      const merges = getMerges(key);
      for (const segment of segments) {
        const start = new Date(segment.startMs);
        const end = new Date(segment.endMs);
        if (dateKey(start) !== key || dateKey(new Date(segment.endMs - 1)) !== key) continue;
        const startHour = start.getHours();
        const endHour = Math.min(23, Math.ceil(
          (end.getTime() - startOfDay(start).getTime()) / 3600000
        ) - 1);
        if (endHour > startHour) merges.push({ startHour, endHour });
      }
      mergeUpdates.set(key, [...new Map(
        merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
      ).values()].sort((left, right) => left.startHour - right.startHour));
    };

    for (const task of removedTasks) {
      removeTaskMergeFrame(task);
      await writeCalendarOccurrenceSegments(
        task._id,
        task.calendarOccurrenceId || 'primary',
        [],
        timeZone
      );
    }
    for (const { task, segments } of splitTasks) {
      const hadMergeFrame = removeTaskMergeFrame(task);
      await writeCalendarOccurrenceSegments(
        task._id,
        task.calendarOccurrenceId || 'primary',
        segments,
        timeZone
      );
      if (hadMergeFrame && segments.length) {
        addSegmentMergeFrames(dateKey(new Date(segments[0].startMs)), segments);
      }
    }

    if (mergeUpdates.size) {
      await Promise.all([...mergeUpdates].map(([key, merges]) => saveCalendarNote(key, undefined, merges)));
      await queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
    }
    return Object.fromEntries([...mergeUpdates].map(([key, merges]) => [
      key,
      { ...mergesByDate[key], merges },
    ]));
  }, [currentUser, queryClient, writeCalendarOccurrenceSegments]);

  const notesReady = !calendarNotesQuery.isLoading && !calendarNotesQuery.isError;

  // Hydrate a note once per opened modal. This prevents the empty modal from
  // overwriting an existing note when the notes query is still in flight.
  useEffect(() => {
    if (!activeModal?.date || !notesReady) return;
    const key = dateKey(activeModal.date);
    if (noteHydratedKeyRef.current === key) return;
    noteHydratedKeyRef.current = key;
    setNoteInput(calendarNotesQuery.data?.[key]?.content || '');
  }, [activeModal?.date, calendarNotesQuery.data, notesReady]);

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

  // Mutation: Merge / unmerge calendar cells (stored with the day note)
  const mergeCellsMutation = useMutation({
    mutationFn: ({ key, merges }) => saveCalendarNote(key, undefined, merges),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
    },
    onError: () => {
      toast.error(t.calendarNoteSaveError || 'Không thể lưu ghi chú ngày');
    },
  });

  const withCalendarTaskUpdates = useCallback((response) => {
    return {
      ...response,
      calendarTaskUpdates: [response.data].filter(Boolean),
    };
  }, []);

  // Mutation: Save Task Schedule (update existing task or create a new one)
  const scheduleMutation = useMutation({
    mutationFn: async ({ taskId, payload, create }) => {
      if (!create) {
        const response = await updateTask(taskId, currentUser._id, payload);
        if (payload?.addCalendarOccurrence) {
          return withCalendarTaskUpdates(response);
        }
        if (payload?.calendarOccurrenceId === 'primary' && payload.startAt) {
          return withCalendarTaskUpdates(response);
        }
        return response;
      }

      let response = await createTask(create);
      let createdTask = response.data;
      if (!createdTask?._id) {
        throw new Error('Task creation did not return a task.');
      }
      if (createdTask.reusedExistingTask) {
        return withCalendarTaskUpdates(response);
      }

      const matchesRequestedSchedule = (task) => {
        const matchesDate = (actual, expected) => expected
          ? new Date(actual).getTime() === new Date(expected).getTime()
          : !actual;
        return matchesDate(task.startAt, create.startAt) && matchesDate(task.dueAt, create.dueAt);
      };

      if (!matchesRequestedSchedule(createdTask)) {
        const scheduleResponse = await updateTask(createdTask._id, create.userId, {
          startAt: create.startAt,
          dueAt: create.dueAt,
          estimatedMinutes: create.estimatedMinutes,
          timeZone: create.timeZone,
        });
        createdTask = scheduleResponse.data;
        if (!matchesRequestedSchedule(createdTask)) {
          throw new Error('The task schedule was not saved.');
        }
        response = scheduleResponse;
      }

      return withCalendarTaskUpdates(response);
    },
    onSuccess: async (response, variables) => {
      if (variables.create && response.data?._id && calendarRange) {
        const calendarTasksKey = [
          'calendarTasks',
          currentUser?._id,
          calendarRange.start,
          calendarRange.endExclusive,
        ];
        await queryClient.cancelQueries({ queryKey: calendarTasksKey, exact: true });
        const updatedTasks = response.calendarTaskUpdates || [response.data];
        queryClient.setQueryData(calendarTasksKey, (currentTasks = []) => {
          const updatedById = new Map(updatedTasks.map((task) => [task._id, task]));
          const nextTasks = currentTasks.map((task) => updatedById.get(task._id) || task);
          const existingIds = new Set(nextTasks.map((task) => task._id));
          return [
            ...nextTasks,
            ...updatedTasks.filter((task) => !existingIds.has(task._id)),
          ];
        });
        await queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] }),
          queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] }),
        ]);
      }

      toast.success(variables.create
          ? (language === 'vi' ? 'Đã tạo công việc trong lịch' : 'Task added to calendar')
          : variables.payload?.addCalendarOccurrence
          ? t.calendarOccurrenceAdded
          : (language === 'vi' ? 'Đã cập nhật lịch công việc' : 'Schedule updated'));
      setActiveModal(null);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      toast.error(t.scheduleSaveError || 'Không thể lưu lịch');
    },
  });

  // ==================== Excel-style cell selection ====================
  const selectionRect = useMemo(() => {
    if (!cellSelection || !calendarDays.length) return null;
    const startDay = Math.min(cellSelection.anchorDay, cellSelection.focusDay);
    const endDay = Math.max(cellSelection.anchorDay, cellSelection.focusDay);
    const startHour = Math.min(cellSelection.anchorHour, cellSelection.focusHour);
    const endHour = Math.max(cellSelection.anchorHour, cellSelection.focusHour);

    const startDate = new Date(calendarDays[startDay] || calendarDays[0]);
    startDate.setHours(startHour, 0, 0, 0);
    const endDate = new Date(calendarDays[endDay] || calendarDays[calendarDays.length - 1]);
    endDate.setHours(endHour + 1, 0, 0, 0);

    return { startDay, endDay, startHour, endHour, startMs: startDate.getTime(), endMs: endDate.getTime() };
  }, [cellSelection, calendarDays]);

  const selectionTasks = useMemo(() => {
    if (!selectionRect) return EMPTY_TASKS;
    return getTaskCalendarOccurrences(tasks).filter((task) => {
      if (!task.startAt) return false;
      const { startMs, endMs } = getTaskBlockBounds(task);
      return startMs < selectionRect.endMs && endMs > selectionRect.startMs;
    });
  }, [tasks, selectionRect]);

  const selectionActionMutation = useMutation({
    mutationFn: async (actions) => {
      return Promise.all(actions.map((run) => run()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
    },
    onError: () => toast.error(t.error),
  });

  const deleteCalendarTaskMutation = useMutation({
    mutationFn: ({ taskId, occurrenceId, task }) =>
      removeCalendarTask(task || { _id: taskId }, occurrenceId || 'primary'),
    onSuccess: async (_response, variables) => {
      const { task } = variables;
      if (
        task
        && (
          task.mergedTasks?.length
          || task.mergedOccurrences?.length
          || getTaskDurationMinutes(task) > 60
        )
        && variables.date
      ) {
        const display = getTaskCalendarDisplay(task, variables.date);
        if (display?.kind === 'scheduled') {
          const dayKey = dateKey(variables.date);
          const mergeStartHour = new Date(display.startMs).getHours();
          const mergeEndHour = Math.min(
            23,
            Math.ceil(
              (display.endMs - startOfDay(variables.date).getTime()) / 3600000
            ) - 1
          );
          const notesQueryKey = ['calendarNotes', currentUser?._id, ...calendarDateKeys];
          const notes = await queryClient.ensureQueryData({
            queryKey: notesQueryKey,
            queryFn: async () => (await fetchCalendarNotes(calendarDateKeys)).data || {},
          });
          const existingMerges = notes[dayKey]?.merges || [];
          const nextMerges = existingMerges.filter(
            (merge) => merge.startHour > mergeEndHour || merge.endHour < mergeStartHour
          );
          await saveCalendarNote(dayKey, undefined, nextMerges);
          queryClient.setQueryData(notesQueryKey, {
            ...notes,
            [dayKey]: { ...notes[dayKey], merges: nextMerges },
          });
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] }),
        queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] }),
      ]);
      toast.success(task?.createdFromCalendar
        ? t.taskDeleted
        : t.calendarOccurrenceDeleted);
      setActiveModal(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || t.taskDeleteError);
    },
  });

  // Moving a task resolves the overlapping calendar cells before saving.
  const moveTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      targetTask,
      startMs,
      endMs,
      sourceEventKey,
      mergesByDate,
      sourceMerge,
      timeZone,
      groupMembers,
      groupStartMs,
    }) => {
      if (Array.isArray(groupMembers) && groupMembers.length > 1) {
        const deltaMs = startMs - groupStartMs;
        await Promise.all(groupMembers.map(({ task }) => {
          const originalStartMs = new Date(task.startAt).getTime();
          const durationMinutes = getTaskDurationMinutes(task);
          const shiftedStartMs = originalStartMs + deltaMs;
          return updateTask(task._id, currentUser._id, {
            startAt: new Date(shiftedStartMs).toISOString(),
            dueAt: new Date(shiftedStartMs + durationMinutes * 60000).toISOString(),
            estimatedMinutes: durationMinutes,
            timeZone,
            calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
          });
        }));
        return { movedGroup: true, moveKey: sourceEventKey };
      }

      const currentCalendarTasks = calendarRange
        ? (await fetchCalendarTasks(calendarRange)).data || []
        : tasks;
      const candidate = {
        ...targetTask,
        startAt: new Date(startMs).toISOString(),
        estimatedMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
      };
      const placement = planCalendarTaskPlacement(
        currentCalendarTasks,
        candidate,
        mergesByDate,
        sourceEventKey
      );
      if (!placement) throw new Error('Unable to calculate the task schedule.');

      const moveKey = sourceEventKey;
      const sourceOccurrenceId = targetTask.calendarOccurrenceId || 'primary';
      const mergeUpdates = new Map();
      const getMerges = (key) => {
        if (!mergeUpdates.has(key)) {
          mergeUpdates.set(key, [...(mergesByDate[key]?.merges || [])]);
        }
        return mergeUpdates.get(key);
      };
      const getTaskMergeFrame = (task) => {
        if (!task?.startAt) return null;
        const start = new Date(task.startAt);
        const startHour = start.getHours();
        const endHour = Math.min(23, Math.ceil(
          (start.getTime() + getTaskDurationMinutes(task) * 60000 - startOfDay(start).getTime())
          / 3600000
        ) - 1);
        const dayKey = dateKey(start);
        const frame = getMerges(dayKey).find(
          (merge) => merge.startHour === startHour && merge.endHour >= endHour
        );
        return frame ? { dayKey, frame } : null;
      };
      const removeTaskMergeFrame = (task) => {
        const linked = getTaskMergeFrame(task);
        if (!linked) return false;
        mergeUpdates.set(linked.dayKey, getMerges(linked.dayKey).filter((merge) => !(
          merge.startHour === linked.frame.startHour
          && merge.endHour === linked.frame.endHour
        )));
        return true;
      };
      const addSegmentMergeFrames = (key, segments) => {
        const merges = getMerges(key);
        for (const segment of segments) {
          const start = new Date(segment.startMs);
          const end = new Date(segment.endMs);
          if (dateKey(start) !== key || dateKey(new Date(segment.endMs - 1)) !== key) continue;
          const startHour = start.getHours();
          const endHour = Math.min(23, Math.ceil(
            (end.getTime() - startOfDay(start).getTime()) / 3600000
          ) - 1);
          if (endHour > startHour) merges.push({ startHour, endHour });
        }
        mergeUpdates.set(key, [...new Map(
          merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
        ).values()].sort((left, right) => left.startHour - right.startHour));
      };

      if (!placement.segments.length) {
        await writeCalendarOccurrenceSegments(taskId, sourceOccurrenceId, [], timeZone);
        if (sourceMerge) {
          mergeUpdates.set(sourceMerge.dayKey, getMerges(sourceMerge.dayKey).filter((merge) => !(
            merge.startHour === sourceMerge.startHour
            && merge.endHour === sourceMerge.endHour
          )));
          await Promise.all([...mergeUpdates].map(([key, merges]) => saveCalendarNote(key, undefined, merges)));
          await queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
        }
        return { dropped: true, moveKey };
      }

      const winner = placement.survivor;
      const winnerKey = getCalendarEventKey(winner);
      const winnerSegments = placement.segments.map((segment) => ({
        ...segment,
        estimatedMinutes: segment.estimatedMinutes
          || Math.max(1, Math.round((segment.endMs - segment.startMs) / 60000)),
      }));
      const placementMerge = placement.absorbedTasks.length
        ? buildCalendarTaskMerge(
            [...new Map(
              [winner, targetTask, ...placement.absorbedTasks]
                .map((task) => [getCalendarEventKey(task), task])
            ).values()],
            startMs,
            startMs + placement.durationMinutes * 60000
          )
        : null;
      const winnerHadMergeFrame = removeTaskMergeFrame(winner);
      const response = await writeCalendarOccurrenceSegments(
        winner._id,
        winner.calendarOccurrenceId || 'primary',
        winnerSegments,
        timeZone
      );
      if (placementMerge) {
        await updateTask(winner._id, currentUser._id, {
          title: placementMerge.title,
          mergedTasks: placementMerge.snapshot,
          calendarOccurrenceId: winner.calendarOccurrenceId || 'primary',
        });
      }
      if (winnerHadMergeFrame) {
        addSegmentMergeFrames(dateKey(new Date(winnerSegments[0].startMs)), winnerSegments);
      }

      for (const { task, segments } of placement.splitTasks) {
        const hadMergeFrame = removeTaskMergeFrame(task);
        await writeCalendarOccurrenceSegments(
          task._id,
          task.calendarOccurrenceId || 'primary',
          segments,
          timeZone
        );
        if (hadMergeFrame && segments.length) {
          addSegmentMergeFrames(dateKey(new Date(segments[0].startMs)), segments);
        }
      }

      const toRemove = new Map(
        placement.sameTitleTasks
          .filter((task) => getCalendarEventKey(task) !== winnerKey)
          .map((task) => [getCalendarEventKey(task), task])
      );
      if (moveKey !== winnerKey && placement.sameTitleTasks.length) {
        toRemove.set(moveKey, {
          _id: taskId,
          calendarOccurrenceId: sourceOccurrenceId,
        });
      }
      for (const task of placement.absorbedTasks) {
        toRemove.set(getCalendarEventKey(task), task);
      }
      for (const task of toRemove.values()) {
        removeTaskMergeFrame(task);
        await writeCalendarOccurrenceSegments(
          task._id,
          task.calendarOccurrenceId || 'primary',
          [],
          timeZone
        );
      }

      if (sourceMerge) {
        const sourceKey = sourceMerge.dayKey;
        const targetKey = dateKey(new Date(startMs));
        mergeUpdates.set(sourceKey, getMerges(sourceKey).filter((merge) => !(
          merge.startHour === sourceMerge.startHour
          && merge.endHour === sourceMerge.endHour
        )));
        const nextTargetMerges = getMerges(targetKey).filter((merge) => !placement.segments.some((segment) => {
          const segmentStart = new Date(segment.startMs);
          const segmentEnd = new Date(segment.endMs - 1);
          return dateKey(segmentStart) === targetKey
            && dateKey(segmentEnd) === targetKey
            && merge.startHour <= segmentEnd.getHours()
            && merge.endHour >= segmentStart.getHours();
        }));
        mergeUpdates.set(targetKey, nextTargetMerges);
        addSegmentMergeFrames(targetKey, placement.segments);
      }
      if (mergeUpdates.size) {
        await Promise.all([...mergeUpdates].map(([key, merges]) => saveCalendarNote(key, undefined, merges)));
        await queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      }

      const mergedResponse = withCalendarTaskUpdates(response);
      return {
        ...mergedResponse,
        placementSplit: winnerSegments.length > 1,
        placementWinnerKey: winnerKey,
        moveKey,
      };
    },
    onSuccess: (response) => {
      if (response?.movedGroup) {
        movingTaskRef.current = null;
        setMovingTask(null);
      } else if (response?.dropped) {
        movingTaskRef.current = null;
        setMovingTask(null);
        toast.info(language === 'vi'
          ? 'Task đã được bỏ khỏi lịch vì toàn bộ thời gian bị task khác chiếm.'
          : 'The task was removed from the calendar because another task occupies its entire schedule.');
      } else if (
        response?.placementSplit
        || response?.placementWinnerKey !== response?.moveKey
      ) {
        movingTaskRef.current = null;
        setMovingTask(null);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
    },
    onError: (error) => {
      movingTaskRef.current = null;
      setMovingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] });
      queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      toast.error(
        error.response?.data?.message
        || error.message
        || t.scheduleSaveError
        || 'Không thể lưu lịch'
      );
    },
  });

  const closeCellMenu = useCallback(() => {
    setCellMenu(null);
    setCellSelection(null);
  }, []);

  const cancelCellDrag = useCallback(() => {
    isSelectingCellsRef.current = false;
    setCellsSelecting(false);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Mobile has no right click: long-press starts a cell selection, then
  // dragging expands it and releasing opens the mini menu.
  const startLongPress = (event, dayIndex, startHour, endHour) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    clearLongPress();
    const x = touch.clientX;
    const y = touch.clientY;
    touchStartPositionRef.current = { x, y };
    lastTouchPositionRef.current = { x, y };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressAtRef.current = nowMs();
      isSelectingCellsRef.current = true;
      setCellsSelecting(true);
      cellDragAnchorRef.current = {
        dayIndex,
        hour: startHour,
        rangeStart: startHour,
        rangeEnd: endHour,
      };
      cellDragFocusRef.current = { dayIndex, hour: endHour, anchorHour: startHour };
      cellDragStartFocusRef.current = { dayIndex, hour: endHour };
      setCellMenu(null);
      setCellSelection({ anchorDay: dayIndex, anchorHour: startHour, focusDay: dayIndex, focusHour: endHour });
    }, 450);
  };

  // Consume the "this click came right after a long press / drag" window.
  const consumeSuppressedClick = () => {
    if (nowMs() >= suppressClickUntilRef.current) return false;
    suppressClickUntilRef.current = 0;
    return true;
  };

  // Start a cell drag. `endHour` lets a merged region act as one big cell:
  // pressing anywhere inside it selects the whole region immediately.
  const beginCellDrag = (event, dayIndex, hour, endHour = hour) => {
    if (event.button !== 0 || nowMs() - longPressAtRef.current < 800) return;
    moveTaskCandidateRef.current = null;
    if (movingTaskRef.current) {
      moveDragActiveRef.current = false;
      movingTaskRef.current = null;
      setMovingTask(null);
    }
    isSelectingCellsRef.current = true;
    setCellsSelecting(true);
    cellDragAnchorRef.current = {
      dayIndex,
      hour,
      rangeStart: hour,
      rangeEnd: endHour,
    };
    cellDragFocusRef.current = { dayIndex, hour: endHour, anchorHour: hour };
    cellDragStartFocusRef.current = { dayIndex, hour: endHour };
    setCellSelection({ anchorDay: dayIndex, anchorHour: hour, focusDay: dayIndex, focusHour: endHour });
  };

  const beginMoveTaskDrag = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    moveDragActiveRef.current = true;
    moveDragMovedRef.current = false;
    moveDragStartRef.current = { x: event.clientX, y: event.clientY };
    setCellsSelecting(true);
  };

  const beginTaskResize = (event, task, dayIndex, edge) => {
    if (event.button !== 0 || !task.startAt) return;
    event.preventDefault();
    event.stopPropagation();
    const startMs = new Date(task.startAt).getTime();
    if (!Number.isFinite(startMs)) return;
    const endMs = startMs + getTaskDurationMinutes(task) * 60000;
    const startHour = new Date(startMs).getHours();
    const endHour = Math.min(23, Math.max(startHour, Math.ceil(
      (endMs - startOfDay(new Date(startMs)).getTime()) / 3600000
    ) - 1));
    const resize = {
      taskId: task._id,
      calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
      dayIndex,
      edge,
      startHour,
      endHour,
      title: task.title,
      originalStartMs: startMs,
    };
    resizingTaskRef.current = resize;
    resizeDragMovedRef.current = false;
    setResizingTask(resize);
    cancelCellDrag();
    setCellsSelecting(true);
    moveTaskCandidateRef.current = null;
  };

  const getTaskResizeEdgeAtPoint = (event) => {
    const wrapper = event.currentTarget;
    const card = wrapper.querySelector('[data-task-card]');
    if (!card) return null;

    const rect = wrapper.getBoundingClientRect();
    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;
    if (!rect.width || !rect.height || !width || !height) return null;

    const radius = Number.parseFloat(window.getComputedStyle(card).borderTopLeftRadius);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    const radiusX = Math.min(radius * rect.width / width, rect.width / 2);
    const radiusY = Math.min(radius * rect.height / height, rect.height / 2);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    let corner = null;
    let normalizedX = 0;
    let normalizedY = 0;
    if (x < radiusX && y < radiusY) {
      corner = 'top';
      normalizedX = (x - radiusX) / radiusX;
      normalizedY = (y - radiusY) / radiusY;
    } else if (x > rect.width - radiusX && y < radiusY) {
      corner = 'top';
      normalizedX = (x - (rect.width - radiusX)) / radiusX;
      normalizedY = (y - radiusY) / radiusY;
    } else if (x < radiusX && y > rect.height - radiusY) {
      corner = 'bottom';
      normalizedX = (x - radiusX) / radiusX;
      normalizedY = (y - (rect.height - radiusY)) / radiusY;
    } else if (x > rect.width - radiusX && y > rect.height - radiusY) {
      corner = 'bottom';
      normalizedX = (x - (rect.width - radiusX)) / radiusX;
      normalizedY = (y - (rect.height - radiusY)) / radiusY;
    }

    return corner && normalizedX ** 2 + normalizedY ** 2 > 1
      ? (corner === 'top' ? 'start' : 'end')
      : null;
  };

  const updateResizingTaskFromPoint = useCallback((clientX, clientY) => {
    const current = resizingTaskRef.current;
    const grid = calendarGridRef.current;
    if (!current || !grid) return;
    const hitDay = document.elementFromPoint(clientX, clientY)
      ?.closest('[data-calendar-day-index]');
    if (Number(hitDay?.dataset.calendarDayIndex) !== current.dayIndex) return;
    const dayColumn = hitDay.getBoundingClientRect();
    if (!dayColumn.height) return;
    const rawHour = Math.floor(((clientY - dayColumn.top) / dayColumn.height) * 24);
    const next = current.edge === 'start'
      ? { ...current, startHour: Math.max(0, Math.min(current.endHour, rawHour)) }
      : { ...current, endHour: Math.max(current.startHour, Math.min(23, rawHour)) };
    if (next.startHour === current.startHour && next.endHour === current.endHour) return;
    resizeDragMovedRef.current = true;
    resizingTaskRef.current = next;
    setResizingTask(next);
  }, []);

  const beginTaskCellDrag = (
    event, task, dayIndex, date, startHour, endHour, sourceMerge,
    blockMembers = [], blockStartMs = null, blockEndMs = null
  ) => {
    if (
      event.button !== 0
      || nowMs() - longPressAtRef.current < 800
      || (blockMembers.length <= 1 && (
        !task.startAt
        || dateKey(new Date(task.startAt)) !== dateKey(date)
      ))
    ) return;

    beginCellDrag(event, dayIndex, startHour, endHour);

    moveDragStartRef.current = { x: event.clientX, y: event.clientY };
    if (blockMembers.length > 1 && Number.isFinite(blockStartMs) && Number.isFinite(blockEndMs)) {
      const spanHours = Math.max(1, Math.ceil((blockEndMs - blockStartMs) / 3600000));
      const blockStartHour = Math.floor((blockStartMs - startOfDay(date).getTime()) / 3600000);
      const gridRect = calendarGridRef.current?.getBoundingClientRect();
      const pointerHour = gridRect?.height
        ? Math.floor(((event.clientY - gridRect.top) / gridRect.height) * 24)
        : blockStartHour;
      moveTaskCandidateRef.current = {
        taskId: task._id,
        calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
        title: task.title,
        createdAt: task.createdAt,
        status: task.status,
        dayIndex,
        startHour: blockStartHour,
        endHour: blockStartHour + spanHours - 1,
        spanHours,
        grabOffsetHours: Math.max(0, Math.min(spanHours - 1, pointerHour - blockStartHour)),
        durationMinutes: spanHours * 60,
        sourceMerge: null,
        groupStartMs: blockStartMs,
        groupMembers: blockMembers,
      };
      return;
    }
    const durationMinutes = getTaskDurationMinutes(task);
    const initialSpan = Math.max(1, Math.ceil(durationMinutes / 60));
    const taskStartHour = new Date(task.startAt).getHours();
    const taskMerge = sourceMerge?.startHour === taskStartHour
      && sourceMerge.endHour >= taskStartHour + initialSpan - 1
      ? sourceMerge
      : null;
    const spanHours = taskMerge
      ? taskMerge.endHour - taskMerge.startHour + 1
      : initialSpan;
    const targetStartHour = taskMerge ? taskMerge.startHour : taskStartHour;
    const gridRect = calendarGridRef.current?.getBoundingClientRect();
    const pointerHour = gridRect?.height
      ? Math.floor(((event.clientY - gridRect.top) / gridRect.height) * 24)
      : targetStartHour;
    moveTaskCandidateRef.current = {
      taskId: task._id,
      calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
      title: task.title,
      createdAt: task.createdAt,
      status: task.status,
      dayIndex,
      startHour: targetStartHour,
      endHour: targetStartHour + spanHours - 1,
      spanHours,
      grabOffsetHours: Math.max(0, Math.min(spanHours - 1, pointerHour - targetStartHour)),
      durationMinutes: sourceMerge ? spanHours * 60 : durationMinutes,
      sourceMerge: taskMerge
        ? {
            dayKey: dateKey(date),
            startHour: taskMerge.startHour,
            endHour: taskMerge.endHour,
            spanHours,
          }
        : null,
    };
  };

  const updateCellSelectionFromPoint = useCallback((clientX, clientY) => {
    if (!isSelectingCellsRef.current) return;
    const anchor = cellDragAnchorRef.current;
    const grid = calendarGridRef.current;
    if (!anchor || !grid) return;

    const rect = grid.getBoundingClientRect();
    if (!rect.height) return;
    const hitElement = document.elementFromPoint(clientX, clientY);
    const hitDay = hitElement?.closest('[data-calendar-day-index]');
    const isAnchorDay = Number(hitDay?.dataset.calendarDayIndex) === anchor.dayIndex;
    const hour = Math.max(0, Math.min(23, Math.floor((clientY - rect.top) / 56)));
    const dayKey = calendarDateKeys[anchor.dayIndex];
    const merges = calendarNotesQuery.data?.[dayKey]?.merges || [];
    const calendarMerge = merges.find(
      (range) => hour >= range.startHour && hour <= range.endHour
    );
    const mergedRange = isAnchorDay
      ? hitElement?.closest('[data-calendar-range-start][data-calendar-range-end]')
      : null;
    const hitStart = Number(mergedRange?.dataset.calendarRangeStart);
    const hitEnd = Number(mergedRange?.dataset.calendarRangeEnd);
    const merge = Number.isInteger(hitStart) && Number.isInteger(hitEnd)
      ? { startHour: hitStart, endHour: hitEnd }
      : calendarMerge;
    const { anchorHour, focusHour } = resolveCellDragRange(
      anchor.rangeStart ?? anchor.hour,
      anchor.rangeEnd ?? anchor.hour,
      merge ? merge.startHour : hour,
      merge ? merge.endHour : hour
    );

    const focus = cellDragFocusRef.current;
    if (
      focus?.dayIndex === anchor.dayIndex
      && focus.hour === focusHour
      && focus.anchorHour === anchorHour
    ) return;
    cellDragFocusRef.current = { dayIndex: anchor.dayIndex, hour: focusHour, anchorHour };
    setCellSelection((current) => (
      current
        ? { ...current, anchorHour, focusDay: anchor.dayIndex, focusHour }
        : current
    ));
  }, [calendarDateKeys, calendarNotesQuery.data]);

  const updateMovingTaskFromPoint = useCallback((clientX, clientY) => {
    const grid = calendarGridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dayCount = calendarDays.length || 1;
    const hitDay = document.elementFromPoint(clientX, clientY)?.closest('[data-calendar-day-index]');
    const hitDayIndex = Number(hitDay?.dataset.calendarDayIndex);
    const proportionalDayIndex = Math.floor(((clientX - rect.left) / rect.width) * dayCount);
    const dayIndex = Number.isInteger(hitDayIndex)
      ? hitDayIndex
      : Math.max(0, Math.min(dayCount - 1, proportionalDayIndex));
    const rawHour = Math.floor(((clientY - rect.top) / rect.height) * 24);

    const current = movingTaskRef.current;
    if (!current) return;
    const startHour = Math.max(
      0,
      Math.min(24 - current.spanHours, rawHour - (current.grabOffsetHours || 0))
    );
    if (current.dayIndex === dayIndex && current.startHour === startHour) return;
    const next = {
      ...current,
      dayIndex,
      startHour,
      endHour: startHour + current.spanHours - 1,
    };
    movingTaskRef.current = next;
    setMovingTask(next);
  }, [calendarDays.length]);

  // Resolve the drag target from the grid geometry on every mouse move. The
  // merged/task overlays sit above the hour cells, so relying on each cell's
  // mouseenter misses cells and makes the selection stop at the merge edge.
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (resizingTaskRef.current) {
        updateResizingTaskFromPoint(event.clientX, event.clientY);
        return;
      }
      if (moveDragActiveRef.current) {
        if (!moveDragMovedRef.current) {
          const start = moveDragStartRef.current;
          moveDragMovedRef.current = Math.hypot(
            event.clientX - start.x,
            event.clientY - start.y
          ) > 3;
        }
        updateMovingTaskFromPoint(event.clientX, event.clientY);
        return;
      }

      const moveCandidate = moveTaskCandidateRef.current;
      if (moveCandidate) {
        const grid = calendarGridRef.current;
        const hitDay = document.elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-calendar-day-index]');
        const hitDayIndex = Number(hitDay?.dataset.calendarDayIndex);
        const deltaX = event.clientX - moveDragStartRef.current.x;
        const deltaY = event.clientY - moveDragStartRef.current.y;
        const horizontalDrag = Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY);
        const verticalDrag = Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX);
        if (verticalDrag) {
          moveTaskCandidateRef.current = null;
        }
        if (
          grid
          && horizontalDrag
          && Number.isInteger(hitDayIndex)
          && hitDayIndex !== moveCandidate.dayIndex
        ) {
          moveTaskCandidateRef.current = null;
          moveDragActiveRef.current = true;
          moveDragMovedRef.current = true;
          cancelCellDrag();
          setCellSelection(null);
          setCellMenu(null);
          movingTaskRef.current = moveCandidate;
          setMovingTask(moveCandidate);
          setCellsSelecting(true);
          updateMovingTaskFromPoint(event.clientX, event.clientY);
          return;
        }
      }

      updateCellSelectionFromPoint(event.clientX, event.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointermove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointermove', handleMouseMove);
    };
  }, [
    cancelCellDrag,
    updateCellSelectionFromPoint,
    updateMovingTaskFromPoint,
    updateResizingTaskFromPoint,
  ]);

  useEffect(() => {
    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;

      lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY };
      if (!isSelectingCellsRef.current) {
        const start = touchStartPositionRef.current;
        if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) {
          clearLongPress();
        }
        return;
      }

      if (event.cancelable) event.preventDefault();
      updateCellSelectionFromPoint(touch.clientX, touch.clientY);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => window.removeEventListener('touchmove', handleTouchMove);
  }, [clearLongPress, updateCellSelectionFromPoint]);

  useLayoutEffect(() => {
    movingTaskRef.current = movingTask;
  }, [movingTask]);

  const commitMovingTask = useCallback(() => {
    const move = movingTaskRef.current;
    if (!move) return;
    const targetDay = calendarDays[move.dayIndex];
    if (!targetDay) return;

    const start = new Date(targetDay);
    start.setHours(move.startHour, 0, 0, 0);
    const due = new Date(start.getTime() + move.durationMinutes * 60000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const sourceEventKey = getCalendarEventKey({
      _id: move.taskId,
      calendarOccurrenceId: move.calendarOccurrenceId || 'primary',
    });

    moveTaskMutation.mutate({
      taskId: move.taskId,
      startMs: start.getTime(),
      endMs: due.getTime(),
      sourceEventKey,
      mergesByDate: calendarNotesQuery.data || {},
      sourceMerge: move.sourceMerge,
      timeZone,
      groupMembers: move.groupMembers,
      groupStartMs: move.groupStartMs,
      targetTask: {
        _id: move.taskId,
        title: move.title,
        createdAt: move.createdAt,
        status: move.status,
        calendarOccurrenceId: move.calendarOccurrenceId || 'primary',
        startAt: start.toISOString(),
        dueAt: due.toISOString(),
        estimatedMinutes: move.durationMinutes,
      },
    });

    const nextMoving = {
      ...move,
      endHour: move.startHour + move.spanHours - 1,
      sourceMerge: move.sourceMerge
        ? {
            ...move.sourceMerge,
            dayKey: calendarDateKeys[move.dayIndex],
            startHour: move.startHour,
            endHour: move.startHour + move.sourceMerge.spanHours - 1,
          }
        : null,
    };
    movingTaskRef.current = nextMoving;
    setMovingTask(nextMoving);
  }, [calendarDateKeys, calendarDays, calendarNotesQuery.data, moveTaskMutation]);

  const commitTaskResize = useCallback(async (resize) => {
    const day = calendarDays[resize.dayIndex];
    if (!day) {
      setResizingTask(null);
      return;
    }
    const start = new Date(day);
    start.setHours(resize.startHour, 0, 0, 0);
    const due = new Date(day);
    due.setHours(resize.endHour + 1, 0, 0, 0);
    const durationMinutes = Math.round((due.getTime() - start.getTime()) / 60000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dayKey = calendarDateKeys[resize.dayIndex];
    const eventKey = getCalendarEventKey({
      _id: resize.taskId,
      calendarOccurrenceId: resize.calendarOccurrenceId,
    });

    try {
      await splitCalendarTasksAtRange(start.getTime(), due.getTime(), eventKey);
      const latestNotes = (await fetchCalendarNotes([dayKey])).data || {};
      const currentMerges = latestNotes[dayKey]?.merges || [];
      const nextMerges = currentMerges.filter((merge) => !(
        merge.startHour <= resize.endHour && merge.endHour >= resize.startHour
      ));
      if (resize.endHour > resize.startHour) {
        nextMerges.push({ startHour: resize.startHour, endHour: resize.endHour });
      }
      await saveCalendarNote(dayKey, undefined, nextMerges);
      await updateTask(resize.taskId, currentUser._id, {
        startAt: start.toISOString(),
        dueAt: due.toISOString(),
        estimatedMinutes: durationMinutes,
        timeZone,
        calendarOccurrenceId: resize.calendarOccurrenceId,
        clearMergedOccurrences: true,
        ...(resize.calendarOccurrenceId === 'primary' ? { mergedTasks: null } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', currentUser?._id] }),
        queryClient.invalidateQueries({ queryKey: ['calendarTasks', currentUser?._id] }),
        queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] }),
      ]);
      toast.success(language === 'vi' ? 'Đã thay đổi kích thước công việc' : 'Task resized');
    } catch (error) {
      toast.error(error.response?.data?.message || t.scheduleSaveError || 'Không thể lưu lịch');
    } finally {
      setResizingTask(null);
    }
  }, [
    calendarDateKeys,
    calendarDays,
    currentUser,
    language,
    queryClient,
    splitCalendarTasksAtRange,
    t.scheduleSaveError,
  ]);

  useEffect(() => {
    const handleResizeMouseUp = () => {
      const resize = resizingTaskRef.current;
      if (!resize) return;
      resizingTaskRef.current = null;
      setCellsSelecting(false);
      if (resizeDragMovedRef.current) {
        suppressClickUntilRef.current = nowMs() + 600;
        void commitTaskResize(resize);
      } else {
        setResizingTask(null);
      }
    };
    const handleResizeEscape = (event) => {
      if (event.key !== 'Escape' || !resizingTaskRef.current) return;
      resizingTaskRef.current = null;
      resizeDragMovedRef.current = false;
      setResizingTask(null);
      setCellsSelecting(false);
    };
    const handleResizeCancel = () => {
      if (!resizingTaskRef.current) return;
      resizingTaskRef.current = null;
      resizeDragMovedRef.current = false;
      setResizingTask(null);
      setCellsSelecting(false);
    };
    window.addEventListener('mouseup', handleResizeMouseUp);
    window.addEventListener('pointerup', handleResizeMouseUp);
    window.addEventListener('pointercancel', handleResizeCancel);
    window.addEventListener('keydown', handleResizeEscape);
    return () => {
      window.removeEventListener('mouseup', handleResizeMouseUp);
      window.removeEventListener('pointerup', handleResizeMouseUp);
      window.removeEventListener('pointercancel', handleResizeCancel);
      window.removeEventListener('keydown', handleResizeEscape);
    };
  }, [commitTaskResize]);

  useEffect(() => {
    const handleMoveMouseUp = () => {
      if (!moveDragActiveRef.current) return;
      moveDragActiveRef.current = false;
      setCellsSelecting(false);
      if (!moveDragMovedRef.current) return;
      suppressClickUntilRef.current = nowMs() + 600;
      commitMovingTask();
    };

    window.addEventListener('mouseup', handleMoveMouseUp);
    return () => window.removeEventListener('mouseup', handleMoveMouseUp);
  }, [commitMovingTask]);

  useEffect(() => {
    const handleMoveEscape = (event) => {
      if (event.key !== 'Escape' || !movingTaskRef.current) return;
      moveDragActiveRef.current = false;
      movingTaskRef.current = null;
      setCellsSelecting(false);
      setMovingTask(null);
    };

    window.addEventListener('keydown', handleMoveEscape);
    return () => window.removeEventListener('keydown', handleMoveEscape);
  }, []);

  // Keep the task in move mode after dropping it. Only a press outside the
  // highlighted move frame ends the mode.
  useEffect(() => {
    if (!movingTask) return undefined;

    const handleOutsideMoveFrame = (event) => {
      if (moveDragActiveRef.current) return;
      if (event.target?.closest?.('[data-moving-task-frame]')) return;
      movingTaskRef.current = null;
      setMovingTask(null);
    };

    window.addEventListener('mousedown', handleOutsideMoveFrame);
    return () => window.removeEventListener('mousedown', handleOutsideMoveFrame);
  }, [movingTask]);

  // Excel-style right-click: open the mini menu anchored to a cell range.
  const openCellMenuAt = (event, dayIndex, anchorHour, focusHour) => {
    event.preventDefault();
    if (movingTaskRef.current) {
      moveDragActiveRef.current = false;
      movingTaskRef.current = null;
      setMovingTask(null);
    }
    cancelCellDrag();
    setCellSelection({
      anchorDay: dayIndex,
      anchorHour,
      focusDay: dayIndex,
      focusHour,
    });
    setCellMenu({ x: event.clientX, y: event.clientY });
  };

  // Finish the drag on mouse release. Only an actual drag (focus moved away
  // from the initial selection) opens the mini menu; a plain press/release
  // keeps the normal click behaviour (preview / note modal).
  useEffect(() => {
    const handleMouseUp = (event) => {
      moveTaskCandidateRef.current = null;
      if (!isSelectingCellsRef.current) return;
      cancelCellDrag();

      const anchor = cellDragAnchorRef.current;
      const focus = cellDragFocusRef.current;
      if (!anchor || !focus) {
        setCellSelection(null);
        return;
      }

      const startFocus = cellDragStartFocusRef.current;
      const dragged = Boolean(
        startFocus &&
          (focus.dayIndex !== startFocus.dayIndex || focus.hour !== startFocus.hour)
      );
      if (dragged) {
        suppressClickUntilRef.current = nowMs() + 600;
        setCellMenu({ x: event.clientX, y: event.clientY });
      } else {
        setCellSelection(null);
      }
    };

    const handleTouchEnd = () => {
      clearLongPress();
      if (!isSelectingCellsRef.current) return;
      cancelCellDrag();
      const position = lastTouchPositionRef.current;
      if (!position) {
        setCellSelection(null);
        return;
      }
      longPressAtRef.current = nowMs();
      suppressClickUntilRef.current = nowMs() + 800;
      setCellMenu(position);
    };

    const handleTouchCancel = () => {
      clearLongPress();
      if (!isSelectingCellsRef.current) return;
      cancelCellDrag();
      setCellSelection(null);
      setCellMenu(null);
    };

    const handleWindowBlur = () => {
      moveTaskCandidateRef.current = null;
      if (!isSelectingCellsRef.current) return;
      cancelCellDrag();
      closeCellMenu();
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchCancel);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('blur', handleWindowBlur);
      clearLongPress();
    };
  }, [cancelCellDrag, clearLongPress, closeCellMenu]);

  // Close the mini menu on outside click, Escape, or any scrolling.
  useEffect(() => {
    if (!cellMenu) return undefined;

    const handlePointerDown = (event) => {
      if (cellMenuRef.current?.contains(event.target)) return;
      if (nowMs() < suppressClickUntilRef.current) return;
      if (isSelectingCellsRef.current) {
        setCellMenu(null);
        return;
      }
      closeCellMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeCellMenu();
    };
    const handleScroll = () => closeCellMenu();

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [cellMenu, closeCellMenu]);

  const buildCalendarClipboard = (mode) => {
    if (!selectionRect || !selectionTasks.length) return null;
    const ordered = [...selectionTasks].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    return {
      mode,
      items: ordered.map((task) => {
        const { startMs, endMs } = getTaskBlockBounds(task);
        return {
          taskId: task._id,
          title: task.title,
          content: task.content || '',
          important: Boolean(task.important),
          createdFromCalendar: Boolean(task.createdFromCalendar),
          startOffsetMs: startMs - selectionRect.startMs,
          durationMs: endMs - startMs,
        };
      }),
    };
  };

  // Restore the tasks captured inside a merged block (bỏ gộp). Tasks are laid
  // out one hour per cell from the top cell of the block: 1 task -> top cell,
  // 2 tasks -> top + next cell, and so on.
  const handleUnmergeTask = (task) => {
    const blockStart = task.startAt ? new Date(task.startAt) : null;
    const clearMergedCellRange = async () => {
      if (!blockStart) return;
      const startHour = blockStart.getHours();
      const endHour = Math.min(
        23,
        startHour + Math.ceil(getTaskDurationMinutes(task) / 60) - 1
      );
      const dayKey = dateKey(blockStart);
      const existingMerges = calendarNotesQuery.data?.[dayKey]?.merges || [];
      const nextMerges = existingMerges.filter(
        (merge) => merge.startHour > endHour || merge.endHour < startHour
      );
      if (nextMerges.length !== existingMerges.length) {
        await saveCalendarNote(dayKey, undefined, nextMerges);
      }
    };
    if (Array.isArray(task?.mergedOccurrences) && task.mergedOccurrences.length) {
      selectionActionMutation.mutate(
        [async () => {
          await updateTask(task._id, currentUser._id, {
            unmergeCalendarOccurrenceId: task.calendarOccurrenceId || 'primary',
          });
          await clearMergedCellRange();
        }],
        { onSuccess: () => toast.success(t.taskUnmerged || 'Đã bỏ gộp các công việc.') }
      );
      setActiveModal(null);
      closeCellMenu();
      return;
    }

    const entries = Array.isArray(task?.mergedTasks) ? task.mergedTasks : [];
    if (!entries.length) {
      if (!blockStart || getTaskDurationMinutes(task) <= 60) return;
      const occurrenceId = task.calendarOccurrenceId || 'primary';
      const dueAt = new Date(blockStart.getTime() + 60 * 60000).toISOString();
      const payload = {
        startAt: blockStart.toISOString(),
        dueAt,
        estimatedMinutes: 60,
        ...(occurrenceId !== 'primary'
          ? { calendarOccurrenceId: occurrenceId, clearMergedOccurrences: true }
          : { mergedTasks: null, clearMergedOccurrences: true }),
      };
      const actions = [async () => {
        await updateTask(task._id, currentUser._id, payload);
        await clearMergedCellRange();
      }];
      selectionActionMutation.mutate(actions, {
        onSuccess: () => toast.success(t.taskUnmerged || 'Đã bỏ gộp các công việc.'),
      });
      setActiveModal(null);
      closeCellMenu();
      return;
    }

    const restoreActions = entries.map((entry, index) => {
      const { startAt, dueAt, estimatedMinutes } = getSequentialUnmergeSchedule(entry, blockStart, index);
      return () => updateTask(entry.taskId, currentUser._id, {
        ...(entry.title ? { title: entry.title } : {}),
        startAt,
        dueAt,
        estimatedMinutes,
        mergedTasks: null,
      });
    });
    selectionActionMutation.mutate([async () => {
      await Promise.all(restoreActions.map((run) => run()));
      await clearMergedCellRange();
    }], {
      onSuccess: () => toast.success(t.taskUnmerged || 'Đã bỏ gộp các công việc.'),
    });
    setActiveModal(null);
    closeCellMenu();
  };

  const handleClearSelection = () => {
    if (!selectionRect) return;
    if (!selectionTasks.length) {
      toast.info(t.selectionEmpty || 'Không có công việc trong vùng chọn');
      closeCellMenu();
      return;
    }
    const tasksById = new Map();
    for (const task of selectionTasks) {
      const entries = tasksById.get(task._id) || [];
      entries.push(task);
      tasksById.set(task._id, entries);
    }
    const actions = [...tasksById.values()].map((selectedTasks) => async () => {
      const task = selectedTasks[0];
      if (task.createdFromCalendar) {
        await deleteTask(task._id, currentUser._id);
        return;
      }
      const occurrenceIds = [...new Set(
        selectedTasks.map((entry) => entry.calendarOccurrenceId || 'primary')
      )];
      for (const occurrenceId of occurrenceIds) {
        await removeCalendarTask(task, occurrenceId);
      }
    });
    const selectedDayKey = calendarDateKeys[selectionRect.startDay];
    const nextMerges = selectionDayMerges.filter(
      (merge) => merge.startHour > selectionRect.endHour
        || merge.endHour < selectionRect.startHour
    );
    if (nextMerges.length !== selectionDayMerges.length) {
      actions.push(() => saveCalendarNote(selectedDayKey, undefined, nextMerges));
    }

    selectionActionMutation.mutate(actions, {
      onSuccess: () => toast.success(
        formatText('calendarSelectionRemoved', { count: selectionTasks.length })
      ),
    });
    closeCellMenu();
  };

  const handleCopySelection = () => {
    const clipboard = buildCalendarClipboard('copy');
    if (!clipboard) {
      toast.info(t.selectionEmpty || 'Không có công việc trong vùng chọn');
      closeCellMenu();
      return;
    }
    setCalendarClipboard(clipboard);
    toast.success(formatText('selectionCopied', { count: clipboard.items.length }));
    closeCellMenu();
  };

  const handleCutSelection = () => {
    const clipboard = buildCalendarClipboard('cut');
    if (!clipboard) {
      toast.info(t.selectionEmpty || 'Không có công việc trong vùng chọn');
      closeCellMenu();
      return;
    }
    const actions = selectionTasks.map((task) => () => updateTask(
      task._id,
      currentUser._id,
      task.calendarOccurrenceId && task.calendarOccurrenceId !== 'primary'
        ? { removeCalendarOccurrenceId: task.calendarOccurrenceId }
        : { startAt: null, dueAt: null, mergedTasks: null, calendarOccurrenceId: 'primary' }
    ));

    selectionActionMutation.mutate(actions, {
      onSuccess: () => toast.success(formatText('selectionCut', { count: clipboard.items.length })),
    });
    setCalendarClipboard(clipboard);
    closeCellMenu();
  };

  const handlePasteSelection = () => {
    if (!selectionRect) return;
    if (!calendarClipboard?.items?.length) {
      toast.info(t.clipboardEmpty || 'Bạn nên sao chép hoặc cắt công việc trước');
      closeCellMenu();
      return;
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const baseMs = selectionRect.startMs;
    const isCut = calendarClipboard.mode === 'cut';
    const targetMerge = selectionDayMerges.find(
      (merge) => merge.startHour <= selectionRect.startHour
        && merge.endHour >= selectionRect.endHour
    );
    const targetMergeHasTask = targetMerge && isCalendarMergeOccupied(
      targetMerge,
      tasks,
      calendarDays[selectionRect.startDay]
    );
    const targetMergeDurationMs = targetMerge && !targetMergeHasTask
      ? (targetMerge.endHour - targetMerge.startHour + 1) * 60 * 60 * 1000
      : 0;
    const pasteItems = calendarClipboard.items.map((item) => {
      const durationMs = Math.max(
        item.durationMs,
        item.startOffsetMs === 0 ? targetMergeDurationMs : 0
      );
      const startDate = new Date(baseMs + item.startOffsetMs);
      const startAt = startDate.toISOString();
      const dueAt = new Date(baseMs + item.startOffsetMs + durationMs).toISOString();
      return {
        item,
        startAt,
        dueAt,
        durationMs,
        startMs: startDate.getTime(),
        endMs: startDate.getTime() + durationMs,
      };
    });

    const actions = [async () => {
      let placedCount = 0;
      let expandedMerges = null;
      let workingNotes = (await fetchCalendarNotes(calendarDateKeys)).data || {};
      for (const pasteItem of pasteItems) {
        const { item, startAt, durationMs } = pasteItem;
        const latestCalendarTasks = calendarRange
          ? (await fetchCalendarTasks(calendarRange)).data || []
          : tasks;
        const candidate = {
          title: item.title,
          createdAt: new Date().toISOString(),
          startAt,
          estimatedMinutes: Math.min(1440, Math.max(1, Math.round(durationMs / 60000))),
        };
        const placement = planCalendarTaskPlacement(
          latestCalendarTasks,
          candidate,
          workingNotes
        );
        if (!placement?.segments.length) continue;

        const segments = placement.segments;
        if (targetMerge && !targetMergeHasTask && item.startOffsetMs === 0) {
          const targetDay = calendarDays[selectionRect.startDay];
          const targetDayKey = dateKey(targetDay);
          const merges = [];
          for (const segment of segments) {
            const segmentStart = new Date(segment.startMs);
            const segmentEnd = new Date(segment.endMs);
            if (
              dateKey(segmentStart) !== targetDayKey
              || dateKey(new Date(segment.endMs - 1)) !== targetDayKey
            ) continue;
            const startHour = segmentStart.getHours();
            const endHour = Math.min(23, Math.ceil(
              (segmentEnd.getTime() - startOfDay(segmentStart).getTime()) / 3600000
            ) - 1);
            if (endHour > startHour) merges.push({ startHour, endHour });
          }
          expandedMerges = [...new Map(
            merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
          ).values()].sort((left, right) => left.startHour - right.startHour);
        }
        const firstSegment = segments[0];
        const response = await createTask({
          userId: currentUser._id,
          title: item.title,
          contentType: 'task',
          content: item.content,
          important: item.important,
          createdFromCalendar: Boolean(item.createdFromCalendar),
          startAt: new Date(firstSegment.startMs).toISOString(),
          dueAt: new Date(firstSegment.endMs).toISOString(),
          estimatedMinutes: firstSegment.estimatedMinutes,
          timeZone,
        });
        for (const segment of segments.slice(1)) {
          await updateTask(response.data._id, currentUser._id, {
            addCalendarOccurrence: {
              startAt: new Date(segment.startMs).toISOString(),
              dueAt: new Date(segment.endMs).toISOString(),
              estimatedMinutes: segment.estimatedMinutes,
              timeZone,
            },
          });
        }

        const updatedNotes = await writeCalendarPlacementChanges(
          placement.splitTasks,
          [...placement.sameTitleTasks, ...placement.absorbedTasks],
          workingNotes,
          timeZone
        );
        workingNotes = { ...workingNotes, ...updatedNotes };

        placedCount += 1;
      }
      if (placedCount && expandedMerges) {
        const dayKey = calendarDateKeys[selectionRect.startDay];
        const currentDayMerges = workingNotes[dayKey]?.merges || [];
        const nextMerges = [
          ...currentDayMerges.filter(
            (merge) => merge.startHour > targetMerge.endHour
              || merge.endHour < targetMerge.startHour
          ),
          ...expandedMerges,
        ];
        await saveCalendarNote(dayKey, undefined, nextMerges);
        await queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      }
      return placedCount;
    }];

    selectionActionMutation.mutate(actions, {
      onSuccess: async ([placedCount]) => {
        if (isCut) setCalendarClipboard(null);
        if (placedCount) {
          toast.success(formatText('selectionPasted', { count: placedCount }));
        } else {
          toast.info(language === 'vi'
            ? 'Không còn phần thời gian trống để dán task.'
            : 'There is no free time left to paste the task.');
        }
      },
    });
    closeCellMenu();
  };

  // ==================== Mini menu: selection helpers ====================
  const handleSelectFullDay = () => {
    if (!cellSelection) return;
    const day = cellSelection.anchorDay;
    setCellSelection({ anchorDay: day, anchorHour: 0, focusDay: day, focusHour: 23 });
  };

  const isFullDaySelection = Boolean(
    selectionRect && selectionRect.startHour === 0 && selectionRect.endHour === 23
  );

  const selectionDayMerges = selectionRect
    ? calendarNotesQuery.data?.[calendarDateKeys[selectionRect.startDay]]?.merges || []
    : [];
  const isExactMergeSelection = Boolean(
    selectionRect
      && selectionDayMerges.some(
        (merge) =>
          merge.startHour === selectionRect.startHour
          && merge.endHour === selectionRect.endHour
      )
  );
  const selectedMultiCellTask = selectionTasks.length === 1
    && selectionTasks[0].startAt
    && getTaskDurationMinutes(selectionTasks[0]) > 60
    ? selectionTasks[0]
    : null;
  const selectedTaskDisplay = selectedMultiCellTask && selectionRect
    ? getTaskCalendarDisplay(
        selectedMultiCellTask,
        calendarDays[selectionRect.startDay]
      )
    : null;
  const singleSelectedTask = selectionTasks.length === 1 ? selectionTasks[0] : null;
  const singleSelectedTaskDisplay = singleSelectedTask && selectionRect
    ? getTaskCalendarDisplay(singleSelectedTask, calendarDays[selectionRect.startDay])
    : null;
  const canExpandSingleTaskSelection = Boolean(
    selectionRect
      && selectionRect.startDay === selectionRect.endDay
      && selectionRect.startHour < selectionRect.endHour
      && singleSelectedTaskDisplay?.kind === 'scheduled'
      && singleSelectedTaskDisplay.startMs < selectionRect.endMs
      && singleSelectedTaskDisplay.endMs > selectionRect.startMs
  );
  const isExactMultiCellTaskSelection = Boolean(
    selectedTaskDisplay?.kind === 'scheduled'
      && Math.floor(
        (selectedTaskDisplay.startMs - startOfDay(calendarDays[selectionRect.startDay]).getTime())
        / 3600000
      ) === selectionRect.startHour
      && Math.ceil(
        (selectedTaskDisplay.endMs - startOfDay(calendarDays[selectionRect.startDay]).getTime())
        / 3600000
      ) - 1 === selectionRect.endHour
  );
  const canMergeSelection = Boolean(
    selectionRect
      && (
        (selectionRect.startDay === selectionRect.endDay
          && selectionRect.startHour < selectionRect.endHour)
        || isExactMergeSelection
      )
  );
  const canUnmergeSelection = isExactMergeSelection || isExactMultiCellTaskSelection;
  const mergeActionDisabled = !canMergeSelection;

  const handleMergeSelection = () => {
    if (!selectionRect || mergeActionDisabled) return;
    const key = calendarDateKeys[selectionRect.startDay];
    const existingMerges = calendarNotesQuery.data?.[key]?.merges || [];
    if (isExactMultiCellTaskSelection && !isExactMergeSelection) {
      handleUnmergeTask(selectedMultiCellTask);
      return;
    }
    if (isExactMergeSelection) {
      const mergedTask = selectionTasks.find(
        (task) => (
          (Array.isArray(task.mergedTasks) && task.mergedTasks.length)
          || (Array.isArray(task.mergedOccurrences) && task.mergedOccurrences.length)
        )
      );
      const multiCellTask = selectionTasks.find(
        (task) => task.startAt && getTaskDurationMinutes(task) > 60
      );
      if (mergedTask || multiCellTask) {
        handleUnmergeTask(mergedTask || multiCellTask);
        return;
      }

      mergeCellsMutation.mutate(
        {
          key,
          merges: existingMerges.filter(
            (merge) =>
              merge.startHour !== selectionRect.startHour
              || merge.endHour !== selectionRect.endHour
          ),
        },
        { onSuccess: () => toast.success(t.mergeUnmerged || 'Đã bỏ gộp các ô đã chọn.') }
      );
      closeCellMenu();
      return;
    }

    const taskMerge = selectionTasks.length
      ? buildCalendarTaskMerge(
        selectionTasks,
        selectionRect.startMs,
        selectionRect.endMs
      )
      : null;
    if (selectionTasks.length && !taskMerge) {
      toast.error(t.error);
      return;
    }

    const merges = toggleCalendarCellMerge(
      existingMerges,
      selectionRect.startHour,
      selectionRect.endHour
    );

    const sameTaskOccurrences = selectionTasks.length > 1
      && selectionTasks.every((task) => task._id === selectionTasks[0]._id);
    if (sameTaskOccurrences) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const actions = [() => updateTask(selectionTasks[0]._id, currentUser._id, {
        mergeCalendarOccurrenceIds: selectionTasks.map(
          (task) => task.calendarOccurrenceId || 'primary'
        ),
        startAt: new Date(selectionRect.startMs).toISOString(),
        dueAt: new Date(selectionRect.endMs).toISOString(),
        estimatedMinutes: Math.min(
          1440,
          Math.max(1, Math.round((selectionRect.endMs - selectionRect.startMs) / 60000))
        ),
        timeZone,
      })];
      mergeCellsMutation.mutate({ key, merges });
      selectionActionMutation.mutate(actions, {
        onSuccess: () => toast.success(
          formatText('selectionMerged', { count: selectionTasks.length })
        ),
      });
      closeCellMenu();
      return;
    }

    if (canExpandSingleTaskSelection) {
      const task = singleSelectedTask;
      const occurrenceId = task.calendarOccurrenceId || 'primary';
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const expandedRange = getCalendarTaskMergeRange(
        task,
        calendarDays[selectionRect.startDay],
        selectionRect.startHour,
        selectionRect.endHour
      );
      if (!expandedRange) return;
      const updates = {
        startAt: expandedRange.startAt,
        dueAt: expandedRange.dueAt,
        estimatedMinutes: expandedRange.durationMinutes,
        timeZone,
        ...(occurrenceId === 'primary'
          ? {}
          : { calendarOccurrenceId: occurrenceId }),
      };
      const nextMerges = [
        ...existingMerges.filter(
          (merge) => merge.startHour > expandedRange.endHour
            || merge.endHour < expandedRange.startHour
        ),
        { startHour: expandedRange.startHour, endHour: expandedRange.endHour },
      ].sort((left, right) => left.startHour - right.startHour);
      mergeCellsMutation.mutate({ key, merges: nextMerges });
      selectionActionMutation.mutate(
        [() => updateTask(task._id, currentUser._id, updates)],
        {
          onSuccess: () => toast.success(
            formatText('selectionMerged', { count: 1 })
          ),
        }
      );
      closeCellMenu();
      return;
    }

    mergeCellsMutation.mutate(
      { key, merges },
      {
        onSuccess: () => {
          if (!selectionTasks.length) {
            toast.success(t.mergeCellsDone || 'Đã gộp các ô đã chọn.');
          }
        },
      }
    );

    if (taskMerge) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const actions = [
        () => updateTask(taskMerge.survivor._id, currentUser._id, {
          title: taskMerge.title,
          startAt: new Date(selectionRect.startMs).toISOString(),
          dueAt: new Date(selectionRect.endMs).toISOString(),
          estimatedMinutes: taskMerge.durationMinutes,
          timeZone,
          mergedTasks: taskMerge.snapshot,
        }),
        ...taskMerge.others.map((task) => () => updateTask(task._id, currentUser._id, {
          startAt: null,
          dueAt: null,
          mergedTasks: null,
        })),
      ];
      selectionActionMutation.mutate(actions, {
        onSuccess: () => toast.success(
          formatText('selectionMerged', { count: selectionTasks.length })
        ),
      });
    }
    closeCellMenu();
  };

  const movableTask = selectionTasks.length === 1 ? selectionTasks[0] : null;
  const movableTaskDisplay = movableTask && selectionRect
    ? getTaskCalendarDisplay(movableTask, calendarDays[selectionRect.startDay])
    : null;
  const movableTaskStartDayKey = movableTask?.startAt ? dateKey(new Date(movableTask.startAt)) : null;
  const selectedDayKey = selectionRect ? calendarDateKeys[selectionRect.startDay] : null;
  const canMoveTask = Boolean(
    movableTask?.startAt
      && selectionRect
      && movableTaskDisplay?.kind === 'scheduled'
      && movableTaskStartDayKey === selectedDayKey
  );

  const handleStartMoveTask = () => {
    if (!movableTask || !selectionRect) return;
    const dayIndex = selectionRect.startDay;
    const taskDay = calendarDays[dayIndex];
    const display = getTaskCalendarDisplay(movableTask, taskDay);
    if (!display || display.kind !== 'scheduled') return;

    const originalStart = new Date(display.originalStartMs);
    if (dateKey(originalStart) !== calendarDateKeys[dayIndex]) return;
    const startHour = originalStart.getHours();
    const durationMinutes = getTaskDurationMinutes(movableTask);
    const initialSpan = Math.max(1, Math.ceil(durationMinutes / 60));
    const dayMerges = calendarNotesQuery.data?.[calendarDateKeys[dayIndex]]?.merges || [];
    const sourceMerge = dayMerges.find((merge) => (
      merge.startHour === startHour
      && merge.endHour >= Math.min(23, startHour + initialSpan - 1)
    )) || null;
    const spanHours = sourceMerge
      ? sourceMerge.endHour - sourceMerge.startHour + 1
      : initialSpan;
    const targetStartHour = sourceMerge ? sourceMerge.startHour : startHour;

    const nextMove = {
      taskId: movableTask._id,
      calendarOccurrenceId: movableTask.calendarOccurrenceId || 'primary',
      title: movableTask.title,
      createdAt: movableTask.createdAt,
      status: movableTask.status,
      dayIndex,
      startHour: targetStartHour,
      endHour: targetStartHour + spanHours - 1,
      spanHours,
      durationMinutes: sourceMerge ? spanHours * 60 : durationMinutes,
      sourceMerge: sourceMerge
        ? {
            dayKey: calendarDateKeys[dayIndex],
            startHour: sourceMerge.startHour,
            endHour: sourceMerge.endHour,
            spanHours,
          }
        : null,
    };
    setMovingTask(nextMove);
    setCellMenu(null);
    setCellSelection(null);
  };

  // Live data for the task preview modal (falls back to the clicked snapshot).
  const previewTask = activeModal?.mode === 'preview'
    ? (() => {
        const liveTask = allTasks.find((task) => task._id === activeModal.task?._id);
        const occurrenceId = activeModal.task?.calendarOccurrenceId;
        if (!liveTask || !occurrenceId || occurrenceId === 'primary') {
          return liveTask || activeModal.task;
        }
        const occurrence = liveTask.calendarOccurrences?.find(
          (entry) => entry._id === occurrenceId
        );
        return occurrence
          ? {
              ...liveTask,
              ...occurrence,
              _id: liveTask._id,
              calendarOccurrenceId: occurrenceId,
              mergedTasks: [],
            }
          : activeModal.task;
      })()
    : null;
  const rawPreviewMergedEntries = Array.isArray(activeModal?.task?.virtualMembers)
    ? activeModal.task.virtualMembers
    : (Array.isArray(previewTask?.mergedOccurrences) && previewTask.mergedOccurrences.length
      ? previewTask.mergedOccurrences
      : (previewTask && Array.isArray(previewTask.mergedTasks) ? previewTask.mergedTasks : []));
  const previewMergedEntries = rawPreviewMergedEntries;
  const selectedScheduleTask = taskScheduleForm.taskId === NEW_TASK_ID
    ? null
    : allTasks.find((task) => task._id === taskScheduleForm.taskId);

  // Keep the mini menu inside the viewport regardless of its real height.
  const [cellMenuHeight, setCellMenuHeight] = useState(330);
  useLayoutEffect(() => {
    if (cellMenu) setCellMenuHeight(cellMenuRef.current?.offsetHeight || 330);
  }, [cellMenu, selectionRect]);

  const menuLeft = cellMenu ? Math.max(8, Math.min(cellMenu.x, window.innerWidth - 258)) : 0;
  const menuTop = cellMenu
    ? Math.max(8, Math.min(cellMenu.y, window.innerHeight - cellMenuHeight - 16))
    : 0;

  const selectionSummary = useMemo(() => {
    if (!selectionRect) return '';
    const startLabel = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(selectionRect.startMs));
    const endLabel = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(selectionRect.endMs));
    const taskCount = formatText('tasksCount', { count: selectionTasks.length });
    return `${startLabel} – ${endLabel} • ${taskCount}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRect, selectionTasks.length, locale, language]);

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
  const hydrateNoteForModal = (date) => {
    const key = dateKey(date);
    if (!notesReady) {
      noteHydratedKeyRef.current = null;
      setNoteInput('');
      return;
    }
    noteHydratedKeyRef.current = key;
    setNoteInput(calendarNotesQuery.data?.[key]?.content || '');
  };

  const openNoteModal = (date) => {
    hydrateNoteForModal(date);
    setActiveModal({ mode: 'note', date, task: null });
  };

  const openTaskPreviewModal = (date, task) => {
    setActiveModal({ mode: 'preview', date, task });
  };

  const openTaskScheduleModal = (date, task = null, hour = null, endHour = null, focusNewTaskTitle = false) => {
    const keyDate = new Date(date);
    const hasFrame = typeof hour === 'number';
    if (hasFrame) {
      keyDate.setHours(hour, 0, 0, 0);
    }
    // Clicking an hour cell or a merged region means "schedule into this
    // frame": start = frame start, due = frame end (the whole merged cell),
    // regardless of the task currently selected in the dropdown.
    const frameEnd = hasFrame
      ? new Date(
          keyDate.getTime() + ((typeof endHour === 'number' ? endHour : hour) - hour + 1) * 60 * 60 * 1000
        )
      : null;
    const initialStart = hasFrame ? keyDate.toISOString() : (task?.startAt || '');
    const initialDue = hasFrame ? frameEnd.toISOString() : (task?.dueAt || '');

    // Keep the day note prefilled so the Note tab never wipes existing content.
    hydrateNoteForModal(date);
    setTaskScheduleForm({
      taskId: task?._id || NEW_TASK_ID,
      startAt: toLocalInputValue(initialStart),
      dueAt: toLocalInputValue(initialDue),
      newTitle: '',
    });
    setActiveModal({
      mode: 'task',
      date,
      task,
      focusNewTaskTitle,
      frame: hasFrame ? { startAt: initialStart, dueAt: initialDue } : null,
    });
  };

  const handleScheduleTaskChange = (value) => {
    if (value === NEW_TASK_ID) {
      const frame = activeModal?.frame;
      setTaskScheduleForm((prev) => ({
        ...prev,
        taskId: value,
        newTitle: '',
        startAt: frame ? toLocalInputValue(frame.startAt) : '',
        dueAt: frame ? toLocalInputValue(frame.dueAt) : '',
      }));
      return;
    }

    const selectedTask = allTasks.find((task) => task._id === value);
    const frame = activeModal?.frame;
    setTaskScheduleForm((prev) => ({
      ...prev,
      taskId: value,
      newTitle: '',
      startAt: toLocalInputValue(frame?.startAt || selectedTask?.startAt),
      dueAt: toLocalInputValue(frame?.dueAt || selectedTask?.dueAt),
    }));
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!activeModal?.date) return;
    if (!notesReady) {
      toast.error(language === 'vi'
        ? 'Ghi chú chưa tải xong. Vui lòng thử lại.'
        : 'Notes are still loading. Please try again.');
      return;
    }
    const key = dateKey(activeModal.date);
    noteMutation.mutate({ key, content: noteInput.trim() });
  };

  const handleDeleteNote = () => {
    if (!activeModal?.date) return;
    if (!notesReady) {
      toast.error(language === 'vi'
        ? 'Ghi chú chưa tải xong. Vui lòng thử lại.'
        : 'Notes are still loading. Please try again.');
      return;
    }
    const key = dateKey(activeModal.date);
    noteMutation.mutate({ key, content: '' });
  };

  const handleSaveSchedule = (e) => {
    e.preventDefault();
    const isNewTask = taskScheduleForm.taskId === NEW_TASK_ID;
    const addTaskOccurrence = !isNewTask && Boolean(activeModal?.frame);
    const newTitle = taskScheduleForm.newTitle.trim();

    if (isNewTask && !newTitle) {
      toast.error(t.newTaskTitleRequired || 'Vui lòng nhập tên công việc mới');
      return;
    }
    if (!isNewTask && !taskScheduleForm.taskId) {
      toast.error(language === 'vi' ? 'Vui lòng chọn công việc' : 'Please select a task');
      return;
    }
    if (addTaskOccurrence && !selectedScheduleTask) {
      toast.error(t.scheduleSaveError || 'Không thể lưu lịch');
      return;
    }

    const startAt = taskScheduleForm.startAt ? new Date(taskScheduleForm.startAt).toISOString() : null;
    const dueAt = taskScheduleForm.dueAt ? new Date(taskScheduleForm.dueAt).toISOString() : null;

    if (startAt && dueAt && new Date(dueAt) <= new Date(startAt)) {
      toast.error(t.scheduleRangeInvalid || 'Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    if (!isNewTask && !startAt && !dueAt) {
      toast.error(language === 'vi'
        ? 'Vui lòng chọn giờ, hoặc dùng nút Xóa lịch để bỏ lịch.'
        : 'Choose a time, or use Clear schedule to unschedule this task.');
      return;
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const estimatedMinutes =
      startAt && dueAt
        ? Math.min(1440, Math.max(1, Math.round((new Date(dueAt) - new Date(startAt)) / 60000)))
        : null;

    if (isNewTask) {
      scheduleMutation.mutate({
        create: {
          userId: currentUser._id,
          title: isNewTask ? newTitle : selectedScheduleTask.title,
          contentType: 'task',
          important: isNewTask ? false : selectedScheduleTask.important,
          createdFromCalendar: true,
          startAt,
          dueAt,
          estimatedMinutes,
          timeZone,
        },
      });
      return;
    }

    const schedule = { startAt, dueAt, timeZone };
    if (estimatedMinutes) schedule.estimatedMinutes = estimatedMinutes;
    if (addTaskOccurrence) {
      scheduleMutation.mutate({
        taskId: taskScheduleForm.taskId,
        payload: { addCalendarOccurrence: schedule },
      });
      return;
    }

    const activeOccurrenceId = activeModal?.task?._id === taskScheduleForm.taskId
      ? activeModal.task.calendarOccurrenceId
      : null;
    const payload = {
      ...schedule,
      calendarOccurrenceId: activeOccurrenceId || 'primary',
    };
    scheduleMutation.mutate({ taskId: taskScheduleForm.taskId, payload });
  };

  const handleClearSchedule = () => {
    if (!taskScheduleForm.taskId || taskScheduleForm.taskId === NEW_TASK_ID) return;
    const activeOccurrenceId = activeModal?.task?._id === taskScheduleForm.taskId
      ? activeModal.task.calendarOccurrenceId
      : null;
    scheduleMutation.mutate({
      taskId: taskScheduleForm.taskId,
      payload: activeOccurrenceId && activeOccurrenceId !== 'primary'
        ? { removeCalendarOccurrenceId: activeOccurrenceId }
        : { startAt: null, dueAt: null, calendarOccurrenceId: 'primary' },
    });
  };

  // Google Calendar Current Time Red Line Indicator
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const intervalId = setInterval(updateNow, 30 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateNow();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', updateNow);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', updateNow);
    };
  }, []);
  const currentDayKey = dateKey(now);
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const currentTimePercentage = (currentMinutesFromMidnight / 1440) * 100;

  if (!currentUser?._id) return null;

  return (
    <LayoutShell>
      <div className='space-y-5 pb-12'>
        <Header />

        {/* Top Google Calendar Control Bar */}
        <header className='flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
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
              </div>
              <p className='text-xs font-semibold capitalize text-slate-500 dark:text-slate-400'>
                {periodLabel}
              </p>
            </div>
          </div>

          {/* Center / Right: Google Calendar Navigation & Actions */}
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] sm:items-center'>
            <div className='flex items-center gap-2'>
              {/* Today Button */}
              <button
                type='button'
                onClick={jumpToToday}
                className='rounded-3xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
              >
                {t.today}
              </button>

              {/* Prev / Next Buttons */}
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => changePeriod(-1)}
                  aria-label={t.previousPeriod}
                  className='flex h-9 w-9 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-90 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button
                  type='button'
                  onClick={() => changePeriod(1)}
                  aria-label={t.nextPeriod}
                  className='flex h-9 w-9 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-90 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            </div>

            <div className='flex flex-wrap items-center justify-end gap-2'>
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
                className='relative grid grid-cols-4 gap-0.5 rounded-3xl border border-slate-200 bg-slate-100 p-0.5 shadow-inner dark:border-slate-600 dark:bg-slate-900'
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
          </div>
        </header>

        {/* Calendar Content Views */}
        {taskQuery.isLoading ? (
          <div className='grid h-96 place-items-center rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/50'>
            <div className='flex flex-col items-center gap-3 text-violet-600 dark:text-violet-400'>
              <CalendarIcon className='h-8 w-8 animate-bounce' />
              <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>
                {t.loading}
              </p>
            </div>
          </div>
        ) : taskQuery.isError ? (
          <section className='rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-200'>
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
          <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/90'>
            {/* Weekday Header */}
            <div className='grid grid-cols-7 border-b border-slate-200/90 bg-slate-50/70 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400'>
              {calendarDays.slice(0, 7).map((date) => (
                <div key={dateKey(date)} className='py-2.5'>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
                </div>
              ))}
            </div>

            {/* 7x6 Day Grid */}
            <div className='grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-600/80'>
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
                    className={`group relative flex min-h-[110px] cursor-pointer flex-col p-1.5 transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-900/15 sm:min-h-[135px] sm:p-2 ${
                      !isCurrentMonth
                        ? 'bg-slate-50/40 text-slate-400 dark:bg-slate-900/30 dark:text-slate-600'
                        : 'bg-white/40 dark:bg-slate-800/40 text-slate-800 dark:text-slate-100'
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
                          className='flex items-center gap-1 truncate rounded-3xl border border-amber-200/90 bg-amber-50/90 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-xs transition hover:scale-[1.02] hover:bg-amber-100 dark:border-amber-600/70 dark:bg-amber-900/40 dark:text-amber-200'
                          title={dayNote}
                        >
                          <StickyNote className='h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400' />
                          <span className='truncate'>{dayNote}</span>
                        </div>
                      ) : null}

                      {/* Task Chips (Google Calendar Style) */}
                      {dayTasks.slice(0, dayNote ? 2 : 3).map((task) => {
                        const display = getTaskCalendarDisplay(task, date);
                        const isStart = Boolean(task.startAt);
                        return (
                          <div
                            key={getCalendarEventKey(task)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openTaskScheduleModal(date, task);
                            }}
                            title={task.title}
                            className={`flex items-center gap-1 truncate rounded-3xl border px-2 py-0.5 text-[11px] font-medium transition hover:scale-[1.02] ${
                              isStart
                                ? 'border-violet-200 bg-violet-100/90 text-violet-900 dark:border-violet-600 dark:bg-violet-900/60 dark:text-violet-200'
                                : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <Clock className='h-3 w-3 shrink-0 opacity-70' />
                            {display ? (
                              <span className='font-bold'>{formatTimeOnly(display.startMs, locale)}</span>
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
          <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/90'>
            {/* Header Columns: Days & Date */}
            <div className='flex border-b border-slate-200/90 dark:border-slate-600'>
              <div className='w-14 shrink-0 border-r border-slate-200/90 bg-slate-50/50 p-2 text-center text-[11px] font-bold text-slate-400 dark:border-slate-600 dark:bg-slate-900/30'>
                GMT
              </div>
              <div
                className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-600/80 ${
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
                        isToday ? 'bg-violet-50/30 dark:bg-violet-900/10' : ''
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
            <div className='flex border-b border-slate-200/90 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-900/40'>
              <div className='flex w-14 shrink-0 items-center justify-center border-r border-slate-200/90 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-600'>
                Notes
              </div>
              <div
                className={`grid flex-1 divide-x divide-slate-100 p-1.5 dark:divide-slate-600/80 ${
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
                          className='flex cursor-pointer items-center gap-1.5 truncate rounded-3xl border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-xs transition hover:scale-[1.02] dark:border-amber-600/80 dark:bg-amber-900/50 dark:text-amber-200'
                          title={dayNote}
                        >
                          <StickyNote className='h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />
                          <span className='truncate'>{dayNote}</span>
                        </div>
                      ) : (
                        <button
                          type='button'
                          onClick={() => openNoteModal(date)}
                          className='flex w-full items-center justify-center gap-1 rounded-3xl border border-dashed border-slate-300/80 py-1 text-[11px] font-medium text-slate-400 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-500 dark:hover:border-violet-500'
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
            <div className={`sidebar-scrollbar relative max-h-[620px] overflow-y-auto ${cellsSelecting ? 'select-none' : ''}`}>
              <div className='flex'>
                {/* Left Hour Labels */}
                <div className='w-14 shrink-0 divide-y divide-transparent border-r border-slate-200/80 dark:border-slate-600'>
                  {HOURS_IN_DAY.map((hour) => (
                    <div
                      key={hour}
                      className='flex h-14 items-center justify-end pr-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500'
                    >
                      <span>{String(hour).padStart(2, '0')}:00</span>
                    </div>
                  ))}
                </div>

                {/* Grid Columns for Each Day */}
                <div
                  ref={calendarGridRef}
                  className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-600/70 ${
                    cellsSelecting ? 'select-none' : ''
                  } ${
                    viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
                  }`}
                >
                  {calendarDays.map((date, dayIndex) => {
                    const dayKey = dateKey(date);
                    const isToday = dayKey === currentDayKey;
                    const dayTasks = taskByDate.get(dayKey) || [];
                    const dayNote = calendarNotesQuery.data?.[dayKey]?.content || '';
                    const dayMerges = calendarNotesQuery.data?.[dayKey]?.merges || [];
                    const dayStartMs = startOfDay(date).getTime();
                    const scheduledIntervals = dayTasks.flatMap((task) => {
                      const display = getTaskCalendarDisplay(task, date);
                      if (display?.kind !== 'scheduled') return [];
                      const startHour = Math.max(
                        0,
                        Math.floor((display.startMs - dayStartMs) / 3600000)
                      );
                      const endHour = Math.min(
                        24,
                        Math.ceil((display.endMs - dayStartMs) / 3600000)
                      );
                      if (endHour <= startHour) return [];
                      return [{
                        identity: getCalendarEventKey(task),
                        task,
                        startMs: dayStartMs + startHour * 3600000,
                        endMs: dayStartMs + endHour * 3600000,
                      }];
                    });
                    const taskSegments = buildCalendarMergeSegments(scheduledIntervals);
                    const scheduledRangeByIdentity = new Map(
                      scheduledIntervals.map((interval) => [interval.identity, interval])
                    );
                    const scheduledTaskBlocks = mergeAdjacentSameTitleBlocks(
                      taskSegments.valid
                        ? taskSegments.segments.map((segment) => ({
                            identity: segment.identityKeys.join('+'),
                            task: segment.members[0]?.task,
                            members: segment.members,
                            startMs: segment.startMs,
                            endMs: segment.endMs,
                            memberIndex: 0,
                            memberCount: 1,
                            isVirtualGroup: segment.members.length > 1,
                            isTaskStart: segment.members.length === 1
                              && segment.startMs === scheduledRangeByIdentity.get(
                                segment.members[0].identity
                              )?.startMs,
                            isTaskEnd: segment.members.length === 1
                              && segment.endMs === scheduledRangeByIdentity.get(
                                segment.members[0].identity
                              )?.endMs,
                            isSameTitleMerge: segment.members.length > 1
                              && segment.members.every(({ task }) => task?.title === segment.members[0]?.task?.title),
                          }))
                        : scheduledIntervals.map((interval) => ({
                            ...interval,
                            members: [{ identity: interval.identity, task: interval.task }],
                            memberIndex: 0,
                            memberCount: 1,
                            isTaskStart: true,
                            isTaskEnd: true,
                            isSameTitleMerge: false,
                          }))
                    );
                    const deadlineTaskBlocks = dayTasks.flatMap((task) => {
                      const display = getTaskCalendarDisplay(task, date);
                      if (display?.kind !== 'deadline') return [];
                      const startHour = Math.max(
                        0,
                        Math.floor((display.startMs - dayStartMs) / 3600000)
                      );
                      const endHour = Math.min(
                        24,
                        Math.ceil((display.endMs - dayStartMs) / 3600000)
                      );
                      return [{
                        identity: getCalendarEventKey(task),
                        task,
                        startMs: dayStartMs + startHour * 3600000,
                        endMs: dayStartMs + Math.max(startHour + 1, endHour) * 3600000,
                        memberIndex: 0,
                        memberCount: 1,
                        isTaskStart: true,
                        isTaskEnd: true,
                      }];
                    });

                    return (
                      <div
                        key={dayKey}
                        data-calendar-day-index={dayIndex}
                        className={`relative ${isToday ? 'bg-violet-50/15 dark:bg-violet-900/5' : ''}`}
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

                        {/* 24 Hour Slots (internal borders hidden inside merged regions) */}
                        {HOURS_IN_DAY.map((hour) => {
                          const insideMergedRange = dayMerges.some(
                            (merge) => hour > merge.startHour && hour <= merge.endHour
                          );
                          return (
                            <div
                              key={hour}
                              data-calendar-hour={hour}
                              onClick={() => {
                                if (consumeSuppressedClick()) return;
                                openTaskScheduleModal(date, null, hour);
                              }}
                              onMouseDown={(event) => beginCellDrag(event, dayIndex, hour)}
                              onTouchStart={(event) => startLongPress(event, dayIndex, hour, hour)}
                              onContextMenu={(event) => openCellMenuAt(event, dayIndex, hour, hour)}
                              className={`relative h-14 cursor-pointer transition-colors hover:bg-violet-50/50 dark:hover:bg-violet-900/20 ${
                                hour > 0 && !insideMergedRange
                                  ? 'border-t border-slate-200/90 dark:border-slate-500/60'
                                  : ''
                              }`}
                            />
                          );
                        })}

                        {/* Rounded Selection Overlay (single column) */}
                        {selectionRect && selectionRect.startDay === dayIndex ? (
                          <div
                            className='pointer-events-none absolute inset-x-0 z-40 rounded-3xl border border-violet-400/70 bg-violet-300/40 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)] dark:border-violet-300/70 dark:bg-violet-500/25'
                            style={{
                              top: `${selectionRect.startHour * 56}px`,
                              height: `${(selectionRect.endHour - selectionRect.startHour + 1) * 56}px`,
                            }}
                          />
                        ) : null}

                        {/* Merged Cell Regions (Excel-style: no internal horizontal borders) */}
                        {dayMerges.map((merge) => {
                          // A merged region with no task inside is just an
                          // empty frame: dim it and exclude it from copy/cut
                          // (only tasks can be copied).
                          const mergeHasTask = dayTasks.some((task) => {
                            const display = getTaskCalendarDisplay(task, date);
                            if (!display || display.kind !== 'scheduled') return false;
                            const displayStart = new Date(display.startMs);
                            const startMins = displayStart.getHours() * 60 + displayStart.getMinutes();
                            const duration = Math.max(1, (display.endMs - display.startMs) / 60000);
                            const blockStartHour = Math.floor(startMins / 60);
                            const blockEndHour = Math.min(24, Math.ceil((startMins + duration) / 60));
                            return blockStartHour >= merge.startHour && blockEndHour - 1 <= merge.endHour;
                          });

                          // Keep the merge metadata for whole-range selection,
                          // but let the scheduled task occupy the merged frame
                          // instead of drawing an empty-cell layer underneath.
                          if (mergeHasTask) return null;

                          return (
                          <div
                            key={`merge-${merge.startHour}-${merge.endHour}`}
                            data-calendar-range-start={merge.startHour}
                            data-calendar-range-end={merge.endHour}
                            onMouseDown={(event) => beginCellDrag(event, dayIndex, merge.startHour, merge.endHour)}
                            onClick={() => {
                              if (consumeSuppressedClick()) return;
                              // Left click / tap on a merged region behaves
                              // like an empty cell: open the "add task" popup
                              // with the whole merged frame prefilled.
                              openTaskScheduleModal(date, null, merge.startHour, merge.endHour, true);
                            }}
                            onTouchStart={(event) => startLongPress(event, dayIndex, merge.startHour, merge.endHour)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              if (nowMs() - longPressAtRef.current < 800) return;
                              openCellMenuAt(event, dayIndex, merge.startHour, merge.endHour);
                            }}
                            style={{
                              // Same 4px gap on top/bottom as the left/right
                              // inset, matching the task block inside it.
                              top: `${merge.startHour * 56 + 4}px`,
                              height: `${Math.max(40, (merge.endHour - merge.startHour + 1) * 56 - 8)}px`,
                            }}
                            title={
                              dayNote ||
                              (language === 'vi'
                                ? 'Ô đã gộp — bấm để thêm công việc, chuột phải để mở menu'
                                : 'Merged cells — click to add a task, right-click for the menu')
                            }
                            className='group absolute inset-x-1 z-[5] flex cursor-pointer select-none flex-col items-center justify-center gap-1.5 overflow-hidden rounded-3xl border border-violet-200/70 bg-violet-50/50 p-2 text-center opacity-60 transition-colors hover:bg-violet-100/60 dark:border-violet-300/70 dark:bg-violet-900/20 dark:hover:bg-violet-900/35'
                          >
                            {dayNote ? (
                              <p className='line-clamp-3 w-full min-w-0 break-words px-1 text-[11px] font-semibold leading-snug text-amber-900 dark:text-amber-200'>
                                {dayNote}
                              </p>
                            ) : (
                              <StickyNote className='h-4 w-4 shrink-0 text-violet-300 opacity-0 transition-opacity group-hover:opacity-60 dark:text-violet-600' />
                            )}
                          </div>
                          );
                        })}

                        {/* Scheduled Task Blocks Overlaid on Grid */}
                        {[...scheduledTaskBlocks, ...deadlineTaskBlocks].map((block) => {
                          const {
                            identity,
                            task,
                            members = [{ identity, task }],
                            memberIndex,
                            memberCount,
                            isSameTitleMerge,
                          } = block;
                          const display = getTaskCalendarDisplay(task, date);
                          if (!display) return null;

                          // Snap to the hour grid: the block covers every hour
                          // cell it touches, with the same 4px gap on the top
                          // and bottom as the left/right inset (inset-x-1).
                          const blockStartHour = Math.floor(
                            (block.startMs - dayStartMs) / 3600000
                          );
                          const blockEndHour = Math.min(
                            24,
                            Math.ceil((block.endMs - dayStartMs) / 3600000)
                          );
                          const topPx = blockStartHour * 56 + 4;
                          const heightPx = Math.max(40, (blockEndHour - blockStartHour) * 56 - 8);
                          const taskStartHour = blockStartHour;
                          const taskEndHour = blockEndHour;
                          const isDeadline = display.kind === 'deadline';
                          const isContinuation = !isDeadline
                            && display.originalStartMs < startOfDay(date).getTime();
                          // Task inside a merged region: press & hold selects
                          // the whole merged cell, treated as one big cell.
                          const overlappingMerge = getOverlappingCellMerge(
                            taskStartHour,
                            taskEndHour - 1,
                            dayMerges
                          );
                          const dragStartHour = overlappingMerge ? overlappingMerge.startHour : taskStartHour;
                          const isMergedTask = (
                            (Array.isArray(task.mergedTasks) && task.mergedTasks.length > 0)
                            || (Array.isArray(task.mergedOccurrences) && task.mergedOccurrences.length > 0)
                          );
                          const dragEndHour = overlappingMerge
                            ? overlappingMerge.endHour
                            : isMergedTask
                              ? taskEndHour - 1
                              : taskStartHour;
                          // Mini menu range for the task (right click / long press).
                          const menuStartHour = taskStartHour;
                          const menuEndHour = Math.min(
                            23,
                            Math.max(menuStartHour, taskEndHour - 1)
                          );
                          const isMovingThisTask = movingTask?.taskId === task._id
                            && (movingTask.calendarOccurrenceId || 'primary')
                              === (task.calendarOccurrenceId || 'primary');
                          const isResizingThisTask = resizingTask?.taskId === task._id
                            && resizingTask.calendarOccurrenceId === (task.calendarOccurrenceId || 'primary');
                          const isResizableTask = display.kind === 'scheduled'
                            && !isContinuation
                            && !isSameTitleMerge
                            && (block.isTaskStart || block.isTaskEnd);
                          const laneWidth = 100 / memberCount;
                          const onResizePointerDown = isResizableTask
                            ? (event) => {
                                const edge = getTaskResizeEdgeAtPoint(event);
                                if (
                                  (edge === 'start' && block.isTaskStart)
                                  || (edge === 'end' && block.isTaskEnd)
                                ) beginTaskResize(event, task, dayIndex, edge);
                              }
                            : undefined;
                          const onResizePointerMove = isResizableTask
                            ? (event) => {
                                const edge = getTaskResizeEdgeAtPoint(event);
                                event.currentTarget.style.cursor = (
                                  (edge === 'start' && block.isTaskStart)
                                  || (edge === 'end' && block.isTaskEnd)
                                ) ? 'ns-resize' : '';
                              }
                            : undefined;

                          return (
                            <div
                              key={`${identity}:${block.startMs}:${block.endMs}`}
                              onPointerDownCapture={onResizePointerDown}
                              onPointerMoveCapture={onResizePointerMove}
                              onPointerLeave={(event) => {
                                event.currentTarget.style.cursor = '';
                              }}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: `calc(${memberIndex * laneWidth}% + 4px)`,
                                width: `calc(${laneWidth}% - 8px)`,
                              }}
                              className={`group/task absolute z-10 transition-transform hover:z-30 hover:scale-[1.01] ${
                                isResizableTask ? 'pointer-events-auto' : 'pointer-events-none'
                              }`}
                            >
                            <div
                              data-task-card
                              {...(overlappingMerge || isMergedTask
                                ? {
                                    'data-calendar-range-start': dragStartHour,
                                    'data-calendar-range-end': dragEndHour,
                                  }
                                : {})}
                              {...(isMovingThisTask ? { 'data-moving-task-frame': '' } : {})}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (consumeSuppressedClick()) return;
                                if (isMovingThisTask) return;
                                openTaskPreviewModal(date, {
                                   ...task,
                                   virtualMembers: members.map(({ identity: memberIdentity, task: memberTask }) => ({
                                     identity: memberIdentity,
                                     taskId: memberTask._id,
                                     occurrenceId: memberTask.calendarOccurrenceId || 'primary',
                                     title: memberTask.title,
                                     startAt: memberTask.startAt,
                                     dueAt: memberTask.dueAt,
                                     estimatedMinutes: getTaskDurationMinutes(memberTask),
                                   })),
                                 });
                              }}
                              onMouseDown={(event) => {
                                if (isMovingThisTask) {
                                  beginMoveTaskDrag(event);
                                  return;
                                }
                                beginTaskCellDrag(
                                  event,
                                  task,
                                  dayIndex,
                                  date,
                                  dragStartHour,
                                  dragEndHour,
                                  overlappingMerge,
                                  members,
                                  block.startMs,
                                  block.endMs
                                );
                              }}
                              onTouchStart={(event) => startLongPress(event, dayIndex, menuStartHour, menuEndHour)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                if (nowMs() - longPressAtRef.current < 800) return;
                                openCellMenuAt(event, dayIndex, menuStartHour, menuEndHour);
                              }}
                              title={`${task.title}${isDeadline ? ` — ${t.dueDate}` : ''}`}
                              className={`pointer-events-auto absolute inset-0 flex select-none flex-col items-center justify-center overflow-hidden rounded-3xl border p-2 text-center text-white shadow-md transition-[opacity,box-shadow] duration-150 ease-out group-hover/task:shadow-lg ${
                                isMovingThisTask ? 'cursor-move ring-2 ring-violet-300' : 'cursor-pointer'
                              } ${
                                isResizingThisTask ? 'opacity-35' : ''
                              } ${
                                isDeadline
                                  ? 'border-amber-300 bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20 dark:border-amber-300'
                                  : 'border-violet-300 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-violet-500/20 dark:border-violet-400'
                              }`}
                            >
                              {(() => {
                                const memberTitles = [...new Set(members.map(({ task: memberTask }) => memberTask?.title || '').filter(Boolean))];
                                const stackedTitleCapacity = Math.max(1, Math.floor((heightPx - 30) / 14));
                                const showStackedTitles = memberTitles.length > 1 && memberTitles.length <= stackedTitleCapacity;
                                return (
                                  <div className='flex w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden text-xs font-bold leading-tight'>
                                    {showStackedTitles
                                      ? memberTitles.map((memberTitle, index) => (
                                          <span key={identity + ':' + index} className='w-full truncate'>{memberTitle}</span>
                                        ))
                                      : <span className='w-full break-words'>{memberTitles.join(' • ')}</span>}
                                  </div>
                                );
                              })()}
                              <p className='flex min-w-0 items-center gap-1 text-[10px] font-semibold opacity-90'>
                                <Clock className='h-2.5 w-2.5 shrink-0' />
                                <span className='truncate'>
                                  {isContinuation ? '↳ ' : ''}
                                  {formatTimeOnly(block.startMs, locale)}
                                </span>
                              </p>
                            </div>
                            </div>
                          );
                        })}

                        {resizingTask?.dayIndex === dayIndex ? (
                          <div
                            aria-hidden='true'
                            className='pointer-events-none absolute inset-x-1 z-40 rounded-3xl border-2 border-dashed border-violet-500 bg-violet-300/30 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)] transition-[top,height] duration-150 ease-out dark:border-violet-300 dark:bg-violet-500/25'
                            style={{
                              top: `${resizingTask.startHour * 56 + 4}px`,
                              height: `${Math.max(40, (resizingTask.endHour - resizingTask.startHour + 1) * 56 - 8)}px`,
                            }}
                          />
                        ) : null}

                        {movingTask && movingTask.dayIndex === dayIndex ? (
                          <div
                            data-moving-task-frame
                            onMouseDown={beginMoveTaskDrag}
                            className='absolute inset-x-1 z-40 cursor-move rounded-3xl border-2 border-violet-600/80 bg-violet-500/5 shadow-lg shadow-violet-500/10 dark:border-violet-300'
                            style={{
                              top: `${movingTask.startHour * 56 + 4}px`,
                              height: `${Math.max(40, movingTask.spanHours * 56 - 8)}px`,
                            }}
                          >
                          </div>
                        ) : null}
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
                      ? 'border-violet-300 bg-violet-50/60 dark:border-violet-300/70 dark:bg-violet-900/20'
                      : 'border-slate-200/80 bg-white/80 dark:border-slate-600 dark:bg-slate-800/80'
                  }`}
                >
                  <div className='flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-600'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-3xl text-sm font-extrabold ${
                          isToday
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <div className='min-w-0'>
                        <h3 className='truncate text-sm font-bold text-slate-900 dark:text-white'>
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
                        className='flex items-center gap-1 rounded-3xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'
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
                    <div className='mt-3 flex items-start gap-2.5 rounded-3xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-200'>
                      <StickyNote className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
                      <div
                        tabIndex={0}
                        role='region'
                        aria-label={t.dayNote}
                        className='scrollable-content max-h-32 min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] pr-1 font-medium'
                      >
                        {dayNote}
                      </div>
                    </div>
                  ) : null}

                  {/* Tasks List for Day */}
                  <div className='mt-3 space-y-2'>
                    {dayTasks.length ? (
                      dayTasks.map((task) => {
                        const display = getTaskCalendarDisplay(task, date);
                        const isDeadline = display?.kind === 'deadline';
                        return (
                          <div
                            key={getCalendarEventKey(task)}
                            onClick={() => openTaskScheduleModal(date, task)}
                            className='flex cursor-pointer items-center justify-between gap-2 rounded-3xl border border-slate-200/90 bg-white p-3 shadow-xs transition hover:border-violet-300 dark:border-slate-600 dark:bg-slate-700/80 dark:hover:border-violet-500'
                          >
                            <div className='flex min-w-0 flex-1 items-center gap-2.5'>
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-3xl ${isDeadline ? 'bg-amber-500' : 'bg-violet-600'}`} />
                              <div className='min-w-0'>
                                <p title={task.title} className='truncate text-xs font-bold text-slate-800 dark:text-slate-100'>
                                  {task.title}
                                </p>
                                <p className='truncate text-[11px] text-slate-500 dark:text-slate-400'>
                                  {display
                                    ? `${isDeadline ? t.dueDate : (language === 'vi' ? 'Bắt đầu' : 'Starts')} ${formatTimeOnly(display.startMs, locale)}`
                                    : t.taskUnscheduled}
                                </p>
                              </div>
                            </div>
                            <span className='shrink-0 rounded-3xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-500 dark:text-slate-300'>
                              {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                            </span>
                          </div>
                        );
                      })
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
        <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/80'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-2'>
              <List className='h-5 w-5 shrink-0 text-violet-600' />
              <h2 className='truncate text-sm font-bold text-slate-900 dark:text-white'>
                {t.unscheduledTasks} ({unscheduledTasks.length})
              </h2>
            </div>
            <span className='hidden shrink-0 text-xs text-slate-400 sm:inline'>
              {language === 'vi' ? 'Bấm để xếp vào lịch' : 'Click to schedule'}
            </span>
          </div>

          {unscheduledTasks.length ? (
            <div className='mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3'>
              {unscheduledTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => openTaskScheduleModal(selectedDate, task)}
                  className='flex cursor-pointer items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm dark:border-slate-500 dark:bg-slate-900/40 dark:hover:border-violet-500'
                >
                  <p title={task.title} className='min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100'>
                    {task.title}
                  </p>
                  <button
                    type='button'
                    className='shrink-0 rounded-3xl bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
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

      {/* ==================== EXCEL-STYLE SELECTION MINI MENU ==================== */}
      <AnimatePresence>
        {cellMenu && selectionRect ? (
          <motion.div
            ref={cellMenuRef}
            onContextMenu={(event) => event.preventDefault()}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
            className='fixed z-50 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-500 dark:bg-slate-800/95'
            role='menu'
          >
            <p className='truncate px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              {selectionSummary}
            </p>

            {[
              {
                key: 'fullday',
                icon: CalendarClock,
                label: t.selectFullDay || 'Chọn cả ngày',
                disabled: isFullDaySelection,
                hint: t.fullDaySelected || 'Đã chọn trọn ngày rồi.',
                onClick: handleSelectFullDay,
              },
              { key: 'divider-fullday', divider: true },
              {
                key: 'merge',
                icon: Combine,
                label: canUnmergeSelection
                  ? t.unmergeCells || 'Bỏ gộp ô'
                  : t.mergeAndCenter || 'Gộp ô & căn giữa',
                disabled: mergeActionDisabled,
                hint: t.mergeMultipleCellsOnly,
                onClick: handleMergeSelection,
              },
              { key: 'divider-merge', divider: true },
              {
                key: 'move',
                icon: Move,
                label: t.moveTask || (language === 'vi' ? 'Di chuyển task' : 'Move task'),
                disabled: !canMoveTask,
                hint: t.moveTaskUnavailable
                  || (language === 'vi'
                    ? 'Chỉ có thể di chuyển khi vùng chọn chứa đúng 1 công việc bắt đầu trong ngày đã chọn.'
                    : 'Move is available when the selection contains exactly one task that starts on the selected day.'),
                onClick: handleStartMoveTask,
              },
              {
                key: 'copy',
                icon: Copy,
                label: t.copy,
                disabled: !selectionTasks.length,
                hint: t.selectionEmpty || 'Không có công việc trong vùng chọn',
                onClick: handleCopySelection,
              },
              {
                key: 'cut',
                icon: Scissors,
                label: t.cutTasks,
                disabled: !selectionTasks.length,
                hint: t.selectionEmpty || 'Không có công việc trong vùng chọn',
                onClick: handleCutSelection,
              },
              {
                key: 'paste',
                icon: ClipboardPaste,
                label: t.pasteTasks,
                onClick: handlePasteSelection,
              },
              {
                key: 'clear',
                icon: Trash2,
                label: t.deleteTasks,
                disabled: !selectionTasks.length,
                hint: t.selectionEmpty,
                onClick: handleClearSelection,
              },
              { key: 'divider-selection', divider: true },
            ].map((item) =>
              item.divider ? (
                <div
                  key={item.key}
                  className='mx-2 my-1 border-t border-slate-200/80 dark:border-slate-500/70'
                />
              ) : (
                <button
                  key={item.key}
                  type='button'
                  role='menuitem'
                  disabled={item.disabled}
                  onClick={item.onClick}
                  title={item.disabled ? item.hint : item.label}
                  className={`flex w-full items-center gap-2.5 rounded-3xl px-3 py-2 text-xs font-semibold transition ${
                    item.disabled
                      ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                      : 'cursor-pointer text-slate-700 hover:bg-violet-100/80 hover:text-violet-800 dark:text-slate-200 dark:hover:bg-violet-500/15 dark:hover:text-violet-200'
                  }`}
                >
                  <item.icon className='h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400' />
                  <span className='truncate'>{item.label}</span>
                </button>
              )
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

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
              className='flex h-[min(400px,90vh)] w-[min(540px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(145deg,#ffffff,#f8faff)] shadow-2xl dark:border-white/20 dark:bg-[linear-gradient(145deg,#1b2438,#151e33)]'
            >
              {/* Modal Header */}
              <header className='flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-600'>
                <div className='min-w-0 flex-1'>
                  <h3 className='truncate text-base font-extrabold text-slate-900 dark:text-white'>
                    {activeModal.mode === 'preview' && previewTask
                      ? previewTask.title
                      : activeModal.date
                      ? new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(activeModal.date)
                      : t.calendarTitle}
                  </h3>
                  <p className='text-xs text-slate-400'>
                    {activeModal.mode === 'preview'
                      ? t.taskPreview || (language === 'vi' ? 'Xem trước công việc' : 'Task preview')
                      : activeModal.mode === 'note'
                      ? language === 'vi'
                        ? 'Ghi chú cho ngày này'
                        : 'Day Note'
                      : language === 'vi'
                      ? 'Lên lịch công việc vào khung giờ'
                      : 'Schedule task time block'}
                  </p>
                </div>

                <div className='flex shrink-0 items-center gap-1.5'>
                  {/* Mode switcher tabs inside modal */}
                  {activeModal.mode !== 'preview' ? (
                    <div className='flex rounded-3xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-500 dark:bg-slate-800'>
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
                  ) : null}

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
              <div className='flex flex-1 flex-col overflow-y-auto p-6'>
                {activeModal.mode === 'preview' && previewTask ? (
                  /* Task preview: full content, or every task inside a merged block */
                  <div className='flex h-full flex-col gap-4'>
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <span
                        className={`rounded-3xl px-2.5 py-1 text-[10px] font-bold ${
                          previewTask.status === 'complete'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                        }`}
                      >
                        {previewTask.status === 'complete'
                          ? t.completed || 'Completed'
                          : t.taskInProgress || (language === 'vi' ? 'Đang thực hiện' : 'In progress')}
                      </span>
                      {previewTask.important ? (
                        <span className='rounded-3xl bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'>
                          {t.important || 'Important'}
                        </span>
                      ) : null}
                      {previewTask.startAt ? (
                        <span className='flex items-center gap-1 rounded-3xl bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300'>
                          <Clock className='h-3 w-3 shrink-0' />
                          {formatTimeOnly(previewTask.startAt, locale)}
                          {previewTask.dueAt ? ` – ${formatTimeOnly(previewTask.dueAt, locale)}` : ''}
                        </span>
                      ) : null}
                      {previewTask.estimatedMinutes ? (
                        <span className='rounded-3xl bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300'>
                          {previewTask.estimatedMinutes}m
                        </span>
                      ) : null}
                    </div>

                    {previewMergedEntries.length >= 2 ? (
                      <div className='scrollable-content flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1'>
                        <p className='text-xs font-bold text-slate-600 dark:text-slate-300'>
                          {t.mergedTasksTitle || (language === 'vi' ? 'Các công việc đã gộp' : 'Merged tasks')} ({previewMergedEntries.length})
                        </p>
                        {previewMergedEntries.map((entry, index) => {
                          const liveEntry = allTasks.find((task) => task._id === entry.taskId);
                          const entryTitle = liveEntry?.title
                            || entry.title
                            || (entry.occurrenceId
                              ? formatText('occurrenceLabel', { count: index + 1 })
                              : t.untitled || 'Task');
                          return (
                            <div
                              key={`${entry.taskId}-${index}`}
                              className='rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-500 dark:bg-slate-800'
                            >
                              <div className='flex items-center gap-2'>
                                <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-3xl bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'>
                                  {index + 1}
                                </span>
                                <p className='min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100' title={entryTitle}>
                                  {entryTitle}
                                </p>
                                {liveEntry?.status === 'complete' ? (
                                  <span className='shrink-0 rounded-3xl bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'>
                                    ✓ {t.completed || 'Completed'}
                                  </span>
                                ) : null}
                              </div>
                              <p className='mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
                                <Clock className='h-3 w-3 shrink-0' />
                                <span className='truncate'>
                                  {entry.startAt
                                    ? `${formatTimeOnly(entry.startAt, locale)}${entry.dueAt ? ` – ${formatTimeOnly(entry.dueAt, locale)}` : ''}`
                                    : t.taskUnscheduled || (language === 'vi' ? 'Chưa lên lịch' : 'Unscheduled')}
                                </span>
                              </p>
                              {liveEntry?.content ? (
                                <p className='mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-500 dark:text-slate-400'>
                                  {liveEntry.content}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
                        <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
                          {t.taskNote || (language === 'vi' ? 'Ghi chú' : 'Note')}
                        </p>
                        <div className='scrollable-content min-h-0 flex-1 whitespace-pre-wrap break-words rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700 shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'>
                          {previewTask.content ? (
                            previewTask.content
                          ) : (
                            <span className='italic text-slate-400 dark:text-slate-500'>
                              {t.noTaskContent || (language === 'vi' ? 'Không có ghi chú.' : 'No note.')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className='mt-auto flex items-center justify-between gap-2 pt-2'>
                      <div className='flex items-center gap-1'>
                        {previewTask.startAt && getTaskDurationMinutes(previewTask) > 60 ? (
                          <button
                            type='button'
                            onClick={() => handleUnmergeTask(previewTask)}
                            disabled={selectionActionMutation.isPending}
                            className='flex items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-900/30'
                          >
                            <Split className='h-4 w-4' />
                            {t.unmergeTasks || 'Bỏ gộp'}
                          </button>
                        ) : null}
                        <button
                          type='button'
                          onClick={() => deleteCalendarTaskMutation.mutate({
                            taskId: previewTask._id,
                            occurrenceId: previewTask.calendarOccurrenceId,
                            date: activeModal.date,
                            task: previewTask,
                          })}
                          disabled={deleteCalendarTaskMutation.isPending}
                          className='flex items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-900/30'
                        >
                          <Trash2 className='h-4 w-4' />
                          {previewTask.calendarOccurrenceId
                            && previewTask.calendarOccurrenceId !== 'primary'
                            && !previewTask.createdFromCalendar
                            ? t.deleteCalendarOccurrence
                            : previewTask.createdFromCalendar
                              ? t.deleteTask
                              : t.deleteCalendarOccurrence}
                        </button>
                      </div>

                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => openTaskScheduleModal(activeModal.date, previewTask)}
                          className='flex items-center gap-1.5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95'
                        >
                          <CalendarClock className='h-3.5 w-3.5' />
                          {t.editSchedule || (language === 'vi' ? 'Chỉnh sửa lịch' : 'Edit schedule')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeModal.mode === 'note' ? (
                  /* Form: Day Note (Google Calendar Style) */
                  <form onSubmit={handleSaveNote} className='flex h-full flex-col gap-4'>
                    <div className='relative flex-1'>
                      <label htmlFor='modal-day-note-input' className='sr-only'>
                        {t.dayNote}
                      </label>
                      <textarea
                        id='modal-day-note-input'
                        autoFocus
                        rows={6}
                        maxLength={4000}
                        value={noteInput}
                        disabled={!notesReady || noteMutation.isPending}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder={
                          t.dayNotePlaceholder ||
                          (language === 'vi'
                            ? 'Viết ghi chú quan trọng, nhắc nhở hoặc nhật ký công việc cho ngày này...'
                            : 'Add a private note or log for this day…')
                        }
                        className='h-full min-h-32 w-full resize-none rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-900/30'
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
                          disabled={!notesReady || noteMutation.isPending}
                          className='flex items-center gap-1 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-900/30'
                        >
                          <Trash2 className='h-4 w-4' />
                          <span>{language === 'vi' ? 'Xóa ghi chú' : 'Delete note'}</span>
                        </button>
                      ) : <div />}

                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setActiveModal(null)}
                          className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300'
                        >
                          {t.close}
                        </button>
                        <button
                          type='submit'
                          disabled={!notesReady || noteMutation.isPending}
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
                  <form onSubmit={handleSaveSchedule} className='flex h-full flex-col gap-4'>
                    <div>
                      <label htmlFor={scheduleTaskSelectId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                        {t.selectTask}
                      </label>
                      <SelectMenu
                        id={scheduleTaskSelectId}
                        value={taskScheduleForm.taskId}
                        onChange={handleScheduleTaskChange}
                        ariaLabel={t.selectTask}
                        placeholder={t.selectTaskPlaceholder}
                        options={[
                          { value: NEW_TASK_ID, label: t.createNewTaskOption },
                          ...allTasks.map((task) => ({
                            value: task._id,
                            label: `${task.title}${task.status === 'complete' ? ' ✓' : ''}`,
                          })),
                        ]}
                        className='h-10 w-full px-3 text-xs shadow-sm'
                      />
                    </div>

                    {taskScheduleForm.taskId === NEW_TASK_ID ? (
                      <div>
                        <label htmlFor={scheduleNewTitleId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                          {t.newTaskTitle}
                        </label>
                        <input
                          id={scheduleNewTitleId}
                          type='text'
                          maxLength={200}
                          autoFocus={activeModal.focusNewTaskTitle}
                          value={taskScheduleForm.newTitle}
                          onChange={(e) =>
                            setTaskScheduleForm((prev) => ({ ...prev, newTitle: e.target.value }))
                          }
                          placeholder={t.newTaskTitlePlaceholder}
                          className='h-10 w-full rounded-3xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-900/30'
                        />
                      </div>
                    ) : null}

                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <label htmlFor={scheduleStartTimeId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                          {t.startTime}
                        </label>
                        <DateTimePicker
                          id={scheduleStartTimeId}
                          value={taskScheduleForm.startAt}
                          onChange={(nextValue) =>
                            setTaskScheduleForm((prev) => ({ ...prev, startAt: nextValue }))
                          }
                          ariaLabel={t.startTime}
                          placeholder={t.startTime}
                          className='shadow-sm'
                        />
                      </div>

                      <div>
                        <label htmlFor={scheduleDeadlineId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                          {t.dueDate}
                        </label>
                        <DateTimePicker
                          id={scheduleDeadlineId}
                          value={taskScheduleForm.dueAt}
                          onChange={(nextValue) =>
                            setTaskScheduleForm((prev) => ({ ...prev, dueAt: nextValue }))
                          }
                          ariaLabel={t.dueDate}
                          placeholder={t.dueDate}
                          className='shadow-sm'
                        />
                      </div>
                    </div>

                    <div className='mt-auto flex items-center justify-between pt-2'>
                      {(selectedScheduleTask?.startAt
                        || selectedScheduleTask?.dueAt
                        || (activeModal?.task?.calendarOccurrenceId
                          && activeModal.task.calendarOccurrenceId !== 'primary')) ? (
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
                          className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300'
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
                            : t.saveSchedule}
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

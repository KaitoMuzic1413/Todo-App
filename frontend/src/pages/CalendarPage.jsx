import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import CalendarToolbar from '@/components/calendar/CalendarToolbar';
import MonthView from '@/components/calendar/MonthView';
import WeekDayView from '@/components/calendar/WeekDayView';
import AgendaView from '@/components/calendar/AgendaView';
import UnscheduledTasks from '@/components/calendar/UnscheduledTasks';
import SelectionMenu from '@/components/calendar/SelectionMenu';
import CalendarModals from '@/components/calendar/CalendarModals';
import {
  EMPTY_TASKS,
  getStoredUser,
  getTaskBlockBounds,
  NEW_TASK_ID,
  nowMs,
  toLocalInputValue,
} from '@/lib/calendarPageHelpers';
import {
  createTask,
  deleteTask,
  fetchCalendarNotes,
  fetchCalendarTasks,
  saveCalendarNote,
  updateTask,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { TASK_TITLE_MAX_LENGTH } from '@/lib/utils';
import useCalendarData from '@/hooks/calendar/useCalendarData';
import useCalendarNavigation from '@/hooks/calendar/useCalendarNavigation';
import useCurrentTime from '@/hooks/calendar/useCurrentTime';
import {
  buildCalendarMergedTitle,
  dateKey,
  getCalendarSegmentDaySpan,
  buildCalendarTaskMerge,
  getCalendarTaskMergeRange,
  getSequentialUnmergeSchedule,
  getCalendarEventKey,
  getTaskCalendarOccurrences,
  planCalendarTaskPlacement,
  getTaskCalendarDisplay,
  resolveCellDragRange,
  getTaskDragIntent,
  getTaskDurationMinutes,
  getCalendarTaskBlockRange,
  isCalendarMergeOccupied,
  splitCalendarTaskRange,
  startOfDay,
  toggleCalendarCellMerge,
} from '@/lib/calendarUtils';

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

  const {
    monthOptions,
    yearOptions,
    calendarDays,
    calendarDateKeys,
    calendarRange,
    changePeriod,
    jumpToToday,
    periodLabel,
  } = useCalendarNavigation({
    viewMode,
    selectedDate,
    setSelectedDate,
    locale,
  });

  useEffect(() => {
    if (!currentUser?._id) navigate('/signin', { replace: true });
  }, [currentUser, navigate]);

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

  const {
    calendarNotesQuery,
    taskQuery,
    tasks,
    allTasks,
    taskByDate,
    unscheduledTasks,
  } = useCalendarData({
    currentUser,
    calendarDateKeys,
    calendarRange,
    calendarDays,
  });

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
    const addSegmentMergeFrames = (segments) => {
      for (const segment of segments) {
        const span = getCalendarSegmentDaySpan(segment);
        if (!span) continue;
        const merges = getMerges(span.dayKey);
        if (merges.some(
          (merge) => merge.startHour === span.startHour && merge.endHour === span.endHour
        )) continue;
        merges.push({ startHour: span.startHour, endHour: span.endHour });
        mergeUpdates.set(span.dayKey, [...new Map(
          merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
        ).values()].sort((left, right) => left.startHour - right.startHour));
      }
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
        addSegmentMergeFrames(segments);
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

  const createCalendarMergedTask = useCallback(async (piece, timeZone) => {
    const title = buildCalendarMergedTitle(piece.members).slice(0, TASK_TITLE_MAX_LENGTH);
    if (!title) return null;
    const response = await createTask({
      userId: currentUser._id,
      title,
      contentType: 'task',
      important: piece.members.some(({ task }) => Boolean(task?.important)),
      createdFromCalendar: false,
      startAt: new Date(piece.startMs).toISOString(),
      dueAt: new Date(piece.endMs).toISOString(),
      estimatedMinutes: piece.estimatedMinutes
        || Math.max(1, Math.round((piece.endMs - piece.startMs) / 60000)),
      timeZone,
    });
    return response.data;
  }, [currentUser]);

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
      targetTask,
      startMs,
      endMs,
      sourceEventKey,
      mergesByDate,
      sourceMerge,
      timeZone,
      groupMembers,
      groupStartMs,
      materializePiece,
      pieceMembers,
      pieceStartMs,
      pieceEndMs,
    }) => {
      if (Array.isArray(groupMembers) && groupMembers.length > 1) {
        const deltaMs = startMs - groupStartMs;
        const schedules = groupMembers.map(({ task }) => {
          const originalStartMs = new Date(task.startAt).getTime();
          const durationMinutes = getTaskDurationMinutes(task);
          return {
            task,
            originalStartAt: task.startAt,
            originalDueAt: task.dueAt,
            originalDuration: durationMinutes,
            shiftedStartMs: originalStartMs + deltaMs,
            durationMinutes,
          };
        });
        const results = await Promise.allSettled(schedules.map((schedule) => updateTask(
          schedule.task._id,
          currentUser._id,
          {
            startAt: new Date(schedule.shiftedStartMs).toISOString(),
            dueAt: new Date(schedule.shiftedStartMs + schedule.durationMinutes * 60000).toISOString(),
            estimatedMinutes: schedule.durationMinutes,
            timeZone,
            calendarOccurrenceId: schedule.task.calendarOccurrenceId || 'primary',
          }
        )));
        const failedUpdate = results.find((result) => result.status === 'rejected');
        if (failedUpdate) {
          await Promise.allSettled(schedules.map((schedule) => updateTask(
            schedule.task._id,
            currentUser._id,
            {
              startAt: schedule.originalStartAt,
              dueAt: schedule.originalDueAt,
              estimatedMinutes: schedule.originalDuration,
              timeZone,
              calendarOccurrenceId: schedule.task.calendarOccurrenceId || 'primary',
            }
          )));
          throw failedUpdate.reason;
        }
        return { movedGroup: true, moveKey: sourceEventKey };
      }

      let currentCalendarTasks = calendarRange
        ? (await fetchCalendarTasks(calendarRange)).data || []
        : tasks;
      let effectiveTargetTask = targetTask;
      let effectiveSourceEventKey = sourceEventKey;
      let effectiveMergesByDate = mergesByDate;
      let effectiveSourceMerge = sourceMerge;
      let forceWinnerMergeFrame = false;

      if (
        materializePiece
        && Array.isArray(pieceMembers)
        && pieceMembers.length
        && Number.isFinite(pieceStartMs)
        && Number.isFinite(pieceEndMs)
      ) {
        const latestNotes = (await fetchCalendarNotes(calendarDateKeys)).data || mergesByDate;
        const memberKeys = new Set(
          pieceMembers.map(({ task: memberTask }) => getCalendarEventKey(memberTask))
        );
        const liveMembers = [];
        for (const event of getTaskCalendarOccurrences(currentCalendarTasks)) {
          const eventKey = getCalendarEventKey(event);
          if (!memberKeys.has(eventKey)) continue;
          if (liveMembers.some((member) => getCalendarEventKey(member) === eventKey)) continue;
          liveMembers.push(event);
        }
        const sourceSplitTasks = liveMembers.flatMap((member) => {
          const memberStartMs = new Date(member.startAt).getTime();
          const memberEndMs = memberStartMs + getTaskDurationMinutes(member) * 60000;
          if (!(memberStartMs < pieceEndMs && memberEndMs > pieceStartMs)) return [];
          return [{
            task: member,
            segments: splitCalendarTaskRange(member, pieceStartMs, pieceEndMs),
          }];
        });
        if (sourceSplitTasks.length) {
          const changedSourceNotes = await writeCalendarPlacementChanges(
            sourceSplitTasks,
            [],
            latestNotes,
            timeZone
          );
          effectiveMergesByDate = { ...latestNotes, ...changedSourceNotes };
        }

        const createdPiece = await createTask({
          userId: currentUser._id,
          title: String(targetTask.title || '').trim().slice(0, TASK_TITLE_MAX_LENGTH),
          contentType: targetTask.contentType || 'task',
          content: targetTask.content || '',
          important: Boolean(targetTask.important),
          createdFromCalendar: Boolean(targetTask.createdFromCalendar),
          startAt: new Date(pieceStartMs).toISOString(),
          dueAt: new Date(pieceEndMs).toISOString(),
          estimatedMinutes: Math.max(1, Math.round((pieceEndMs - pieceStartMs) / 60000)),
          timeZone,
        });
        effectiveTargetTask = createdPiece.data;
        effectiveSourceEventKey = getCalendarEventKey(createdPiece.data);
        forceWinnerMergeFrame = pieceMembers.length > 1;
        effectiveSourceMerge = null;
        currentCalendarTasks = calendarRange
          ? (await fetchCalendarTasks(calendarRange)).data || []
          : tasks;
      }

      const candidate = {
        ...effectiveTargetTask,
        startAt: new Date(startMs).toISOString(),
        estimatedMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
      };
      const placement = planCalendarTaskPlacement(
        currentCalendarTasks,
        candidate,
        effectiveMergesByDate,
        effectiveSourceEventKey
      );
      if (!placement) throw new Error('Unable to calculate the task schedule.');

      const moveKey = sourceEventKey;
      const winner = placement.survivor;
      const winnerKey = getCalendarEventKey(winner);
      const winnerSegments = placement.segments.map((segment) => ({
        ...segment,
        estimatedMinutes: segment.estimatedMinutes
          || Math.max(1, Math.round((segment.endMs - segment.startMs) / 60000)),
      }));

      const changedNotes = (
        placement.splitTasks.length || placement.absorbedTasks.length
      )
        ? await writeCalendarPlacementChanges(
            placement.splitTasks,
            placement.absorbedTasks,
            effectiveMergesByDate,
            timeZone
          )
        : {};
      const workingNotes = { ...effectiveMergesByDate, ...changedNotes };

      const response = await writeCalendarOccurrenceSegments(
        winner._id,
        winner.calendarOccurrenceId || 'primary',
        winnerSegments,
        timeZone
      );

      for (const piece of placement.mergedPieces) {
        await createCalendarMergedTask(piece, timeZone);
      }

      const mergeUpdates = new Map();
      const getMerges = (key) => {
        if (!mergeUpdates.has(key)) {
          mergeUpdates.set(key, [...(workingNotes[key]?.merges || [])]);
        }
        return mergeUpdates.get(key);
      };
      const setMerges = (key, merges) => {
        mergeUpdates.set(key, [...new Map(
          merges.map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
        ).values()].sort((left, right) => left.startHour - right.startHour));
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
        setMerges(linked.dayKey, getMerges(linked.dayKey).filter((merge) => !(
          merge.startHour === linked.frame.startHour
          && merge.endHour === linked.frame.endHour
        )));
        return true;
      };
      const addSegmentMergeFrame = (segment) => {
        const span = getCalendarSegmentDaySpan(segment);
        if (!span) return;
        const merges = getMerges(span.dayKey);
        if (merges.some(
          (merge) => merge.startHour === span.startHour && merge.endHour === span.endHour
        )) return;
        setMerges(span.dayKey, [
          ...merges,
          { startHour: span.startHour, endHour: span.endHour },
        ]);
      };

      const winnerHadMergeFrame = removeTaskMergeFrame(winner);
      if (effectiveSourceMerge) {
        setMerges(effectiveSourceMerge.dayKey, getMerges(effectiveSourceMerge.dayKey).filter((merge) => !(
          merge.startHour === effectiveSourceMerge.startHour
          && merge.endHour === effectiveSourceMerge.endHour
        )));
      }
      if (effectiveSourceMerge || winnerHadMergeFrame || forceWinnerMergeFrame) {
        winnerSegments.forEach(addSegmentMergeFrame);
      }
      for (const piece of placement.mergedPieces) {
        addSegmentMergeFrame(piece);
      }
      if (mergeUpdates.size) {
        await Promise.all([...mergeUpdates].map(([key, merges]) => saveCalendarNote(key, undefined, merges)));
        await queryClient.invalidateQueries({ queryKey: ['calendarNotes', currentUser?._id] });
      }

      return {
        ...withCalendarTaskUpdates(response),
        placementSplit: winnerSegments.length > 1,
        placementWinnerKey: winnerKey,
        moveKey,
        placementMerged: placement.mergedPieces.length > 0,
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
        || response?.placementMerged
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
  const startLongPress = useCallback((event, dayIndex, startHour, endHour) => {
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
  }, [clearLongPress]);

  // Consume the "this click came right after a long press / drag" window.
  const consumeSuppressedClick = useCallback(() => {
    if (nowMs() >= suppressClickUntilRef.current) return false;
    suppressClickUntilRef.current = 0;
    return true;
  }, []);

  // Start a cell drag. `endHour` lets a merged region act as one big cell:
  // pressing anywhere inside it selects the whole region immediately.
  const beginCellDrag = useCallback((event, dayIndex, hour, endHour = hour) => {
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
  }, []);

  const beginMoveTaskDrag = useCallback((event) => {
    const isMousePointer = event.pointerType === 'mouse' || event.pointerType === 'pen';
    if (isMousePointer && event.button !== 0) return;
    if (!isMousePointer && typeof event.button === 'number' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = event.touches?.[0] || event;
    moveDragActiveRef.current = true;
    moveDragMovedRef.current = false;
    moveDragStartRef.current = { x: point.clientX, y: point.clientY };
    setCellsSelecting(true);
  }, []);

  const beginTaskResize = useCallback((event, task, dayIndex, edge) => {
    if (event.button !== 0 || !task.startAt) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
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
      originalStartHour: startHour,
      originalEndHour: endHour,
      title: task.title,
      originalStartMs: startMs,
    };
    resizingTaskRef.current = resize;
    resizeDragMovedRef.current = false;
    setResizingTask(resize);
    cancelCellDrag();
    setCellsSelecting(true);
    moveTaskCandidateRef.current = null;
  }, [cancelCellDrag, clearLongPress]);

  const getTaskResizeEdgeAtPoint = useCallback((event) => {
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
  }, []);

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

  const createMoveTaskCandidate = useCallback((
    task, dayIndex, date, sourceMerge, blockMembers, blockStartMs, blockEndMs, clientY,
    isSameTitleMerge = false
  ) => {
    if (blockMembers.length <= 1 && (
      !task.startAt
      || dateKey(new Date(task.startAt)) !== dateKey(date)
    )) return null;

    const dayStartMs = startOfDay(date).getTime();
    const hasBlockRange = Number.isFinite(blockStartMs) && Number.isFinite(blockEndMs);
    const blockSpanHours = hasBlockRange
      ? Math.max(1, Math.ceil((blockEndMs - blockStartMs) / 3600000))
      : null;
    const blockStartHour = hasBlockRange
      ? Math.floor((blockStartMs - dayStartMs) / 3600000)
      : null;
    const gridRect = calendarGridRef.current?.getBoundingClientRect();
    const pointerHour = gridRect?.height
      ? Math.floor(((clientY - gridRect.top) / gridRect.height) * 24)
      : blockStartHour;

    if (blockMembers.length > 1 && hasBlockRange && !isSameTitleMerge) {
      return {
        taskId: blockMembers[0]?.task?._id || task._id,
        calendarOccurrenceId: blockMembers[0]?.task?.calendarOccurrenceId || 'primary',
        title: (buildCalendarMergedTitle(blockMembers) || task.title || '')
          .slice(0, TASK_TITLE_MAX_LENGTH),
        createdAt: task.createdAt,
        status: task.status,
        contentType: 'task',
        content: '',
        important: blockMembers.some(({ task: memberTask }) => Boolean(memberTask?.important)),
        createdFromCalendar: false,
        dayIndex,
        startHour: blockStartHour,
        endHour: blockStartHour + blockSpanHours - 1,
        spanHours: blockSpanHours,
        grabOffsetHours: Math.max(0, Math.min(blockSpanHours - 1, pointerHour - blockStartHour)),
        durationMinutes: blockSpanHours * 60,
        sourceMerge: null,
        materializePiece: true,
        pieceMembers: blockMembers,
        pieceStartMs: blockStartMs,
        pieceEndMs: blockEndMs,
      };
    }

    if (blockMembers.length > 1 && hasBlockRange) {
      return {
        taskId: task._id,
        calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
        title: task.title,
        createdAt: task.createdAt,
        status: task.status,
        dayIndex,
        startHour: blockStartHour,
        endHour: blockStartHour + blockSpanHours - 1,
        spanHours: blockSpanHours,
        grabOffsetHours: Math.max(0, Math.min(blockSpanHours - 1, pointerHour - blockStartHour)),
        durationMinutes: blockSpanHours * 60,
        sourceMerge: null,
        groupStartMs: blockStartMs,
        groupMembers: blockMembers,
      };
    }

    const durationMinutes = getTaskDurationMinutes(task);
    const initialSpan = Math.max(1, Math.ceil(durationMinutes / 60));
    const taskStartHour = new Date(task.startAt).getHours();
    const isPartialTaskPiece = hasBlockRange && (
      blockSpanHours < initialSpan
      || blockStartHour !== taskStartHour
    );
    if (isPartialTaskPiece) {
      return {
        taskId: task._id,
        calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
        title: task.title,
        createdAt: task.createdAt,
        status: task.status,
        contentType: task.contentType || 'task',
        content: task.content || '',
        important: Boolean(task.important),
        createdFromCalendar: Boolean(task.createdFromCalendar),
        dayIndex,
        startHour: blockStartHour,
        endHour: blockStartHour + blockSpanHours - 1,
        spanHours: blockSpanHours,
        grabOffsetHours: Math.max(0, Math.min(blockSpanHours - 1, pointerHour - blockStartHour)),
        durationMinutes: blockSpanHours * 60,
        sourceMerge: null,
        materializePiece: true,
        pieceMembers: blockMembers,
        pieceStartMs: blockStartMs,
        pieceEndMs: blockEndMs,
      };
    }

    const taskMerge = sourceMerge?.startHour === taskStartHour
      && sourceMerge.endHour >= taskStartHour + initialSpan - 1
      ? sourceMerge
      : null;
    const spanHours = taskMerge
      ? taskMerge.endHour - taskMerge.startHour + 1
      : initialSpan;
    const targetStartHour = taskMerge ? taskMerge.startHour : taskStartHour;
    const fallbackPointerHour = gridRect?.height
      ? Math.floor(((clientY - gridRect.top) / gridRect.height) * 24)
      : targetStartHour;
    return {
      taskId: task._id,
      calendarOccurrenceId: task.calendarOccurrenceId || 'primary',
      title: task.title,
      createdAt: task.createdAt,
      status: task.status,
      dayIndex,
      startHour: targetStartHour,
      endHour: targetStartHour + spanHours - 1,
      spanHours,
      grabOffsetHours: Math.max(0, Math.min(spanHours - 1, fallbackPointerHour - targetStartHour)),
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
  }, []);

  const beginTaskPointerDrag = useCallback((
    event, task, dayIndex, date, sourceMerge,
    blockMembers = [], blockStartMs = null, blockEndMs = null,
    isSameTitleMerge = false
  ) => {
    if (event.button !== 0 || nowMs() - longPressAtRef.current < 800) return;
    const candidate = createMoveTaskCandidate(
      task,
      dayIndex,
      date,
      sourceMerge,
      blockMembers,
      blockStartMs,
      blockEndMs,
      event.clientY,
      isSameTitleMerge
    );
    if (!candidate) return;

    moveTaskCandidateRef.current = candidate;
    moveDragActiveRef.current = false;
    moveDragMovedRef.current = false;
    moveDragStartRef.current = { x: event.clientX, y: event.clientY };
  }, [createMoveTaskCandidate]);

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
        const deltaX = event.clientX - moveDragStartRef.current.x;
        const deltaY = event.clientY - moveDragStartRef.current.y;
        const intent = getTaskDragIntent(deltaX, deltaY);
        if (intent) {
          moveTaskCandidateRef.current = null;
          moveDragActiveRef.current = false;
          moveDragMovedRef.current = false;
          suppressClickUntilRef.current = nowMs() + 600;
          clearLongPress();

          if (intent === 'move') {
            cancelCellDrag();
            setCellSelection(null);
            setCellMenu(null);
            movingTaskRef.current = moveCandidate;
            setMovingTask(moveCandidate);
            setCellsSelecting(true);
            moveDragActiveRef.current = true;
            moveDragMovedRef.current = true;
            updateMovingTaskFromPoint(event.clientX, event.clientY);
            return;
          }

          movingTaskRef.current = null;
          setMovingTask(null);
          isSelectingCellsRef.current = true;
          setCellsSelecting(true);
          const anchorHour = moveCandidate.startHour;
          const focusHour = moveCandidate.endHour;
          cellDragAnchorRef.current = {
            dayIndex: moveCandidate.dayIndex,
            hour: anchorHour,
            rangeStart: anchorHour,
            rangeEnd: focusHour,
          };
          cellDragFocusRef.current = {
            dayIndex: moveCandidate.dayIndex,
            hour: focusHour,
            anchorHour,
          };
          cellDragStartFocusRef.current = {
            dayIndex: moveCandidate.dayIndex,
            hour: focusHour,
          };
          setCellMenu(null);
          setCellSelection({
            anchorDay: moveCandidate.dayIndex,
            anchorHour,
            focusDay: moveCandidate.dayIndex,
            focusHour,
          });
          updateCellSelectionFromPoint(event.clientX, event.clientY);
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
    clearLongPress,
    updateCellSelectionFromPoint,
    updateMovingTaskFromPoint,
    updateResizingTaskFromPoint,
  ]);

  useEffect(() => {
    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;

      lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY };
      if (resizingTaskRef.current) {
        if (event.cancelable) event.preventDefault();
        updateResizingTaskFromPoint(touch.clientX, touch.clientY);
        return;
      }
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
  }, [clearLongPress, updateCellSelectionFromPoint, updateResizingTaskFromPoint]);

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
      materializePiece: move.materializePiece,
      pieceMembers: move.pieceMembers,
      pieceStartMs: move.pieceStartMs,
      pieceEndMs: move.pieceEndMs,
      targetTask: {
        _id: move.taskId,
        title: move.title,
        createdAt: move.createdAt,
        status: move.status,
        contentType: move.contentType,
        content: move.content,
        important: move.important,
        createdFromCalendar: move.createdFromCalendar,
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
    if (
      resize.startHour === resize.originalStartHour
      && resize.endHour === resize.originalEndHour
    ) {
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
      moveTaskCandidateRef.current = null;
      if (!moveDragActiveRef.current) return;
      moveDragActiveRef.current = false;
      setCellsSelecting(false);
      if (!moveDragMovedRef.current) return;
      suppressClickUntilRef.current = nowMs() + 600;
      commitMovingTask();
    };

    const handleMoveCancel = () => {
      moveTaskCandidateRef.current = null;
      if (!moveDragActiveRef.current) return;
      moveDragActiveRef.current = false;
      moveDragMovedRef.current = false;
      setCellsSelecting(false);
    };

    window.addEventListener('mouseup', handleMoveMouseUp);
    window.addEventListener('pointerup', handleMoveMouseUp);
    window.addEventListener('pointercancel', handleMoveCancel);
    return () => {
      window.removeEventListener('mouseup', handleMoveMouseUp);
      window.removeEventListener('pointerup', handleMoveMouseUp);
      window.removeEventListener('pointercancel', handleMoveCancel);
    };
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
  const openCellMenuAt = useCallback((event, dayIndex, anchorHour, focusHour) => {
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
  }, [cancelCellDrag]);

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
      moveTaskCandidateRef.current = null;
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

  // Close the mini menu only on an outside click or Escape.
  useEffect(() => {
    if (!cellMenu) return undefined;

    const handlePointerDown = (event) => {
      if (cellMenuRef.current?.contains(event.target)) return;
      if (nowMs() < suppressClickUntilRef.current) return;
      suppressClickUntilRef.current = nowMs() + 300;
      cancelCellDrag();
      closeCellMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeCellMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelCellDrag, cellMenu, closeCellMenu]);

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
      const extraMergeFrames = new Map();
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
        if (!placement?.segments.length && !placement?.mergedPieces.length) continue;

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
        if (segments.length) {
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
        }

        for (const piece of placement.mergedPieces) {
          await createCalendarMergedTask(piece, timeZone);
          const span = getCalendarSegmentDaySpan(piece);
          if (span) {
            const frames = extraMergeFrames.get(span.dayKey) || [];
            if (!frames.some(
              (frame) => frame.startHour === span.startHour && frame.endHour === span.endHour
            )) {
              frames.push({ startHour: span.startHour, endHour: span.endHour });
            }
            extraMergeFrames.set(span.dayKey, frames);
          }
        }

        const updatedNotes = await writeCalendarPlacementChanges(
          placement.splitTasks,
          placement.absorbedTasks,
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
        workingNotes = {
          ...workingNotes,
          [dayKey]: { ...workingNotes[dayKey], merges: nextMerges },
        };
      }
      for (const [dayKey, frames] of extraMergeFrames) {
        const currentDayMerges = workingNotes[dayKey]?.merges || [];
        const nextMerges = [...new Map(
          [...currentDayMerges, ...frames]
            .map((merge) => [`${merge.startHour}:${merge.endHour}`, merge])
        ).values()].sort((left, right) => left.startHour - right.startHour);
        await saveCalendarNote(dayKey, undefined, nextMerges);
      }
      if (placedCount && (expandedMerges || extraMergeFrames.size)) {
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
          title: taskMerge.title.slice(0, TASK_TITLE_MAX_LENGTH),
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
    const taskKey = getCalendarEventKey(movableTask);
    const hasTaskOverlap = getTaskCalendarOccurrences(tasks).some((otherTask) => {
      if (getCalendarEventKey(otherTask) === taskKey || !otherTask.startAt) return false;
      const otherDisplay = getTaskCalendarDisplay(otherTask, taskDay);
      return otherDisplay?.kind === 'scheduled'
        && otherDisplay.startMs < display.endMs
        && otherDisplay.endMs > display.startMs;
    });
    const selectionStartMs = Math.max(display.startMs, selectionRect.startMs);
    const selectionEndMs = Math.min(display.endMs, selectionRect.endMs);
    const isPartialPiece = hasTaskOverlap
      && selectionEndMs > selectionStartMs
      && (selectionStartMs > display.startMs || selectionEndMs < display.endMs);
    const pieceStartHour = isPartialPiece
      ? Math.floor((selectionStartMs - startOfDay(taskDay).getTime()) / 3600000)
      : null;
    const pieceSpanHours = isPartialPiece
      ? Math.max(1, Math.ceil((selectionEndMs - selectionStartMs) / 3600000))
      : null;
    const spanHours = isPartialPiece
      ? pieceSpanHours
      : (sourceMerge
          ? sourceMerge.endHour - sourceMerge.startHour + 1
          : initialSpan);
    const targetStartHour = isPartialPiece
      ? pieceStartHour
      : (sourceMerge ? sourceMerge.startHour : startHour);

    const nextMove = {
      taskId: movableTask._id,
      calendarOccurrenceId: movableTask.calendarOccurrenceId || 'primary',
      title: movableTask.title,
      createdAt: movableTask.createdAt,
      status: movableTask.status,
      contentType: movableTask.contentType || 'task',
      content: movableTask.content || '',
      important: Boolean(movableTask.important),
      createdFromCalendar: Boolean(movableTask.createdFromCalendar),
      dayIndex,
      startHour: targetStartHour,
      endHour: targetStartHour + spanHours - 1,
      spanHours,
      durationMinutes: isPartialPiece
        ? pieceSpanHours * 60
        : (sourceMerge ? spanHours * 60 : durationMinutes),
      sourceMerge: isPartialPiece || !sourceMerge
        ? null
        : {
            dayKey: calendarDateKeys[dayIndex],
            startHour: sourceMerge.startHour,
            endHour: sourceMerge.endHour,
            spanHours,
          },
      materializePiece: isPartialPiece,
      pieceMembers: isPartialPiece
        ? [{ identity: taskKey, task: movableTask }]
        : undefined,
      pieceStartMs: isPartialPiece ? selectionStartMs : undefined,
      pieceEndMs: isPartialPiece ? selectionEndMs : undefined,
    };
    movingTaskRef.current = nextMove;
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

  // Modal Open Handlers
  const hydrateNoteForModal = useCallback((date) => {
    const key = dateKey(date);
    if (!notesReady) {
      noteHydratedKeyRef.current = null;
      setNoteInput('');
      return;
    }
    noteHydratedKeyRef.current = key;
    setNoteInput(calendarNotesQuery.data?.[key]?.content || '');
  }, [calendarNotesQuery.data, notesReady]);

  const openNoteModal = useCallback((date) => {
    hydrateNoteForModal(date);
    setActiveModal({ mode: 'note', date, task: null });
  }, [hydrateNoteForModal]);

  const openTaskPreviewModal = useCallback((date, task) => {
    setActiveModal({ mode: 'preview', date, task });
  }, []);

  const openTaskScheduleModal = useCallback((date, task = null, hour = null, endHour = null, focusNewTaskTitle = false) => {
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
  }, [hydrateNoteForModal]);

  const handleCreateNote = useCallback(() => {
    openNoteModal(selectedDate);
  }, [openNoteModal, selectedDate]);

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
    const newTitle = taskScheduleForm.newTitle.trim().slice(0, TASK_TITLE_MAX_LENGTH);

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

  const now = useCurrentTime();
  const currentDayKey = dateKey(now);
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const currentTimePercentage = (currentMinutesFromMidnight / 1440) * 100;

  if (!currentUser?._id) return null;

  return (
    <LayoutShell>
      <div className='space-y-5 pb-12'>
        <Header />

        <CalendarToolbar
          calendarTitle={t.calendarTitle}
          periodLabel={periodLabel}
          today={t.today}
          previousPeriod={t.previousPeriod}
          nextPeriod={t.nextPeriod}
          selectMonth={t.selectMonth}
          selectYear={t.selectYear}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          viewMode={viewMode}
          setViewMode={setViewMode}
          language={language}
          monthView={t.monthView}
          weekView={t.weekView}
          dayView={t.dayView}
          onJumpToToday={jumpToToday}
          onChangePeriod={changePeriod}
          onCreate={handleCreateNote}
        />

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
          <MonthView
            calendarDays={calendarDays}
            selectedDate={selectedDate}
            taskByDate={taskByDate}
            calendarNotes={calendarNotesQuery.data}
            currentDayKey={currentDayKey}
            locale={locale}
            language={language}
            t={t}
            openNoteModal={openNoteModal}
            openTaskScheduleModal={openTaskScheduleModal}
          />
        ) : viewMode === 'week' || viewMode === 'day' ? (
          <WeekDayView
            viewMode={viewMode}
            calendarDays={calendarDays}
            calendarNotes={calendarNotesQuery.data}
            taskByDate={taskByDate}
            cellsSelecting={cellsSelecting}
            calendarGridRef={calendarGridRef}
            currentDayKey={currentDayKey}
            currentTimePercentage={currentTimePercentage}
            selectionRect={selectionRect}
            movingTask={movingTask}
            resizingTask={resizingTask}
            locale={locale}
            language={language}
            t={t}
            getTaskResizeEdgeAtPoint={getTaskResizeEdgeAtPoint}
            beginTaskResize={beginTaskResize}
            consumeSuppressedClick={consumeSuppressedClick}
            openTaskScheduleModal={openTaskScheduleModal}
            beginCellDrag={beginCellDrag}
            startLongPress={startLongPress}
            openCellMenuAt={openCellMenuAt}
            longPressAtRef={longPressAtRef}
            beginMoveTaskDrag={beginMoveTaskDrag}
            beginTaskPointerDrag={beginTaskPointerDrag}
            openTaskPreviewModal={openTaskPreviewModal}
            setSelectedDate={setSelectedDate}
            setViewMode={setViewMode}
            openNoteModal={openNoteModal}
          />
        ) : (
          <AgendaView
            calendarDays={calendarDays}
            taskByDate={taskByDate}
            calendarNotes={calendarNotesQuery.data}
            currentDayKey={currentDayKey}
            locale={locale}
            language={language}
            t={t}
            openNoteModal={openNoteModal}
            openTaskScheduleModal={openTaskScheduleModal}
          />
        )}

        <UnscheduledTasks
          unscheduledTasks={unscheduledTasks}
          selectedDate={selectedDate}
          openTaskScheduleModal={openTaskScheduleModal}
          language={language}
          t={t}
        />
      </div>

      <SelectionMenu
        cellMenu={cellMenu}
        selectionRect={selectionRect}
        menuRef={cellMenuRef}
        menuLeft={menuLeft}
        menuTop={menuTop}
        selectionSummary={selectionSummary}
        t={t}
        language={language}
        isFullDaySelection={isFullDaySelection}
        canUnmergeSelection={canUnmergeSelection}
        mergeActionDisabled={mergeActionDisabled}
        canMoveTask={canMoveTask}
        selectionTasksCount={selectionTasks.length}
        onSelectFullDay={handleSelectFullDay}
        onMergeSelection={handleMergeSelection}
        onStartMoveTask={handleStartMoveTask}
        onCopySelection={handleCopySelection}
        onCutSelection={handleCutSelection}
        onPasteSelection={handlePasteSelection}
        onClearSelection={handleClearSelection}
      />

      <CalendarModals
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        previewTask={previewTask}
        previewMergedEntries={previewMergedEntries}
        allTasks={allTasks}
        locale={locale}
        language={language}
        t={t}
        formatText={formatText}
        noteInput={noteInput}
        setNoteInput={setNoteInput}
        notesReady={notesReady}
        noteMutation={noteMutation}
        handleSaveNote={handleSaveNote}
        handleDeleteNote={handleDeleteNote}
        deleteCalendarTaskMutation={deleteCalendarTaskMutation}
        selectionActionMutation={selectionActionMutation}
        handleUnmergeTask={handleUnmergeTask}
        openTaskScheduleModal={openTaskScheduleModal}
        scheduleTaskSelectId={scheduleTaskSelectId}
        scheduleStartTimeId={scheduleStartTimeId}
        scheduleDeadlineId={scheduleDeadlineId}
        scheduleNewTitleId={scheduleNewTitleId}
        taskScheduleForm={taskScheduleForm}
        setTaskScheduleForm={setTaskScheduleForm}
        handleScheduleTaskChange={handleScheduleTaskChange}
        selectedScheduleTask={selectedScheduleTask}
        handleClearSchedule={handleClearSchedule}
        handleSaveSchedule={handleSaveSchedule}
        scheduleMutation={scheduleMutation}
      />
    </LayoutShell>
  );
};

export default CalendarPage;

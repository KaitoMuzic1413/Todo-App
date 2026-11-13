import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Attachment from '../models/Attachment.js';
import { deleteAttachmentRecords } from './attachmentsControllers.js';
import { validateTaskSchedule } from '../utils/taskSchedule.js';
import {
  getSingleUnmergedSchedule,
  replaceCalendarOccurrenceSegments,
} from '../utils/calendarOccurrences.js';
import GamificationEvent from '../models/GamificationEvent.js';
import { checkTaskQuota, getQuotaSnapshot } from '../utils/premium.js';
import {
  DAILY_TASK_GOAL,
  getActivityKeys,
  getGoalBonusEvents,
  getTaskCompletionIdempotencyKey,
  TASK_COMPLETION_XP,
  WEEKLY_TASK_GOAL,
} from '../utils/gamification.js';

const getUserFilter = (req) => {
  const userId = req.user?.userId;
  if (!userId) return null;
  return { userId };
};

const getAuthenticatedUserId = (req) => req.user?.userId;

const touchUserActivity = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }, { returnDocument: 'after' });
};

const awardTaskCompletionXp = async ({ userId, taskId, timeZone = 'UTC' }) => {
  const now = new Date();
  let validatedTimeZone = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: validatedTimeZone }).format(now);
  } catch {
    validatedTimeZone = 'UTC';
  }
  const { activityDate, weekStart } = getActivityKeys(now, validatedTimeZone);
  let award;
  try {
    award = await GamificationEvent.updateOne(
      { userId, idempotencyKey: getTaskCompletionIdempotencyKey(taskId) },
      {
        $setOnInsert: {
          userId,
          taskId,
          eventType: 'taskComplete',
          idempotencyKey: getTaskCompletionIdempotencyKey(taskId),
          xp: TASK_COMPLETION_XP,
          activityDate,
          weekStart,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }

  if (!award.upsertedCount) return;

  const [dailyCompletionCount, weeklyCompletionCount] = await Promise.all([
    GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', activityDate }),
    GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', weekStart }),
  ]);
  const bonusEvents = getGoalBonusEvents({ dailyCompletionCount, weeklyCompletionCount, activityDate, weekStart });
  for (const bonus of bonusEvents) {
    await GamificationEvent.updateOne(
      { userId, idempotencyKey: bonus.idempotencyKey },
      { $setOnInsert: { userId, ...bonus } },
      { upsert: true }
    );
  }
};

const revokeTaskCompletionXp = async ({ userId, taskId }) => {
  const event = await GamificationEvent.findOneAndDelete({
    userId,
    idempotencyKey: getTaskCompletionIdempotencyKey(taskId),
  });
  if (!event) return;

  const [dailyCompletionCount, weeklyCompletionCount] = await Promise.all([
    GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', activityDate: event.activityDate }),
    GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', weekStart: event.weekStart }),
  ]);

  if (dailyCompletionCount < DAILY_TASK_GOAL) {
    await GamificationEvent.deleteOne({ userId, idempotencyKey: `dailyGoal:${event.activityDate}` });
  }
  if (weeklyCompletionCount < WEEKLY_TASK_GOAL) {
    await GamificationEvent.deleteOne({ userId, idempotencyKey: `weeklyGoal:${event.weekStart}` });
  }
};

const getTrashDateFilter = ({ start, endExclusive, period }) => {
  if (start && endExclusive) {
    const startDate = new Date(start);
    const endDate = new Date(endExclusive);
    if (Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime()) && startDate < endDate) {
      return { $gte: startDate, $lt: endDate };
    }
    return null;
  }

  if (!period || period === 'all') return null;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = new Date(startDate);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nowExclusive = new Date(now.getTime() + 1);

  if (period === 'today') {
    return { $gte: todayStart, $lt: nowExclusive };
  }

  if (period === 'week') return { $gte: weekStart, $lt: nowExclusive };
  if (period === 'month') return { $gte: monthStart, $lt: nowExclusive };
  if (period === 'beforeMonth') return { $lt: monthStart };

  return null;
};

export const cleanupExpiredTrashTasks = async () => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await Task.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff },
    });

    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleanupExpiredTrashTasks:', error);
    return 0;
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const userFilter = getUserFilter(req);
    const contentType = ['task', 'note', 'list'].includes(req.query.contentType)
      ? req.query.contentType
      : null;

    if (!userFilter) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    await touchUserActivity(userFilter.userId);

    const typeFilter = contentType === 'task'
      ? { $or: [{ contentType: 'task' }, { contentType: { $exists: false } }] }
      : contentType
      ? { contentType }
      : {};
    const tasks = await Task.find({
      ...userFilter,
      isDeleted: false,
      ...typeFilter,
    }).sort({ lastUsedAt: -1, createdAt: -1 });
    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Error getAllTasks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getCalendarTasks = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { start, endExclusive } = req.query;
    const rangeStart = new Date(start);
    const rangeEnd = new Date(endExclusive);

    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    if (!Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeStart >= rangeEnd) {
      return res.status(400).json({ message: 'A valid calendar range is required.' });
    }
    if (rangeEnd.getTime() - rangeStart.getTime() > 62 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'Calendar ranges cannot exceed 62 days.' });
    }

    const scheduleLookback = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000);
    const tasks = await Task.find({
      userId,
      isDeleted: false,
      $and: [
        { $or: [{ contentType: 'task' }, { contentType: { $exists: false } }] },
        {
          $or: [
            { startAt: { $gte: scheduleLookback, $lt: rangeEnd } },
            { dueAt: { $gte: rangeStart, $lt: rangeEnd } },
            {
              calendarOccurrences: {
                $elemMatch: {
                  $or: [
                    { startAt: { $gte: scheduleLookback, $lt: rangeEnd } },
                    { dueAt: { $gte: rangeStart, $lt: rangeEnd } },
                  ],
                },
              },
            },
            { startAt: null, dueAt: null },
          ],
        },
      ],
    }).sort({ startAt: 1, dueAt: 1, createdAt: -1 });

    await touchUserActivity(userId);
    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Error getCalendarTasks:', error);
    return res.status(500).json({ message: 'Unable to load calendar tasks.' });
  }
};

export const getUserQuota = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const snapshot = await getQuotaSnapshot(userId);
    if (!snapshot) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json(snapshot);
  } catch (error) {
    console.error('Error getUserQuota', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const appendCalendarOccurrence = async (task, schedule) => {
  const { startAt, dueAt, estimatedMinutes, timeZone } = schedule;
  if ((!startAt && !dueAt) || (startAt && dueAt && dueAt <= startAt)) {
    return { error: 'A calendar occurrence must have a valid schedule.' };
  }

  task.calendarOccurrences.push({
    startAt: startAt || null,
    dueAt: dueAt || null,
    estimatedMinutes: estimatedMinutes ?? null,
    timeZone: timeZone || null,
  });
  const addedOccurrence = task.calendarOccurrences.at(-1);
  return { occurrenceId: String(addedOccurrence._id) };
};

export const createTask = async (req, res) => {
  try {
    const {
      title,
      contentType = 'task',
      content = '',
      items = [],
      important = false,
      parentTaskId = null,
      createdFromCalendar = false,
    } = req.body;
    const userId = getAuthenticatedUserId(req);

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    if (!['task', 'note', 'list'].includes(contentType)) {
      return res.status(400).json({ message: 'Invalid content type.' });
    }

    if (contentType === 'list' && (!Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ message: 'A list needs at least one item.' });
    }

    if (contentType === 'note' && !String(content).trim()) {
      return res.status(400).json({ message: 'Note content is required.' });
    }

    const schedule = validateTaskSchedule(req.body);
    if (schedule.error) return res.status(400).json({ message: schedule.error });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (parentTaskId && !mongoose.isValidObjectId(parentTaskId)) {
      return res.status(400).json({ message: 'Invalid parent task id.' });
    }
    if (parentTaskId && (contentType !== 'task' || !(await Task.exists({
      _id: parentTaskId,
      userId,
      isDeleted: false,
      $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
    })))) {
      return res.status(404).json({ message: 'Parent task not found.' });
    }

    const trimmedTitle = title.trim();

    if (contentType === 'task') {
      const existingTask = await Task.findOne({
        userId,
        title: trimmedTitle,
        isDeleted: false,
        $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
      }).sort({ lastUsedAt: -1, createdAt: -1 });

      if (existingTask) {
        existingTask.lastUsedAt = new Date();
        let addedOccurrenceId = null;
        if (schedule.updates.startAt || schedule.updates.dueAt) {
          const scheduleUpdates = schedule.updates;
          const hasPrimarySchedule = Boolean(existingTask.startAt || existingTask.dueAt);
          const hasOccurrences = existingTask.calendarOccurrences?.length > 0;
          if (!hasPrimarySchedule && !hasOccurrences) {
            Object.assign(existingTask, scheduleUpdates);
          } else {
            const occurrenceInput = {
              startAt: scheduleUpdates.startAt ?? null,
              dueAt: scheduleUpdates.dueAt ?? null,
              estimatedMinutes: scheduleUpdates.estimatedMinutes ?? null,
              timeZone: scheduleUpdates.timeZone ?? null,
            };
            const result = await appendCalendarOccurrence(existingTask, occurrenceInput);
            if (result.error) return res.status(400).json({ message: result.error });
            addedOccurrenceId = result.occurrenceId;
          }
        }

        const reusedTask = await existingTask.save();
        await touchUserActivity(userId);
        return res.status(200).json({
          ...reusedTask.toObject(),
          reusedExistingTask: true,
          addedOccurrenceId,
        });
      }
    }

    const { snapshot, exceeded } = await checkTaskQuota(userId);
    if (exceeded) {
      return res.status(403).json({
        code: 'TASK_QUOTA_EXCEEDED',
        message: snapshot.premiumActive
          ? 'You have reached the maximum number of tasks for this plan.'
          : 'You have reached the free task limit. Upgrade to Premium to add more tasks.',
        quota: snapshot,
      });
    }

    const task = new Task({
      userId,
      parentTaskId,
      title: trimmedTitle,
      contentType,
      content: contentType === 'note' ? String(content).trim() : '',
      createdFromCalendar: contentType === 'task' && createdFromCalendar === true,
      items: contentType === 'list'
        ? items.map((item) => ({ text: String(item.text || item).trim(), completed: !!item.completed }))
        : undefined,
      status: 'active',
      completedAt: null,
      important: Boolean(important),
      ...schedule.updates,
    });

    const newTask = await task.save();
    await touchUserActivity(userId);
    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Error createTask:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Snapshot entries for calendar-merged tasks. `null` clears the snapshot.
const sanitizeMergedTasks = (input) => {
  if (input === null) return { entries: [] };
  if (!Array.isArray(input)) return { error: 'mergedTasks must be an array.' };
  if (input.length > 100) return { error: 'mergedTasks supports up to 100 entries.' };

  const entries = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') return { error: 'Invalid merged task entry.' };
    const taskId = String(entry.taskId || '');
    if (!mongoose.isValidObjectId(taskId)) return { error: 'Invalid merged task id.' };

    const parseDate = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date;
    };
    const startAt = parseDate(entry.startAt);
    const dueAt = parseDate(entry.dueAt);
    if (startAt === undefined || dueAt === undefined) {
      return { error: 'Invalid merged task schedule.' };
    }

    const rawMinutes = entry.estimatedMinutes;
    const estimatedMinutes = rawMinutes === null || rawMinutes === undefined || rawMinutes === ''
      ? null
      : Number(rawMinutes);
    if (estimatedMinutes !== null
      && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440)) {
      return { error: 'Invalid merged task duration.' };
    }

    entries.push({
      taskId,
      title: String(entry.title || '').slice(0, 300),
      startAt,
      dueAt,
      estimatedMinutes,
    });
  }
  return { entries };
};

export const updateTask = async (req, res) => {
  try {
    const { title, status, completedAt, content, items } = req.body;
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOne({ _id: req.params.id, userId, isDeleted: false });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (req.body.replaceCalendarOccurrenceSegments !== undefined) {
      const replacement = req.body.replaceCalendarOccurrenceSegments;
      if (
        !replacement
        || typeof replacement !== 'object'
        || Array.isArray(replacement)
        || !Array.isArray(replacement.segments)
        || replacement.segments.length > 2
      ) {
        return res.status(400).json({ message: 'Provide up to two valid calendar segments.' });
      }

      const occurrenceId = String(replacement.occurrenceId || 'primary');
      const target = occurrenceId === 'primary'
        ? task
        : task.calendarOccurrences.id(occurrenceId);
      if (!target || (!target.startAt && !target.dueAt)) {
        return res.status(404).json({ message: 'Calendar occurrence not found.' });
      }

      const schedules = [];
      for (const segment of replacement.segments) {
        if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
          return res.status(400).json({ message: 'Each calendar segment must be an object.' });
        }
        const schedule = validateTaskSchedule(segment);
        if (schedule.error) return res.status(400).json({ message: schedule.error });
        const { startAt, dueAt } = schedule.updates;
        if (!startAt || !dueAt || dueAt <= startAt) {
          return res.status(400).json({ message: 'Each calendar segment needs a valid start and end.' });
        }
        schedules.push(schedule.updates);
      }
      if (
        schedules.length === 2
        && schedules[1].startAt <= schedules[0].dueAt
      ) {
        return res.status(400).json({ message: 'Split calendar segments must not overlap or touch.' });
      }

      if (!replaceCalendarOccurrenceSegments(task, occurrenceId, schedules)) {
        return res.status(404).json({ message: 'Calendar occurrence not found.' });
      }

      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json(updatedTask);
    }

    if (req.body.addCalendarOccurrence !== undefined) {
      const occurrenceInput = req.body.addCalendarOccurrence;
      if (!occurrenceInput || typeof occurrenceInput !== 'object' || Array.isArray(occurrenceInput)) {
        return res.status(400).json({ message: 'A valid calendar occurrence is required.' });
      }
      const occurrenceSchedule = validateTaskSchedule(occurrenceInput);
      if (occurrenceSchedule.error) return res.status(400).json({ message: occurrenceSchedule.error });
      const result = await appendCalendarOccurrence(task, occurrenceSchedule.updates);
      if (result.error) return res.status(400).json({ message: result.error });
      task.lastUsedAt = new Date();
      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json({
        ...updatedTask.toObject(),
        addedOccurrenceId: result.occurrenceId,
      });
    }

    if (req.body.removeCalendarOccurrenceId) {
      const occurrence = task.calendarOccurrences.id(req.body.removeCalendarOccurrenceId);
      if (!occurrence) return res.status(404).json({ message: 'Calendar occurrence not found.' });
      occurrence.deleteOne();
      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json(updatedTask);
    }

    if (req.body.mergeCalendarOccurrenceIds !== undefined) {
      const occurrenceIds = req.body.mergeCalendarOccurrenceIds;
      if (!Array.isArray(occurrenceIds) || occurrenceIds.length < 2 || occurrenceIds.length > 100) {
        return res.status(400).json({ message: 'Select at least two calendar occurrences to merge.' });
      }
      const uniqueIds = [...new Set(occurrenceIds.map(String))];
      if (uniqueIds.length !== occurrenceIds.length) {
        return res.status(400).json({ message: 'Calendar occurrences must be unique.' });
      }
      const schedule = validateTaskSchedule(req.body);
      if (schedule.error) return res.status(400).json({ message: schedule.error });
      const { startAt, dueAt, estimatedMinutes, timeZone } = schedule.updates;
      if (!startAt || !dueAt || dueAt <= startAt) {
        return res.status(400).json({ message: 'A merged occurrence needs a valid start and end time.' });
      }

      const selectedOccurrences = uniqueIds.map((occurrenceId) => {
        const source = occurrenceId === 'primary' ? task : task.calendarOccurrences.id(occurrenceId);
        if (!source || (!source.startAt && !source.dueAt)) return null;
        const nestedSnapshots = Array.isArray(source.mergedOccurrences) ? source.mergedOccurrences : [];
        return nestedSnapshots.length
          ? nestedSnapshots.map((entry) => (entry.toObject ? entry.toObject() : { ...entry }))
          : [{
              occurrenceId,
              startAt: source.startAt || null,
              dueAt: source.dueAt || null,
              estimatedMinutes: source.estimatedMinutes ?? null,
              timeZone: source.timeZone || null,
            }];
      });
      if (selectedOccurrences.some((entry) => !entry)) {
        return res.status(404).json({ message: 'One or more calendar occurrences were not found.' });
      }
      const snapshots = selectedOccurrences.flat();
      const survivorId = uniqueIds.includes('primary')
        ? 'primary'
        : uniqueIds[0];
      const mergedSchedule = {
        startAt,
        dueAt,
        estimatedMinutes: estimatedMinutes ?? Math.max(1, Math.round((dueAt - startAt) / 60000)),
        timeZone: timeZone || null,
        mergedOccurrences: snapshots,
      };

      if (survivorId === 'primary') {
        Object.assign(task, mergedSchedule);
      } else {
        const survivor = task.calendarOccurrences.id(survivorId);
        if (!survivor) return res.status(404).json({ message: 'Calendar occurrence not found.' });
        Object.assign(survivor, mergedSchedule);
      }
      for (const occurrenceId of uniqueIds) {
        if (occurrenceId !== 'primary' && occurrenceId !== survivorId) {
          task.calendarOccurrences.id(occurrenceId)?.deleteOne();
        }
      }
      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json(updatedTask);
    }

    if (req.body.unmergeCalendarOccurrenceId) {
      const occurrenceId = String(req.body.unmergeCalendarOccurrenceId);
      const target = occurrenceId === 'primary' ? task : task.calendarOccurrences.id(occurrenceId);
      if (!target) return res.status(404).json({ message: 'Calendar occurrence not found.' });
      const snapshots = Array.isArray(target.mergedOccurrences) ? target.mergedOccurrences : [];
      if (!snapshots.length) return res.status(400).json({ message: 'This occurrence is not merged.' });

      const schedule = getSingleUnmergedSchedule(target);
      if (!schedule) return res.status(400).json({ message: 'The merged occurrence has no valid start time.' });
      Object.assign(target, {
        ...schedule,
        mergedOccurrences: undefined,
      });
      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json(updatedTask);
    }

    if (req.body.calendarOccurrenceId) {
      const occurrenceId = String(req.body.calendarOccurrenceId);
      const occurrence = occurrenceId === 'primary' ? task : task.calendarOccurrences.id(occurrenceId);
      if (!occurrence) return res.status(404).json({ message: 'Calendar occurrence not found.' });
      const occurrenceSchedule = validateTaskSchedule(req.body, occurrence);
      if (occurrenceSchedule.error) return res.status(400).json({ message: occurrenceSchedule.error });
      Object.assign(occurrence, occurrenceSchedule.updates);
      if (req.body.clearMergedOccurrences) {
        occurrence.mergedOccurrences = [];
      }
      if (occurrenceSchedule.updates.dueAt !== undefined) {
        task.dueEmailReminderSentFor = null;
        task.dueEmailReminderRetryAfter = null;
        task.dueNotificationSentFor = null;
      }
      const updatedTask = await task.save();
      await touchUserActivity(userId);
      return res.status(200).json({
        ...updatedTask.toObject(),
      });
    }

    const schedule = validateTaskSchedule(req.body, task);
    if (schedule.error) return res.status(400).json({ message: schedule.error });

    const normalizedItems = items !== undefined && Array.isArray(items)
      ? items.map((item) => ({ text: String(item.text || item).trim(), completed: !!item.completed }))
      : null;
    const allItemsCompleted = normalizedItems?.length > 0 && normalizedItems.every((item) => item.completed);
    const nextStatus = normalizedItems && task.contentType === 'list'
      ? (allItemsCompleted ? 'complete' : 'active')
      : status;

    let mergedTasksUpdate;
    if (Object.hasOwn(req.body, 'mergedTasks')) {
      const sanitizedMerges = sanitizeMergedTasks(req.body.mergedTasks);
      if (sanitizedMerges.error) return res.status(400).json({ message: sanitizedMerges.error });
      mergedTasksUpdate = sanitizedMerges.entries;
    }

    const nextData = {
      ...schedule.updates,
      ...(title ? { title: title.trim() } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(normalizedItems ? { items: normalizedItems } : {}),
      ...(mergedTasksUpdate !== undefined ? { mergedTasks: mergedTasksUpdate } : {}),
      ...(req.body.clearMergedOccurrences === true ? { mergedOccurrences: [] } : {}),
      ...(normalizedItems && task.contentType === 'list'
        ? { completedAt: allItemsCompleted ? new Date() : null }
        : (completedAt !== undefined ? { completedAt } : {})),
      ...(content !== undefined ? { content: String(content).trim() } : {}),
    };

    if (Object.hasOwn(schedule.updates, 'dueAt')) {
      nextData.dueEmailReminderSentFor = null;
      nextData.dueEmailReminderRetryAfter = null;
      nextData.dueNotificationSentFor = null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'important')) {
      nextData.important = !!req.body.important;
    }

    if (nextStatus === 'complete' && !task.completedAt && !normalizedItems) {
      nextData.completedAt = new Date();
    }

    if (nextStatus === 'active' && !normalizedItems) {
      nextData.completedAt = null;
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, nextData, { returnDocument: 'after', runValidators: true });
    if (nextStatus === 'complete' && task.status === 'active' && task.contentType !== 'note' && task.contentType !== 'list') {
      await revokeTaskCompletionXp({ userId, taskId: task._id });
    }
    if (nextStatus === 'complete' && task.contentType !== 'note' && task.contentType !== 'list') {
      await awardTaskCompletionXp({ userId, taskId: task._id, timeZone: req.body.timeZone || task.timeZone || 'UTC' });
    }
    if (task.status === 'complete' && nextStatus === 'active' && task.contentType !== 'note' && task.contentType !== 'list') {
      await revokeTaskCompletionXp({ userId, taskId: task._id });
    }
    await touchUserActivity(userId);
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error updateTask:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { returnDocument: 'after' }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await Attachment.updateMany(
      { taskId: task._id, ownerId: userId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    await touchUserActivity(userId);
    return res.status(200).json({ message: 'Task moved to trash successfully', task });
  } catch (error) {
    console.error('Error deleteTask:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const toggleTaskStatus = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOne({ _id: req.params.id, userId, isDeleted: false });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const nextStatus = task.status === 'active' ? 'complete' : 'active';
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        status: nextStatus,
        completedAt: nextStatus === 'complete' ? new Date() : null,
      },
      { returnDocument: 'after' }
    );

    if (nextStatus === 'complete' && task.contentType !== 'note' && task.contentType !== 'list') {
      if (task.status === 'active') {
        await revokeTaskCompletionXp({ userId, taskId: task._id });
      }
      await awardTaskCompletionXp({ userId, taskId: task._id, timeZone: req.body.timeZone || task.timeZone || 'UTC' });
    } else if (nextStatus === 'active' && task.contentType !== 'note' && task.contentType !== 'list') {
      await revokeTaskCompletionXp({ userId, taskId: task._id });
    }

    await touchUserActivity(userId);
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error toggleTaskStatus:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const restoreTask = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOne({ _id: req.params.id, userId, isDeleted: true });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const restoredTask = await Task.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, deletedAt: null },
      { returnDocument: 'after' }
    );

    await Attachment.updateMany(
      { taskId: task._id, ownerId: userId, isDeleted: true },
      { isDeleted: false, deletedAt: null }
    );

    await touchUserActivity(userId);
    return res.status(200).json({ message: 'Task restored successfully', task: restoredTask });
  } catch (error) {
    console.error('Error restoreTask:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deletePermanentTask = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId, isDeleted: true });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await deleteAttachmentRecords({ taskId: task._id, ownerId: userId });

    await touchUserActivity(userId);
    return res.status(200).json({ message: 'Task permanently deleted', task });
  } catch (error) {
    console.error('Error deletePermanentTask:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const clearTrash = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const deletedTasks = await Task.find({ userId, isDeleted: true }).select('_id');
    await Promise.all(deletedTasks.map((task) => deleteAttachmentRecords({ taskId: task._id, ownerId: userId })));
    const result = await Task.deleteMany({ userId, isDeleted: true });
    await touchUserActivity(userId);
    return res.status(200).json({ message: 'Trash cleared successfully', deletedCount: result.deletedCount || 0 });
  } catch (error) {
    console.error('Error clearTrash:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getTrashTasks = async (req, res) => {
  try {
    const { status, period, start, endExclusive } = req.query;
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const filter = {
      userId,
      isDeleted: true,
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const dateFilter = getTrashDateFilter({ start, endExclusive, period });
    if (dateFilter) {
      filter.createdAt = dateFilter;
    }

    const tasks = await Task.find(filter).sort({ deletedAt: -1 });
    await touchUserActivity(userId);
    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Error getTrashTasks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

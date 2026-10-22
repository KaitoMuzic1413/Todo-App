import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Attachment from '../models/Attachment.js';
import { deleteAttachmentRecords } from './attachmentsControllers.js';
import { hasScheduleInput, validateTaskSchedule } from '../utils/taskSchedule.js';
import GamificationEvent from '../models/GamificationEvent.js';
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
    }).sort({ createdAt: -1 });
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ remaining: Infinity, allowed: Infinity, created: 0 });
  } catch (error) {
    console.error('Error getUserQuota', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, contentType = 'task', content = '', items = [], important = false, parentTaskId = null } = req.body;
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existingPendingTaskToday = parentTaskId || hasScheduleInput(req.body) ? null : await Task.findOne({
      userId,
      isDeleted: false,
      contentType,
      status: 'active',
      createdAt: { $gte: startOfToday },
      title: { $regex: new RegExp(`^${trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (existingPendingTaskToday) {
      existingPendingTaskToday.createdAt = new Date();
      await existingPendingTaskToday.save();
      await touchUserActivity(userId);

      return res.status(200).json(existingPendingTaskToday);
    }

    const task = new Task({
      userId,
      parentTaskId,
      title: trimmedTitle,
      contentType,
      content: contentType === 'note' ? String(content).trim() : '',
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

export const updateTask = async (req, res) => {
  try {
    const { title, status, completedAt, content, items } = req.body;
    const userId = getAuthenticatedUserId(req);
    const task = await Task.findOne({ _id: req.params.id, userId, isDeleted: false });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
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

    const nextData = {
      ...schedule.updates,
      ...(title ? { title: title.trim() } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(normalizedItems ? { items: normalizedItems } : {}),
      ...(normalizedItems && task.contentType === 'list'
        ? { completedAt: allItemsCompleted ? new Date() : null }
        : (completedAt !== undefined ? { completedAt } : {})),
      ...(content !== undefined ? { content: String(content).trim() } : {}),
    };

    if (Object.hasOwn(schedule.updates, 'dueAt')) {
      nextData.dueEmailReminderSentFor = null;
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

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, nextData, { returnDocument: 'after' });
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






import Task from '../models/Task.js';
import User from '../models/User.js';
import Attachment from '../models/Attachment.js';
import { deleteAttachmentRecords } from './attachmentsControllers.js';

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

const getTrashDateFilter = (period) => {
  if (!period || period === 'all') return null;

  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    return { $gte: start };
  }

  if (period === 'week') {
    start.setDate(now.getDate() - 7);
    return { $gte: start };
  }

  if (period === 'month') {
    start.setDate(now.getDate() - 30);
    return { $gte: start };
  }

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

    await Attachment.deleteMany({ isDeleted: true, deletedAt: { $lte: cutoff } });

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
    const { title, contentType = 'task', content = '', items = [] } = req.body;
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const trimmedTitle = title.trim();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existingPendingTaskToday = await Task.findOne({
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
      title: trimmedTitle,
      contentType,
      content: contentType === 'note' ? String(content).trim() : '',
      items: contentType === 'list'
        ? items.map((item) => ({ text: String(item.text || item).trim(), completed: !!item.completed }))
        : undefined,
      status: 'active',
      completedAt: null,
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

    const normalizedItems = items !== undefined && Array.isArray(items)
      ? items.map((item) => ({ text: String(item.text || item).trim(), completed: !!item.completed }))
      : null;
    const allItemsCompleted = normalizedItems?.length > 0 && normalizedItems.every((item) => item.completed);
    const nextStatus = normalizedItems && task.contentType === 'list'
      ? (allItemsCompleted ? 'complete' : 'active')
      : status;

    const nextData = {
      ...(title ? { title: title.trim() } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(normalizedItems ? { items: normalizedItems } : {}),
      ...(normalizedItems && task.contentType === 'list'
        ? { completedAt: allItemsCompleted ? new Date() : null }
        : (completedAt !== undefined ? { completedAt } : {})),
      ...(content !== undefined ? { content: String(content).trim() } : {}),
    };

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
    const { status, period } = req.query;
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

    const dateFilter = getTrashDateFilter(period);
    if (dateFilter) {
      filter.deletedAt = dateFilter;
    }

    const tasks = await Task.find(filter).sort({ deletedAt: -1 });
    await touchUserActivity(userId);
    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Error getTrashTasks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};






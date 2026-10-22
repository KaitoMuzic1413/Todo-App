import mongoose from 'mongoose';
import FocusSession from '../models/FocusSession.js';
import Task from '../models/Task.js';
import { getElapsedSeconds, getRemainingSeconds } from '../utils/focusTimer.js';

const getUserId = (req) => req.user?.userId;
const ACTIVE_STATUSES = ['running', 'paused'];
const SESSION_MODES = ['focus', 'shortBreak', 'longBreak'];

export const startFocusSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { taskId = null, mode = 'focus', durationSeconds } = req.body;
    const duration = Number(durationSeconds);

    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    if (!SESSION_MODES.includes(mode)) return res.status(400).json({ message: 'Invalid focus mode.' });
    if (!Number.isInteger(duration) || duration < 60 || duration > 14400) {
      return res.status(400).json({ message: 'Duration must be between 1 minute and 4 hours.' });
    }
    if (taskId && !mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }
    if (taskId && !(await Task.exists({
      _id: taskId,
      userId,
      isDeleted: false,
      status: 'active',
      $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
    }))) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const now = new Date();
    const session = await FocusSession.create({
      userId,
      activeUserId: userId,
      taskId,
      mode,
      status: 'running',
      durationSeconds: duration,
      remainingSeconds: duration,
      elapsedSeconds: 0,
      startedAt: now,
      segmentStartedAt: now,
      endsAt: new Date(now.getTime() + duration * 1000),
    });
    return res.status(201).json({ session });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A focus session is already active.' });
    }
    console.error('Start focus session error:', error);
    return res.status(500).json({ message: 'Unable to start a focus session.' });
  }
};

export const getActiveFocusSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    let session = await FocusSession.findOne({ activeUserId: userId, status: { $in: ACTIVE_STATUSES } });
    if (!session) return res.status(200).json({ session: null });

    let completedSession = null;
    if (session.status === 'running' && session.endsAt <= new Date()) {
      const now = new Date();
      const actualSeconds = getElapsedSeconds(session, now);
      completedSession = await FocusSession.findOneAndUpdate(
        { _id: session._id, userId, activeUserId: userId, status: 'running' },
        {
          $set: {
            status: 'completed',
            actualSeconds,
            elapsedSeconds: actualSeconds,
            remainingSeconds: 0,
            completedAt: now,
          },
          $unset: { activeUserId: 1, endsAt: 1, segmentStartedAt: 1 },
        },
        { new: true }
      );
      if (!completedSession) {
        completedSession = await FocusSession.findOne({ _id: session._id, userId, status: 'completed' });
      }
      session = null;
    }

    return res.status(200).json({ session, completedSession });
  } catch (error) {
    console.error('Get active focus session error:', error);
    return res.status(500).json({ message: 'Unable to load the active focus session.' });
  }
};

export const updateFocusSession = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { action } = req.params;
    if (!['pause', 'resume', 'complete', 'cancel'].includes(action)) {
      return res.status(400).json({ message: 'Invalid focus session action.' });
    }

    const session = await FocusSession.findOne({
      _id: req.params.id,
      userId,
      activeUserId: userId,
      status: { $in: ACTIVE_STATUSES },
    });
    if (!session) {
      if (action === 'complete') {
        const completedSession = await FocusSession.findOne({ _id: req.params.id, userId, status: 'completed' });
        if (completedSession) return res.status(200).json({ session: completedSession, alreadyCompleted: true });
      }
      return res.status(404).json({ message: 'Active focus session not found.' });
    }

    const now = new Date();
    if (action === 'pause') {
      if (session.status !== 'running') return res.status(409).json({ message: 'Session is not running.' });
      const elapsedSeconds = getElapsedSeconds(session, now);
      const remainingSeconds = getRemainingSeconds(session, now);
      if (remainingSeconds === 0) {
        return res.status(409).json({ message: 'The session has already ended. Refresh to complete it.' });
      }
      const updatedSession = await FocusSession.findOneAndUpdate(
        { _id: session._id, userId, activeUserId: userId, status: 'running' },
        {
          $set: { status: 'paused', elapsedSeconds, remainingSeconds, pausedAt: now, segmentStartedAt: null, endsAt: null },
        },
        { new: true }
      );
      return res.status(200).json({ session: updatedSession });
    }

    if (action === 'resume') {
      if (session.status !== 'paused') return res.status(409).json({ message: 'Session is not paused.' });
      const endsAt = new Date(now.getTime() + session.remainingSeconds * 1000);
      const updatedSession = await FocusSession.findOneAndUpdate(
        { _id: session._id, userId, activeUserId: userId, status: 'paused' },
        { $set: { status: 'running', segmentStartedAt: now, endsAt, pausedAt: null } },
        { new: true }
      );
      return res.status(200).json({ session: updatedSession });
    }

    const actualSeconds = action === 'complete' ? getElapsedSeconds(session, now) : getElapsedSeconds(session, now);
    const updatedSession = await FocusSession.findOneAndUpdate(
      { _id: session._id, userId, activeUserId: userId, status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: action === 'complete' ? 'completed' : 'cancelled',
          actualSeconds,
          elapsedSeconds: actualSeconds,
          remainingSeconds: getRemainingSeconds(session, now),
          completedAt: action === 'complete' ? now : null,
        },
        $unset: { activeUserId: 1, endsAt: 1, segmentStartedAt: 1 },
      },
      { new: true }
    );
    return res.status(200).json({ session: updatedSession });
  } catch (error) {
    console.error('Update focus session error:', error);
    return res.status(500).json({ message: 'Unable to update the focus session.' });
  }
};

export const getFocusSummary = async (req, res) => {
  try {
    const userId = getUserId(req);
    const [summary] = await FocusSession.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), mode: 'focus', status: 'completed' } },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          actualSeconds: { $sum: '$actualSeconds' },
        },
      },
    ]);
    return res.status(200).json({ sessions: summary?.sessions || 0, actualSeconds: summary?.actualSeconds || 0 });
  } catch (error) {
    console.error('Get focus summary error:', error);
    return res.status(500).json({ message: 'Unable to load focus statistics.' });
  }
};

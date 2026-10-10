import mongoose from 'mongoose';
import Task from '../models/Task.js';
import FocusSession from '../models/FocusSession.js';
import { resolveAnalyticsRange } from '../utils/analyticsRange.js';

export const getProductivityAnalytics = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });

    const range = resolveAnalyticsRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });

    const [result] = await Task.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
        },
      },
      {
        $facet: {
          current: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $ne: ['$status', 'complete'] }, 1, 0] } },
                overdue: {
                  $sum: {
                    $cond: [
                      { $and: [{ $ne: ['$status', 'complete'] }, { $ne: ['$dueAt', null] }, { $lt: ['$dueAt', new Date()] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          created: [
            { $match: { createdAt: { $gte: range.start, $lt: range.endExclusive } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: range.timeZone } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          completed: [
            { $match: { status: 'complete', completedAt: { $gte: range.start, $lt: range.endExclusive } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: range.timeZone } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          duration: [
            {
              $match: {
                status: 'complete',
                completedAt: { $gte: range.start, $lt: range.endExclusive },
                estimatedMinutes: { $gt: 0 },
              },
            },
            {
              $lookup: {
                from: FocusSession.collection.name,
                let: { taskId: '$_id', ownerId: '$userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$taskId', '$$taskId'] },
                          { $eq: ['$userId', '$$ownerId'] },
                          { $eq: ['$mode', 'focus'] },
                          { $eq: ['$status', 'completed'] },
                        ],
                      },
                    },
                  },
                  { $group: { _id: null, actualSeconds: { $sum: '$actualSeconds' } } },
                ],
                as: 'focusTotals',
              },
            },
            {
              $group: {
                _id: null,
                tasks: { $sum: 1 },
                estimatedMinutes: { $sum: '$estimatedMinutes' },
                actualSeconds: { $sum: { $ifNull: [{ $arrayElemAt: ['$focusTotals.actualSeconds', 0] }, 0] } },
              },
            },
          ],
        },
      },
    ]);

    const current = result?.current?.[0] || { total: 0, completed: 0, pending: 0, overdue: 0 };
    const duration = result?.duration?.[0] || { tasks: 0, estimatedMinutes: 0, actualSeconds: 0 };
    return res.status(200).json({
      range: { key: range.range, start: range.start, endExclusive: range.endExclusive, timeZone: range.timeZone },
      summary: {
        ...current,
        completionRate: current.total ? Math.round((current.completed / current.total) * 100) : 0,
      },
      trend: { created: result?.created || [], completed: result?.completed || [] },
      duration: {
        tasks: duration.tasks,
        estimatedMinutes: duration.estimatedMinutes,
        actualSeconds: duration.actualSeconds,
      },
    });
  } catch (error) {
    console.error('Productivity analytics error:', error);
    return res.status(500).json({ message: 'Unable to load productivity analytics.' });
  }
};

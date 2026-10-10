import mongoose from 'mongoose';
import GamificationEvent from '../models/GamificationEvent.js';
import {
  DAILY_TASK_GOAL,
  getAchievements,
  getActivityKeys,
  getBestStreak,
  getCurrentStreak,
  getLevelProgress,
  WEEKLY_TASK_GOAL,
} from '../utils/gamification.js';

export const getGamificationSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });

    const timeZone = String(req.query.timeZone || 'UTC');
    let currentKeys;
    try {
      currentKeys = getActivityKeys(new Date(), timeZone);
    } catch {
      return res.status(400).json({ message: 'timeZone must be a valid IANA time zone.' });
    }

    const ownerId = new mongoose.Types.ObjectId(userId);
    const [xpResult, completionCount, activityDates, dailyCompletions, weeklyCompletions] = await Promise.all([
      GamificationEvent.aggregate([
        { $match: { userId: ownerId } },
        { $group: { _id: null, xp: { $sum: '$xp' } } },
      ]),
      GamificationEvent.countDocuments({ userId, eventType: 'taskComplete' }),
      GamificationEvent.distinct('activityDate', { userId, eventType: 'taskComplete' }),
      GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', activityDate: currentKeys.activityDate }),
      GamificationEvent.countDocuments({ userId, eventType: 'taskComplete', weekStart: currentKeys.weekStart }),
    ]);

    const xp = xpResult[0]?.xp || 0;
    const level = getLevelProgress(xp);
    const currentStreak = getCurrentStreak(activityDates, currentKeys.activityDate);
    return res.status(200).json({
      xp,
      ...level,
      currentStreak,
      bestStreak: getBestStreak(activityDates),
      completionCount,
      dailyGoal: { target: DAILY_TASK_GOAL, progress: Math.min(dailyCompletions, DAILY_TASK_GOAL), completed: dailyCompletions >= DAILY_TASK_GOAL },
      weeklyGoal: { target: WEEKLY_TASK_GOAL, progress: Math.min(weeklyCompletions, WEEKLY_TASK_GOAL), completed: weeklyCompletions >= WEEKLY_TASK_GOAL },
      achievements: getAchievements(completionCount, currentStreak),
    });
  } catch (error) {
    console.error('Get gamification summary error:', error);
    return res.status(500).json({ message: 'Unable to load gamification progress.' });
  }
};
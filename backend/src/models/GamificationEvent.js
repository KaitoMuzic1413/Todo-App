import mongoose from 'mongoose';

const gamificationEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    eventType: {
      type: String,
      enum: ['taskComplete', 'dailyGoal', 'weeklyGoal'],
      required: true,
    },
    idempotencyKey: { type: String, required: true },
    xp: { type: Number, required: true, min: 0 },
    activityDate: { type: String, required: true },
    weekStart: { type: String, required: true },
  },
  { timestamps: true }
);

gamificationEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
gamificationEventSchema.index({ userId: 1, eventType: 1, activityDate: 1 });
gamificationEventSchema.index({ userId: 1, eventType: 1, weekStart: 1 });

const GamificationEvent = mongoose.model('GamificationEvent', gamificationEventSchema);
export default GamificationEvent;
import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    activeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    mode: {
      type: String,
      enum: ['focus', 'shortBreak', 'longBreak'],
      required: true,
    },
    status: {
      type: String,
      enum: ['running', 'paused', 'completed', 'cancelled'],
      required: true,
      default: 'running',
    },
    durationSeconds: { type: Number, required: true, min: 60, max: 14400 },
    remainingSeconds: { type: Number, required: true, min: 0, max: 14400 },
    elapsedSeconds: { type: Number, default: 0, min: 0 },
    actualSeconds: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, required: true },
    segmentStartedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

focusSessionSchema.index({ userId: 1, createdAt: -1 });
focusSessionSchema.index({ userId: 1, taskId: 1, mode: 1, status: 1 });
focusSessionSchema.index({ activeUserId: 1 }, { unique: true, sparse: true });

const FocusSession = mongoose.model('FocusSession', focusSessionSchema);
export default FocusSession;
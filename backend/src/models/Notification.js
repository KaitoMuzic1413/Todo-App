import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, maxlength: 5000 },
  type: { type: String, required: true, enum: ['welcome', 'system', 'reminder', 'update', 'task'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, required: true, enum: ['all', 'user'] },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    required: function requireTargetForSingleUser() { return this.targetType === 'user'; },
  },
  requestId: { type: String, maxlength: 128 },
  requestFingerprint: { type: String, maxlength: 64 },
  seedKey: { type: String, maxlength: 100 },
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ requestId: 1 }, { unique: true, sparse: true });
notificationSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('Notification', notificationSchema);

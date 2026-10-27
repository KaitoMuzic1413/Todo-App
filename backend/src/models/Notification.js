import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, maxlength: 5000 },
  type: { type: String, required: true, enum: ['welcome', 'system', 'update', 'task'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, required: true, enum: ['all', 'user', 'new-users'] },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    required: function requireTargetForSingleUser() { return this.targetType === 'user'; },
  },
  requestId: { type: String, maxlength: 128 },
  requestFingerprint: { type: String, maxlength: 64 },
  seedKey: { type: String, maxlength: 100 },
  status: { type: String, enum: ['draft', 'scheduled', 'processing', 'sent', 'archived'], default: 'sent', index: true },
  scheduledAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  campaignKey: { type: String, maxlength: 100, default: null },
  sourceNotificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ requestId: 1 }, { unique: true, sparse: true });
notificationSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('Notification', notificationSchema);

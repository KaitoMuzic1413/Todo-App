import mongoose from 'mongoose';

const notificationRecipientSchema = new mongoose.Schema({
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: Date.now },
}, { timestamps: true });

notificationRecipientSchema.index({ userId: 1, deliveredAt: -1 });
notificationRecipientSchema.index({ userId: 1, isRead: 1, deliveredAt: -1 });
notificationRecipientSchema.index({ notificationId: 1, userId: 1 }, { unique: true });

export default mongoose.model('NotificationRecipient', notificationRecipientSchema);

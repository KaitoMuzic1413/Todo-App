import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true, trim: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: { type: String, default: '', maxlength: 512 },
  lastSuccessAt: { type: Date, default: null },
  failureCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

pushSubscriptionSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);

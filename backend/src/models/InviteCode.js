import mongoose from 'mongoose';

const inviteCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planDays: {
      type: Number,
      min: 1,
      max: 3650,
      default: 30,
    },
    maxUses: {
      type: Number,
      min: 1,
      max: 100000,
      default: 1,
    },
    usedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    usedBy: {
      type: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        redeemedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

inviteCodeSchema.index({ createdBy: 1, createdAt: -1 });

const InviteCode = mongoose.model('InviteCode', inviteCodeSchema);
export default InviteCode;

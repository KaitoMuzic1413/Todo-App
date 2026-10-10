import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    inactiveDeletionNoticeSentAt: {
      type: Date,
      default: null,
    },
    sessionVersion: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    premium: {
      extraQuota: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
      unlimitedUntil: { type: Date, default: null },
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      accent: { type: String, enum: ['violet', 'rose', 'emerald', 'amber'], default: 'violet' },
      language: { type: String, enum: ['en', 'vi'], default: 'en' },
      taskView: { type: String, enum: ['list', 'grid', 'kanban'], default: 'list' },
      sortBy: { type: String, enum: ['createdAt', 'title', 'important'], default: 'createdAt' },
      sortDirection: { type: String, enum: ['asc', 'desc'], default: 'desc' },
    },
    resetPasswordOtpHash: {
      type: String,
      default: null,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
    },
    resetPasswordOtpAttempts: {
      type: Number,
      default: 0,
    },
    resetPasswordOtpRequestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;

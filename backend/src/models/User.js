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
    name: {
      type: String,
      trim: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
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
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;

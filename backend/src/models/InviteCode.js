import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    redeemedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const InviteCode = mongoose.model("InviteCode", inviteSchema);
export default InviteCode;

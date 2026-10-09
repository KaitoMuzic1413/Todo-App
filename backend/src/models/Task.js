import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    contentType: {
      type: String,
      enum: ["task", "note", "list"],
      default: "task",
      index: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
    },
    items: {
      type: [
        {
          text: { type: String, required: true, trim: true },
          completed: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    },
    status: {
      type: String,
      enum: ["active", "complete"],
      default: "active",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    important: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
taskSchema.index({ userId: 1, contentType: 1, isDeleted: 1, createdAt: -1 });
taskSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });

const Task = mongoose.model("Task", taskSchema);
export default Task;
import mongoose from "mongoose";

export const TASK_TITLE_MAX_LENGTH = 200;

const calendarOccurrenceSchema = new mongoose.Schema(
  {
    startAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    estimatedMinutes: { type: Number, min: 1, max: 1440, default: null },
    timeZone: { type: String, trim: true, maxlength: 64, default: null },
    mergedOccurrences: {
      type: [
        {
          occurrenceId: { type: String, required: true },
          startAt: { type: Date, default: null },
          dueAt: { type: Date, default: null },
          estimatedMinutes: { type: Number, min: 1, max: 1440, default: null },
          timeZone: { type: String, trim: true, maxlength: 64, default: null },
        },
      ],
      default: undefined,
    },
  },
  { timestamps: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdFromCalendar: {
      type: Boolean,
      default: false,
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
    startAt: {
      type: Date,
      default: null,
    },
    dueAt: {
      type: Date,
      default: null,
    },
    calendarOccurrences: {
      type: [calendarOccurrenceSchema],
      default: [],
    },
    dueEmailReminderSentFor: {
      type: Date,
      default: null,
    },
    dueEmailReminderRetryAfter: {
      type: Date,
      default: null,
    },
    dueNotificationSentFor: {
      type: Date,
      default: null,
    },
    estimatedMinutes: {
      type: Number,
      min: 1,
      max: 1440,
      default: null,
    },
    mergedOccurrences: {
      type: [
        {
          occurrenceId: { type: String, required: true },
          startAt: { type: Date, default: null },
          dueAt: { type: Date, default: null },
          estimatedMinutes: { type: Number, min: 1, max: 1440, default: null },
          timeZone: { type: String, trim: true, maxlength: 64, default: null },
        },
      ],
      default: undefined,
    },
    // Snapshot of the tasks absorbed by a calendar "merge & center" action,
    // kept so the merged block can be previewed and unmerged later.
    mergedTasks: {
      type: [
        {
          taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true,
          },
          title: { type: String, default: "", trim: true },
          startAt: { type: Date, default: null },
          dueAt: { type: Date, default: null },
          estimatedMinutes: { type: Number, min: 1, max: 1440, default: null },
        },
      ],
      default: [],
    },
    timeZone: {
      type: String,
      trim: true,
      maxlength: 64,
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
taskSchema.index({ userId: 1, isDeleted: 1, startAt: 1 });
taskSchema.index({ userId: 1, isDeleted: 1, dueAt: 1 });
taskSchema.index({ userId: 1, isDeleted: 1, completedAt: 1 });
taskSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });

const Task = mongoose.model("Task", taskSchema);
export default Task;

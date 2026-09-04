import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

attachmentSchema.index({ ownerId: 1, createdAt: -1 });
attachmentSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });

const Attachment = mongoose.model('Attachment', attachmentSchema);
export default Attachment;

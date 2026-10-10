import mongoose from 'mongoose';

const calendarNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dateKey: { type: String, required: true },
  content: { type: String, maxlength: 4000, default: '' },
}, { timestamps: true });

calendarNoteSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export default mongoose.model('CalendarNote', calendarNoteSchema);

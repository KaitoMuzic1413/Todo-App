import mongoose from 'mongoose';

const mergeRangeSchema = new mongoose.Schema({
  startHour: { type: Number, required: true, min: 0, max: 23 },
  endHour: { type: Number, required: true, min: 0, max: 23 },
}, { _id: false });

const calendarNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dateKey: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  content: { type: String, maxlength: 4000, default: '' },
  merges: { type: [mergeRangeSchema], default: [] },
}, { timestamps: true });

calendarNoteSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export default mongoose.model('CalendarNote', calendarNoteSchema);

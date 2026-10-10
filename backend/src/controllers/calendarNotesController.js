import CalendarNote from '../models/CalendarNote.js';

const isValidDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const getCalendarNotes = async (req, res) => {
  const dates = String(req.query.dates || '').split(',').filter(Boolean);
  if (!dates.length || dates.length > 62 || dates.some((date) => !isValidDateKey(date))) {
    return res.status(400).json({ message: 'A valid list of calendar dates is required.' });
  }

  try {
    const notes = await CalendarNote.find({ userId: req.user.userId, dateKey: { $in: dates } })
      .select('dateKey content updatedAt')
      .lean();
    return res.status(200).json(Object.fromEntries(notes.map(({ dateKey, content, updatedAt }) => [dateKey, { content, updatedAt }])));
  } catch (error) {
    console.error('Error loading calendar notes:', error);
    return res.status(500).json({ message: 'Unable to load calendar notes.' });
  }
};

export const saveCalendarNote = async (req, res) => {
  const { dateKey } = req.params;
  const { content } = req.body;
  if (!isValidDateKey(dateKey) || typeof content !== 'string' || content.length > 4000) {
    return res.status(400).json({ message: 'A valid date and note up to 4000 characters are required.' });
  }

  try {
    if (!content.trim()) {
      await CalendarNote.deleteOne({ userId: req.user.userId, dateKey });
      return res.status(200).json({ dateKey, content: '' });
    }

    const note = await CalendarNote.findOneAndUpdate(
      { userId: req.user.userId, dateKey },
      { $set: { content } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    ).select('dateKey content updatedAt');
    return res.status(200).json(note);
  } catch (error) {
    console.error('Error saving calendar note:', error);
    return res.status(500).json({ message: 'Unable to save calendar note.' });
  }
};

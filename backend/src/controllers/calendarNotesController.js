import CalendarNote from '../models/CalendarNote.js';
import { getDateKeyAliases, normalizeDateKey } from '../utils/calendarDateKey.js';

export const getCalendarNotes = async (req, res) => {
  const requestedDates = String(req.query.dates || '').split(',').filter(Boolean);
  const canonicalDates = requestedDates.map(normalizeDateKey);
  if (!requestedDates.length || requestedDates.length > 62 || canonicalDates.some((date) => !date)) {
    return res.status(400).json({ message: 'A valid list of calendar dates is required.' });
  }

  try {
    const lookupDates = [...new Set(canonicalDates.flatMap(getDateKeyAliases))];
    const notes = await CalendarNote.find({ userId: req.user.userId, dateKey: { $in: lookupDates } })
      .select('dateKey content updatedAt')
      .lean();

    // Older clients may have saved non-padded keys. Read all variants and expose
    // one canonical date, preferring the most recently updated record.
    const latestByDate = new Map();
    for (const note of notes) {
      const dateKey = normalizeDateKey(note.dateKey);
      if (!dateKey) continue;
      const existing = latestByDate.get(dateKey);
      if (!existing || new Date(note.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        latestByDate.set(dateKey, { content: note.content, updatedAt: note.updatedAt });
      }
    }

    return res.status(200).json(Object.fromEntries(latestByDate));
  } catch (error) {
    console.error('Error loading calendar notes:', error);
    return res.status(500).json({ message: 'Unable to load calendar notes.' });
  }
};

export const saveCalendarNote = async (req, res) => {
  const canonicalDateKey = normalizeDateKey(req.params.dateKey);
  const content = req.body?.content;
  if (!canonicalDateKey || typeof content !== 'string' || content.length > 4000) {
    return res.status(400).json({ message: 'A valid date and note up to 4000 characters are required.' });
  }

  try {
    const dateKeyAliases = getDateKeyAliases(canonicalDateKey);
    if (!content.trim()) {
      await CalendarNote.deleteMany({ userId: req.user.userId, dateKey: { $in: dateKeyAliases } });
      return res.status(200).json({ dateKey: canonicalDateKey, content: '' });
    }

    const note = await CalendarNote.findOneAndUpdate(
      { userId: req.user.userId, dateKey: canonicalDateKey },
      { $set: { content } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    ).select('dateKey content updatedAt');
    return res.status(200).json(note);
  } catch (error) {
    console.error('Error saving calendar note:', error);
    return res.status(500).json({ message: 'Unable to save calendar note.' });
  }
};

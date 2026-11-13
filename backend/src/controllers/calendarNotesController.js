import CalendarNote from '../models/CalendarNote.js';
import { normalizeCalendarDateKey } from '../utils/calendarDateKey.js';

const sanitizeMerges = (input) => {
  if (!Array.isArray(input)) return [];
  const ranges = input
    .map((range) => {
      const startHour = Math.round(Number(range?.startHour));
      const endHour = Math.round(Number(range?.endHour));
      if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return null;
      const clamp = (value) => Math.max(0, Math.min(23, value));
      return { startHour: clamp(startHour), endHour: clamp(endHour) };
    })
    .filter(Boolean)
    .map(({ startHour, endHour }) => (
      startHour <= endHour ? { startHour, endHour } : { startHour: endHour, endHour: startHour }
    ))
    .sort((left, right) => left.startHour - right.startHour || left.endHour - right.endHour);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    // Only coalesce ranges that actually overlap; touching (adjacent) merged
    // regions must stay separate, e.g. {1,2} and {3,4} remain two regions.
    if (last && range.startHour <= last.endHour) {
      last.endHour = Math.max(last.endHour, range.endHour);
    } else {
      merged.push({ ...range });
    }
  }
  return merged.slice(0, 24);
};

export const getCalendarNotes = async (req, res) => {
  const requestedDates = String(req.query.dates || '').split(',').filter(Boolean);
  const dates = requestedDates.map(normalizeCalendarDateKey);
  if (!dates.length || dates.length > 62 || dates.some((date) => !date)) {
    return res.status(400).json({ message: 'A valid list of calendar dates is required.' });
  }

  try {
    const notes = await CalendarNote.find({
      userId: req.user.userId,
      dateKey: { $in: [...new Set(dates)] },
    })
      .select('dateKey content merges updatedAt')
      .lean();
    return res.status(200).json(Object.fromEntries(
      notes.map(({ dateKey, content, merges, updatedAt }) => [
        dateKey,
        { content, merges: merges || [], updatedAt },
      ])
    ));
  } catch (error) {
    console.error('Error loading calendar notes:', error);
    return res.status(500).json({ message: 'Unable to load calendar notes.' });
  }
};

export const saveCalendarNote = async (req, res) => {
  const dateKey = normalizeCalendarDateKey(req.params.dateKey);
  const { content, merges } = req.body;
  const hasContent = typeof content === 'string';
  const hasMerges = Array.isArray(merges);

  if (!dateKey) {
    return res.status(400).json({ message: 'A valid date and note up to 4000 characters are required.' });
  }
  if (!hasContent && !hasMerges) {
    return res.status(400).json({ message: 'A note, or merged cell ranges, are required.' });
  }
  if (hasContent && content.length > 4000) {
    return res.status(400).json({ message: 'A valid date and note up to 4000 characters are required.' });
  }

  try {
    const existing = await CalendarNote.findOne({ userId: req.user.userId, dateKey });
    const nextContent = hasContent ? content : (existing?.content ?? '');
    const nextMerges = hasMerges ? sanitizeMerges(merges) : (existing?.merges ?? []);

    if (!nextContent.trim() && !nextMerges.length) {
      if (existing) await CalendarNote.deleteOne({ userId: req.user.userId, dateKey });
      return res.status(200).json({ dateKey, content: '', merges: [] });
    }

    const update = {};
    if (hasContent) update.content = content;
    if (hasMerges) update.merges = nextMerges;

    const note = await CalendarNote.findOneAndUpdate(
      { userId: req.user.userId, dateKey },
      { $set: update },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    ).select('dateKey content merges updatedAt');
    return res.status(200).json(note);
  } catch (error) {
    console.error('Error saving calendar note:', error);
    return res.status(500).json({ message: 'Unable to save calendar note.' });
  }
};

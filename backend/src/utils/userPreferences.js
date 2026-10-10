export const PREFERENCE_OPTIONS = {
  theme: ['light', 'dark'],
  accent: ['violet', 'rose', 'emerald', 'amber'],
  language: ['en', 'vi'],
  taskView: ['list', 'grid', 'kanban'],
  sortBy: ['createdAt', 'title', 'important'],
  sortDirection: ['asc', 'desc'],
};

export const validatePreferenceUpdates = (preferences) => {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return { error: 'Preferences must be an object.' };
  }

  const entries = Object.entries(preferences);
  if (!entries.length) return { error: 'At least one preference is required.' };

  const updates = {};
  for (const [key, value] of entries) {
    if (!Object.hasOwn(PREFERENCE_OPTIONS, key) || !PREFERENCE_OPTIONS[key].includes(value)) {
      return { error: `Invalid preference value for ${key}.` };
    }
    updates[`preferences.${key}`] = value;
  }

  return { updates };
};

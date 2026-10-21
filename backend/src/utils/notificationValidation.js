export const NOTIFICATION_TYPES = ['welcome', 'system', 'reminder', 'update', 'task'];

export const validateNotificationInput = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Notification data must be an object.' };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!title || title.length > 120) return { error: 'Title must contain 1 to 120 characters.' };
  if (!content || content.length > 5000) return { error: 'Content must contain 1 to 5000 characters.' };
  if (!NOTIFICATION_TYPES.includes(input.type)) return { error: 'Choose a supported notification type.' };

  if (!input.audience || typeof input.audience !== 'object' || Array.isArray(input.audience)) {
    return { error: 'Choose who should receive this notification.' };
  }

  if (input.audience.type === 'all') {
    return { value: { title, content, type: input.type, targetType: 'all', targetEmail: null } };
  }

  if (input.audience.type === 'user') {
    const email = typeof input.audience.email === 'string' ? input.audience.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Enter a valid recipient email address.' };
    }
    return { value: { title, content, type: input.type, targetType: 'user', targetEmail: email } };
  }

  return { error: 'Choose a supported recipient audience.' };
};

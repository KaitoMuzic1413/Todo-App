import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const refreshedToken = response.headers?.['x-auth-token'];
    if (refreshedToken) localStorage.setItem('token', refreshedToken);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // A 401 from a protected API means the current session cannot be used.
      // Clear every token key used by the app so stale credentials are not retried.
      [
        'todo-user',
        'todo-user-email',
        'token',
        'accessToken',
        'user',
      ].forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('todo-auth-changed'));
        window.dispatchEvent(new Event('todo-auth-expired'));

        if (!window.location.pathname.includes('/signin')) {
          window.location.href = '/signin';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const loginWithEmail = (email, password) => api.post('/auth/login', { email, password });

export const registerWithEmail = (email, password, name) => api.post('/auth/register', { email, password, ...(name ? { name } : {}) });

export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });

export const verifyResetOtp = (email, otp) => api.post('/auth/verify-reset-otp', { email, otp });

export const resetPassword = (email, otp, newPassword, name) => api.post('/auth/reset-password', { email, otp, newPassword, ...(name ? { name } : {}) });

export const fetchUserPreferences = () => api.get('/users/preferences');

export const saveUserPreferences = (preferences) => api.patch('/users/preferences', preferences);
export const updateUserProfile = (name) => api.patch('/users/profile', { name });
export const updateUserAvatar = (avatarUrl) => api.patch('/users/profile/avatar', { avatarUrl });
export const fetchCurrentUser = () => api.get('/users/current');

export const fetchNotifications = (filter = 'all') => api.get('/notifications', { params: { filter } });
export const translateNotificationTexts = (texts, targetLanguage) => api.post('/notifications/translate', { texts, targetLanguage });
export const fetchUnreadNotificationCount = () => api.get('/notifications/unread-count');
export const fetchNotification = (notificationId) => api.get(`/notifications/${notificationId}`);
export const markNotificationRead = (notificationId) => api.patch(`/notifications/${notificationId}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
export const fetchAdminNotifications = () => api.get('/notifications/admin');
export const deleteAdminNotification = (notificationId) => api.delete(`/notifications/admin/${notificationId}`);
export const sendAdminNotification = (payload, requestId) => api.post('/notifications/admin', payload, {
  headers: { 'Idempotency-Key': requestId },
});

export const fetchActiveFocusSession = () => api.get('/focus/active');
export const fetchFocusSummary = () => api.get('/focus/summary');
export const startFocusSession = (payload) => api.post('/focus', payload);
export const updateFocusSession = (sessionId, action) => api.patch(`/focus/${sessionId}/${action}`);

export const fetchProductivityAnalytics = (range, timeZone) =>
  api.get('/analytics', { params: { range, timeZone } });

export const fetchGamificationSummary = (timeZone) =>
  api.get('/gamification', { params: { timeZone } });

export const fetchTasks = (userId, contentType) => api.get('/tasks', { params: { userId, ...(contentType ? { contentType } : {}) } });

export const fetchCalendarTasks = ({ start, endExclusive }) =>
  api.get('/tasks/calendar', { params: { start, endExclusive } });

export const fetchCalendarNotes = (dates) =>
  api.get('/calendar-notes', { params: { dates: dates.join(',') } });

export const saveCalendarNote = (dateKey, content) =>
  api.put(`/calendar-notes/${encodeURIComponent(dateKey)}`, { content });

export const createTask = ({ userId, title, contentType, content, items, important, parentTaskId, startAt, dueAt, estimatedMinutes, timeZone }) => api.post('/tasks', {
  userId,
  title,
  contentType,
  content,
  items,
  important,
  parentTaskId,
  startAt,
  dueAt,
  estimatedMinutes,
  timeZone,
});

export const updateTask = (taskId, userId, payload) => api.put(`/tasks/${taskId}`, { userId, ...payload });

export const toggleTaskStatus = (taskId, userId) => api.patch(`/tasks/${taskId}/toggle`, {
  userId,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
});

export const deleteTask = (taskId, userId) => api.delete(`/tasks/${taskId}`, { data: { userId } });

export const fetchTrashTasks = (userId, filters = {}) =>
  api.get('/tasks/trash/all', {
    params: {
      userId,
      status: filters.status || 'all',
      period: filters.period || 'all',
      ...(filters.start ? { start: filters.start } : {}),
      ...(filters.endExclusive ? { endExclusive: filters.endExclusive } : {}),
    },
  });

export const restoreTask = (taskId, userId) => api.patch(`/tasks/${taskId}/restore`, { userId });

export const deleteTaskPermanently = (taskId, userId) => api.delete(`/tasks/${taskId}/permanent`, { data: { userId } });

export const clearTrash = (userId) => api.delete('/tasks/trash/clear', { data: { userId } });

export const getUserQuota = (userId) => api.get(`/tasks/quota/${userId}`);

export const uploadAttachment = (file, { taskId = null, title, description = '', onUploadProgress } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('description', description);
  if (taskId) formData.append('taskId', taskId);
  return api.post('/attachments/upload', formData, {
    timeout: 120000,
    onUploadProgress: (event) => {
      if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
};
export const fetchAttachments = () => api.get('/attachments');
export const updateAttachment = (attachmentId, payload) => api.patch(`/attachments/${attachmentId}`, payload);
export const deleteAttachment = (attachmentId) => api.delete(`/attachments/${attachmentId}`);
export const fetchTrashAttachments = () => api.get('/attachments/trash/all');
export const restoreAttachment = (attachmentId) => api.patch(`/attachments/${attachmentId}/restore`);
export const deleteAttachmentPermanently = (attachmentId) => api.delete(`/attachments/${attachmentId}/permanent`);
export const clearTrashAttachments = () => api.delete('/attachments/trash/clear');
export const downloadAttachment = (attachmentId, preview = false) => api.get(`/attachments/${attachmentId}/download`, {
  params: preview ? { preview: 'true' } : undefined,
  responseType: 'blob',
});

export default api;

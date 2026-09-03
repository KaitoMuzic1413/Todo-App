import axios from 'axios';

// Lấy URL chuẩn không chứa dấu ngoặc vuông hay ký tự thừa
const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://todo-app-1112.onrender.com/api';

const api = axios.create({
  baseURL: apiBaseUrl,
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('todo-user');
      localStorage.removeItem('todo-user-email');
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('todo-auth-changed'));
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const loginWithEmail = (email, password) => api.post('/auth/login', { email, password });

export const registerWithEmail = (email, password) => api.post('/auth/register', { email, password });

export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });

export const resetPassword = (token, newPassword) => api.post('/auth/reset-password', { token, newPassword });

// Task APIs
export const fetchTasks = (userId, contentType) => api.get('/tasks', { params: { userId, ...(contentType ? { contentType } : {}) } });

export const createTask = ({ userId, title, contentType, content, items }) => api.post('/tasks', { userId, title, contentType, content, items });

export const updateTask = (taskId, userId, payload) => api.put(`/tasks/${taskId}`, { userId, ...payload });

export const toggleTaskStatus = (taskId, userId) => api.patch(`/tasks/${taskId}/toggle`, { userId });

export const deleteTask = (taskId, userId) => api.delete(`/tasks/${taskId}`, { data: { userId } });

export const fetchTrashTasks = (userId, filters = {}) =>
  api.get('/tasks/trash/all', {
    params: {
      userId,
      status: filters.status || 'all',
      period: filters.period || 'all',
    },
  });

export const restoreTask = (taskId, userId) => api.patch(`/tasks/${taskId}/restore`, { userId });

export const deleteTaskPermanently = (taskId, userId) => api.delete(`/tasks/${taskId}/permanent`, { data: { userId } });

export const clearTrash = (userId) => api.delete('/tasks/trash/clear', { data: { userId } });

export const getUserQuota = (userId) => api.get(`/tasks/quota/${userId}`);

export const uploadAttachment = (file, taskId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (taskId) formData.append('taskId', taskId);
  return api.post('/attachments/upload', formData);
};
export const fetchAttachments = () => api.get('/attachments');
export const deleteAttachment = (attachmentId) => api.delete(`/attachments/${attachmentId}`);
export const downloadAttachment = (attachmentId) => api.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' });

export default api;
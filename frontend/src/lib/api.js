import axios from 'axios';

// Lấy URL chuẩn không chứa dấu ngoặc vuông hay ký tự thừa
const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://todo-app-1112.onrender.com/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true,
});

// Auth APIs
export const loginWithEmail = (email, password) => api.post('/auth/login', { email, password });

export const registerWithEmail = (email, password) => api.post('/auth/register', { email, password });

// Task APIs
export const fetchTasks = (userId) => api.get('/tasks', { params: { userId } });

export const createTask = ({ userId, title }) => api.post('/tasks', { userId, title });

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

export default api;
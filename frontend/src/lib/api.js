import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 10000,
});

export const loginWithEmail = (email) => api.post('/users/login', { email });

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

// quota and premium
export const getUserQuota = (userId) => api.get(`/tasks/quota/${userId}`);
export const createInvite = (userId, code, expiresInDays) => api.post('/premium/invite/create', { userId, code, expiresInDays });
export const redeemInvite = (userId, code) => api.post('/premium/invite/redeem', { userId, code });
export const listInvites = (userId) => api.get('/premium/invite/list', { params: { userId } });

// frontend/src/api/taskApi.js
import axiosClient from './axiosClient'; // Trỏ đúng đường dẫn đến file axiosClient.js

export const fetchTasks = async () => {
  const response = await axiosClient.get('/tasks');
  return response.data;
};

export const fetchUserQuota = async () => {
  const response = await axiosClient.get('/tasks/quota'); // Không còn truyền /quota/:userId nữa
  return response.data;
};
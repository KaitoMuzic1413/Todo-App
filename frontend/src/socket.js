// src/socket.js
import { io } from "socket.io-client";

// Lấy URL Backend từ biến môi trường (hoặc fallback về Render URL)
const URL = import.meta.env.VITE_API_URL || "https://todo-app-1112.onrender.com";

export const socket = io(URL, {
  autoConnect: true,
});
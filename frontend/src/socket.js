import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL || "https://todo-app-1112.onrender.com";

export const socket = io(URL, {
  autoConnect: true,
});
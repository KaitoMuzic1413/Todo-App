import { io } from "socket.io-client";
import { API_ORIGIN } from './lib/apiConfig';

export const socket = io(API_ORIGIN, {
  autoConnect: true,
});

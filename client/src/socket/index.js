import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Connect manually when joining a room
  transports: ['websocket'], // Use WebSocket transport only for better performance
});

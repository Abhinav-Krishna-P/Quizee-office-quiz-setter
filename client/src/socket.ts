import { io } from 'socket.io-client';

// Automatically detect host. If local client at 5173, point to backend at 5000.
// Otherwise, assume relative path or specific production backend.
const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false
});

// socket.ts
import { io } from 'socket.io-client';

const socket = io('https://vicinity-backend.onrender.com', {
  autoConnect: false,
  transports: ['websocket'],
});

export default socket;

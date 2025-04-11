// socket.ts
import { io } from 'socket.io-client';

const socket = io('https://your-server-url.com', {
  autoConnect: false,
  transports: ['websocket'],
});

export default socket;

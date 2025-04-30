import { io } from 'socket.io-client';

const socket = io('https://vicinity-backend.onrender.com', {
  autoConnect: false,
  transports: ['websocket'],
  forceNew: false,
});

// const socket = io('http://192.168.152.119:3000', {
//   autoConnect: false,
//   transports: ['websocket'],
// });


// Listen for successful connection

export default socket;

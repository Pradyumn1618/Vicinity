import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import socket from '../config/socket';
import { format, isToday, isYesterday } from 'date-fns';

const db = getFirestore();

export const startReceiverStatusTracking = async (
  receiverId: string,
  setReceiverDetails: (data: any) => void,
  intervalRef: React.MutableRefObject<NodeJS.Timeout | null>
) => {
  const userRef = doc(db, 'users', receiverId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists) return;

  setReceiverDetails((prev: any) => ({
    ...prev,
    ...userDoc.data(),
  }));

  if (!socket.connected) {
    socket.connect();
  }

  // Emit every 5s
  intervalRef.current = setInterval(() => {
    socket.emit('get_status', { userId: receiverId });
  }, 5000);

  const handleStatusResponse = (data: { status: string; lastSeen: string }) => {
    const formattedLastSeen = data.lastSeen
      ? isToday(new Date(data.lastSeen))
        ? `Today at ${format(new Date(data.lastSeen), 'hh:mm a')}`
        : isYesterday(new Date(data.lastSeen))
        ? `Yesterday at ${format(new Date(data.lastSeen), 'hh:mm a')}`
        : format(new Date(data.lastSeen), 'dd MMM yyyy, hh:mm a')
      : null;

    setReceiverDetails((prevDetails: any) => ({
      ...prevDetails,
      ...(data.status === 'online'
        ? { status: data.status, lastSeen: null }
        : { lastSeen: formattedLastSeen, status: null }),
    }));
  };

  socket.on('status_response', handleStatusResponse);

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    socket.off('status_response', handleStatusResponse);
  };
};

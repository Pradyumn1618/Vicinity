import { useEffect, useRef } from 'react';
import { doc, getDoc,getFirestore } from '@react-native-firebase/firestore';
import socket from '../config/socket';
import { format, isToday, isYesterday } from 'date-fns';


const db = getFirestore();

const useReceiverStatus = (receiverId: string | null, setReceiverDetails: (data: any) => void) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!receiverId) return;

    let isMounted = true;

    const fetchInitialDetails = async () => {
      const userRef = doc(db, 'users', receiverId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists && isMounted) {
        setReceiverDetails((prev: any) => ({
          ...prev,
          ...userDoc.data(),
        }));

        if (!socket.connected) {
          socket.connect();
        }

        // Emit every 5s ONLY while on this screen
        intervalRef.current = setInterval(() => {
          socket.emit('get_status', { userId: receiverId });
        }, 5000);

        socket.on('status_response', handleStatusResponse);
      }
    };

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
            ? { status: data.status }
            : { lastSeen: formattedLastSeen, status: null }),
        }));
      };
    fetchInitialDetails();

    return () => {
      isMounted = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      socket.off('status_response', handleStatusResponse);
    };
  }, [receiverId, setReceiverDetails]);
};

export default useReceiverStatus;

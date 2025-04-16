import { useEffect, useState, useRef } from 'react';
import socket from '../config/socket';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Geohash from 'ngeohash'; // if you need neighbors


const useNearbyOnlineUsers = () => {

  interface OnlineUser {
    userId: string;
    geohash: string;
    username: string;
    profilePic: string;
    // lastSeen: string;
    // isOnline: boolean;
}
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const geohashesRef = useRef<string[]>([]);


  const fetchAndEmit = async () => {
    const user = auth().currentUser;
    if (!user) return;

    const userDoc = await firestore().collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    if (!userData?.geohash) return;

    const currentGeohash = userData.geohash;
    const neighbors = Geohash.neighbors(currentGeohash);
    const hashes = [currentGeohash, ...Object.values(neighbors)];
    geohashesRef.current = hashes;

    socket.emit('get_online_users_nearby', { geohashes: hashes });
  };

  useEffect(() => {
    let isMounted = true;

    fetchAndEmit();

    socket.on('online_users_nearby', ({ users }) => {
      if (isMounted) {
        const userId = auth().currentUser?.uid;
        const filtered = users.filter((u: OnlineUser) => u.userId !== userId);
        setOnlineUsers(filtered);
      }
    });

    socket.on('connect', () => {
      if (geohashesRef.current.length > 0) {
        socket.emit('get_online_users_nearby', { geohashes: geohashesRef.current });
      } else {
        fetchAndEmit();
      }
    });

    return () => {
      isMounted = false;
      socket.off('online_users_nearby');
      socket.off('connect');
    };
  }, []);

  return onlineUsers;

};

export default useNearbyOnlineUsers;

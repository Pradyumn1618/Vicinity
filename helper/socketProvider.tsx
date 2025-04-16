// SocketProvider.tsx
import React, { useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { AppState } from 'react-native';
import socket from '../config/socket';

const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    let currentUserId: string | null = null;
    let userGeohash: string | null = null;

    const connectWithGeo = async (userId: string) => {
      try {
        const doc = await firestore().collection('users').doc(userId).get();
        const data = doc.data();
        if (!data?.geohash) {
          console.error('❌ No geohash found for user');
          return;
        }

        userGeohash = data.geohash;
        currentUserId = userId;

        socket.connect();
        socket.emit('user_online', {
          userId,
          geohash: userGeohash,
          username: data.username,
          profilePic: data.profilePic,
        });
      } catch (err) {
        console.error('🔥 Error connecting with geohash:', err);
      }
    };

    const handleAuthChange = (user: any) => {
      if (user) {
        connectWithGeo(user.uid);
      } else {
        currentUserId = null;
        userGeohash = null;
        socket.disconnect();
      }
    };

    const handleAppStateChange = (state: string) => {
      const user = auth().currentUser;
      if (!user || !userGeohash) return;

      if (state === 'active') {
        connectWithGeo(user.uid);
      } else {
        socket.emit('user_offline', { userId: user.uid, geohash: userGeohash });
        socket.disconnect();
      }
    };

    const unsubscribeAuth = auth().onAuthStateChanged(handleAuthChange);
    const unsubscribeAppState = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribeAuth();
      unsubscribeAppState.remove();
      socket.disconnect();
    };
  }, []);

  return <>{children}</>;
};

export default SocketProvider;

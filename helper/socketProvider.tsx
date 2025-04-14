// SocketProvider.tsx
import React, { useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import socket from '../config/socket';
import mmkv from '../storage';

const geohash = mmkv.getString('geohash') || '';
const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user) {
        socket.connect();
        socket.emit('user_online', { uid: user.uid, geohash });
      } else {
        socket.disconnect();
      }
    });

    const unsubscribeAppState = AppState.addEventListener('change', state => {
      const user = auth().currentUser;
      if (!user) return;

      if (state === 'active') {
        socket.connect();
        socket.emit('user_online', { uid: user.uid, geohash });
      } else {
        socket.emit('user_offline', { uid: user.uid, geohash });
        socket.disconnect();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAppState.remove();
      socket.disconnect();
    };
  }, []);

  return <>{children}</>;
};

export default SocketProvider;

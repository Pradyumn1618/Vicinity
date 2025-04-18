// SocketProvider.tsx
import React, { useEffect, useRef } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { AppState } from 'react-native';
import socket from '../config/socket';
import { createContext, useContext } from 'react';
import { insertMessage, incrementUnreadCount } from '../helper/databaseHelper';
import { useChatContext } from '../context/chatContext';
import { decryptMessage } from './cryptoUtils';
import * as Keychain from 'react-native-keychain';

const SocketContext = createContext(socket);

const KEY_SERVICE = 'com.vicinity.privatekeys';

interface Message {
  id: string;
  sender: string;
  text: string;
  media?: string | null;
  replyTo?: { text: string; id: string } | null;
  timestamp: number;
  delivered?: boolean;
  seen?: boolean;
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { setMessages, currentChatId, setChats } = useChatContext();
  const userGeohashRef = useRef<string | null>(null);
  const connectedRef = useRef(false);

  const connectWithGeo = React.useCallback(async (userId: string) => {
    try {
      const doc = await firestore().collection('users').doc(userId).get();
      const data = doc.data();
      if (!data?.geohash) {
        console.error('❌ No geohash found for user');
        return;
      }

      userGeohashRef.current = data.geohash;

      if (!connectedRef.current) {
        socket.connect();
        connectedRef.current = true;
      }

      socket.emit('user_online', {
        userId,
        geohash: data.geohash,
        username: data.username,
        profilePic: data.profilePic,
      });

      // Remove any existing listener before adding a new one
      socket.off('receive-dm');

      socket.on('receive-dm', async (msg) => {
        const myUid = auth().currentUser?.uid ?? 'unknown_user';
      
        // Store encrypted message locally
        insertMessage(msg, msg.chatId, myUid);
      
        if (currentChatId === msg.chatId) {
          try {
            const existingKey = await Keychain.getGenericPassword({ service: KEY_SERVICE });
            if (!existingKey) {
              console.warn('Private key not found in Keychain');
              return;
            }
      
            const myPrivateKey = Buffer.from(existingKey.password, 'hex');
      
            if (msg.text && msg.nonce && msg.senderEphemeralPubKey) {
              const senderPubKey = Buffer.from(msg.senderEphemeralPubKey, 'hex');
              const nonce = Buffer.from(msg.nonce, 'hex');
              const ciphertext = Buffer.from(msg.text, 'hex');
      
              let medianonce = null;
              let decryptedMedia = null;
              if (msg.media && msg.medianonce) {
                medianonce = Buffer.from(msg.medianonce, 'hex');
                const mediaBuffer = Buffer.from(msg.media, 'hex');
                decryptedMedia = decryptMessage(
                  mediaBuffer.toString('hex'),
                  medianonce.toString('hex'),
                  myPrivateKey.toString('hex'),
                  senderPubKey.toString('hex')
                );
              }
      
              const decryptedText = decryptMessage(
                ciphertext.toString('hex'),
                nonce.toString('hex'),
                myPrivateKey.toString('hex'),
                senderPubKey.toString('hex')
              );
      
              const decryptedMessage: Message = {
                ...msg,
                text: decryptedText,
                media: decryptedMedia || null,
                timestamp: typeof msg.timestamp === 'number'
                  ? msg.timestamp
                  : msg.timestamp?.toDate?.().getTime?.() || Date.now(),
              };
      
              setMessages((prev: Message[]) => [...prev, decryptedMessage]);
            } else {
              console.warn('Missing fields for decryption');
            }
          } catch (err) {
            console.error('❌ Failed to decrypt received message', err);
          }
        } else {
          await incrementUnreadCount(msg.chatId);
          setChats((prevChats) =>
            prevChats.map((chat) => {
              if (chat.id === msg.chatId) {
                return {
                  ...chat,
                  unreadCount: (chat.unreadCount || 0) + 1,
                };
              }
              return chat;
            })
          );
        }
      });
      

    } catch (err) {
      console.error('🔥 Error connecting with geohash:', err);
    }
  }, [currentChatId, setMessages, setChats]);

  useEffect(() => {
    const handleAuthChange = (user: any) => {
      if (user) {
        connectWithGeo(user.uid);
      } else {
        userGeohashRef.current = null;
        socket.disconnect();
        connectedRef.current = false;
      }
    };

    const handleAppStateChange = (state: string) => {
      const user = auth().currentUser;
      const geo = userGeohashRef.current;

      if (!user || !geo) return;

      if (state === 'active') {
        connectWithGeo(user.uid);
      } else {
        socket.emit('user_offline', { userId: user.uid, geohash: geo });
        socket.disconnect();
        connectedRef.current = false;
      }
    };

    const unsubscribeAuth = auth().onAuthStateChanged(handleAuthChange);
    const unsubscribeAppState = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribeAuth();
      unsubscribeAppState.remove();
      socket.off('receive-dm');
      socket.disconnect();
      connectedRef.current = false;
    };
  }, [currentChatId, setMessages, setChats,connectWithGeo]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

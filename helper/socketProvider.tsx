// SocketProvider.tsx
import React, { useEffect, useRef } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { AppState } from 'react-native';
import socket from '../config/socket';
import { createContext, useContext } from 'react';
import { insertMessage, incrementUnreadCount, deleteMessage, decrementUnreadCount, setSeenMessages } from '../helper/databaseHelper';
import { useChatContext } from '../context/chatContext';

const SocketContext = createContext(socket);


interface Message {
  id: string;
  sender: string;
  text: string;
  media?: string | null;
  replyTo?: string | null;
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

      socket.on('delete-message', async (msg) => {
        const { messageId, chatId } = msg;
        deleteMessage(messageId);
        if (currentChatId === chatId) {
          setMessages((prev: Message[]) => prev.filter((message) => message.id !== messageId));
        } else {
          decrementUnreadCount(chatId);
        }

      });

      socket.on('seen-messages', async (msg) => {
        const { chatId, userId: receiver, timestamp } = msg;
        if (currentChatId === chatId) {
          setMessages((prev: Message[]) => prev.map((message) => {
            if (message.sender !== receiver && message.timestamp <= timestamp) {
              return {
                ...message,
                seen: true,
              };
            }
            return message;
          }));
        }
        await setSeenMessages(chatId, receiver, timestamp);
      });

      // Remove any existing listener before adding a new one
      socket.off('receive-dm');

      socket.on('receive-dm', async (msg) => {
        if (!msg) return;
        // Store encrypted message locally
        const myUid = auth().currentUser?.uid;
        if (!myUid) return;
        insertMessage(msg, msg.chatId, myUid);

        if (currentChatId === msg.chatId) {
          msg.seen = true;
          console.log('Received message:', msg);
          setMessages((prev: Message[]) => [msg,...prev]);
          socket.emit('seen-messages', {
            chatId: msg.chatId,
            receiver: msg.sender,
            timestamp: msg.timestamp,
            userId: myUid,
          });

        } else {
          console.log('Received message in background');

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
  }, [currentChatId, setMessages, setChats, connectWithGeo]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

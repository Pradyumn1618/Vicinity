// SocketProvider.tsx
import React, { useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { AppState } from 'react-native';
import socket from '../config/socket';
import { createContext,useContext } from 'react';
import { insertMessage,incrementUnreadCount } from '../helper/databaseHelper';
import { useChatContext } from '../context/chatContext';
const SocketContext = createContext(socket);

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
  const { setMessages } = useChatContext();
  const { currentChatId } = useChatContext();
  const {setChats} = useChatContext();

  useEffect(() => {
    // let currentUserId: string | null = null;
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
        // currentUserId = userId;

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

    socket.on('receive-dm', async (msg) => {
      // 1. Save to local DB
      insertMessage(msg, msg.chatId, auth().currentUser?.uid ?? 'unknown_user');
      // 2. Show in chat screen if open
      console.log('Received message:', msg);
      if (currentChatId === msg.chatId) {
        setMessages((prev: Message[]) => [...prev, msg as Message]);
      } else {
        // 3. Update unread badge
        // console.log('Incrementing unread count for chatId:', msg.chatId);
        await incrementUnreadCount(msg.chatId);
        setChats((prevChats) => {
          console.log('Previous Chats:', prevChats); // Log the previous chats
          console.log('Message Chat ID:', msg.chatId); // Log the chat ID from the message
        
          return prevChats.map((chat) => {
            if (chat.id === msg.chatId) {
              const updatedChat = {
                ...chat,
                unreadCount: (chat.unreadCount || 0) + 1,
              };
              console.log('Updated Chat:', updatedChat); // Log the updated chat
              return updatedChat;
            }
            return chat;
          });
        });
      }
    });
  
    const handleAuthChange = (user: any) => {
      if (user) {
        connectWithGeo(user.uid);
      } else {
        // currentUserId = null;
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
      socket.off('receive-dm');
      socket.disconnect();
    };
  }, [currentChatId, setMessages,setChats]);

  return <SocketContext.Provider value={socket}>
  {children}
</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);

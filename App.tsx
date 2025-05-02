import './global.css';
import React, { useState, useEffect } from 'react';
import Navigation from './navigation';
import { Alert, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { SocketProvider } from './helper/socketProvider';
import auth from '@react-native-firebase/auth';
import { NavigationContainer, StackActions } from '@react-navigation/native';
// import { rootStackParamList } from './helper/types';
import InAppNotification from './components/inAppNotification';
import { getDBConnection, createTables } from './config/database';
import { ChatProvider } from './context/chatContext';
import { useChatContext } from './context/chatContext';
import { getAllChatsFromSQLite, incrementUnreadCount, deleteMessage, insertMessage, decrementUnreadCount, syncOfflineDeletions, incrementGroupUnreadCount, getUnreadCount, getGroupUnreadCount } from './helper/databaseHelper';
import { Buffer } from 'buffer';
import PushNotification from 'react-native-push-notification';
import { navigationRef } from './helper/navigationService'; // adjust path
import { UserProvider } from './context/userContext';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mmkv from './storage';
import { Provider } from 'react-native-paper';


global.Buffer = Buffer;

const AppContent = () => {
  const { setChats, currentChatId,setUnreadChats } = useChatContext();

  interface NotificationData {
    title: string;
    body: string;
    chatId?: string;
    sender?: string;
  }

  interface GroupNotificationData {
    title: string;
    body: string;
    groupId?: string;
  }

  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);
  const [groupNotificationData, setGroupNotificationData] = useState<GroupNotificationData | null>(null);

  // 1. Create Notification Channel (only needed once)

  // 2. Set up database
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        const db = await getDBConnection();
        await createTables(db);
      } catch (error) {
        console.log('message start:', error.message);
      }
    };

    setupDatabase();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        syncOfflineDeletions();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
      console.log('🔁 Token refreshed:', newToken);
      const userId = auth().currentUser?.uid;
      if (userId) {
        const db = getFirestore();
        await db.collection('users').doc(userId).update({
          fcmToken: newToken,
        });
      }
    });
    return unsubscribe;
  }, []);
  


  // 3. Handle notifications (foreground, background, killed)
  useEffect(() => {
    // 3a. Handle notifications when app is opened from background
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(async (remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      // await handleNotification(remoteMessage);
      const user = auth().currentUser;
      if (user && navigationRef.isReady() && remoteMessage.notification && remoteMessage.data?.purpose === 'dm') {
        const sender = remoteMessage.data?.sender ?? '';
        const chatId = remoteMessage.data?.customKey ?? '';
        console.log(chatId, sender);
        navigationRef.dispatch(StackActions.replace('ChatScreen', { chatId, receiver: sender }));
      } else if (user && navigationRef.isReady() && remoteMessage.data?.purpose === 'group-message') {
        const groupId = remoteMessage.data?.customKey ?? '';
        navigationRef.dispatch(StackActions.replace('GroupChatScreen', { groupId }));
      }
    });

    // 3b. Handle app being opened from the killed state (cold start)
    const checkInitialNotification = async () => {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        if (remoteMessage.notification && remoteMessage.data?.purpose === 'dm') {
          const message = {
            id: remoteMessage.data.id,
            sender: remoteMessage.data.sender,
            text: remoteMessage.data.text,
            media: remoteMessage.data.media,
            replyTo: remoteMessage.data.replyTo,
            timestamp: remoteMessage.data.timestamp,
            delivered: remoteMessage.data.delivered,
            seen: remoteMessage.data.seen,
          }
          await insertMessage(message, remoteMessage.data.customKey, remoteMessage.data.receiver);
          await incrementUnreadCount(remoteMessage.data.customKey);
          const unreadCount = await getUnreadCount(remoteMessage.data.customKey);
          if(unreadCount === 1) {
            setUnreadChats((prev) => prev + 1);
          }
          return;
        }
        if (!remoteMessage.notification && remoteMessage.data) {
          if (remoteMessage.data.purpose === 'delete') {
            const messageId = remoteMessage.data?.customKey;
            const chatId = remoteMessage.data?.chatId;
            if (messageId) {
              await deleteMessage(messageId);
              await decrementUnreadCount(chatId);
              const unreadCount = await getUnreadCount(chatId);
              if(unreadCount === 0) {
                setUnreadChats((prev) => prev - 1);
              }
              console.log('Message deleted:', messageId);
            } else {
              console.log('No message ID provided for deletion');
            }
            return;
          }
        }
        if (remoteMessage.notification && remoteMessage.data?.purpose === 'group-message') {
          await incrementGroupUnreadCount(remoteMessage.data.customKey);
          const unreadCount = await getGroupUnreadCount(remoteMessage.data.customKey);
          if(unreadCount === 1) {
            setUnreadChats((prev) => prev + 1);
          }
          return;
        }
      }
    };

    // Check initial notification if the app was opened from a killed state
    checkInitialNotification();

    // 3c. App state listener when it comes to the foreground
    const appStateListener = AppState.addEventListener('change', async (nextAppState: string) => {
      if (nextAppState === 'active') {
        // The app has come to the foreground
        // const userId = auth().currentUser?.uid;
        // if (userId) {
        //   const chats = await getAllChatsFromSQLite(userId);
        //   setChats(chats);
        // }
        PushNotification.cancelAllLocalNotifications();
        console.log('App has come to the foreground');
      }
    });

    return () => {
      unsubscribeOpenedApp();
      appStateListener.remove();
    };
  }, [setChats, setUnreadChats]);

  useEffect(() => {
    if (currentChatId) {
      console.log('Current Chat ID updated:', currentChatId);
    }
  }, [currentChatId]);

  const db = getFirestore();

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      const remoteSessionId = snapshot.data()?.sessionId;
      const localSessionId = await AsyncStorage.getItem('sessionId');

      if (remoteSessionId && localSessionId && remoteSessionId !== localSessionId) {
        console.log('Session mismatch. Logging out...');
        await AsyncStorage.removeItem('sessionId');
        await auth().signOut();
        mmkv.delete('user');
        mmkv.delete('geohash');
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    });

    return () => unsubscribe();
  }, [db]);

  // 4. Handle incoming FCM notifications in the foreground
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('📩 Received in foreground:', remoteMessage);

      const purpose = remoteMessage.data?.purpose;
      const data = remoteMessage.data;

      console.log('data', remoteMessage.data);
      console.log('currentChatId', currentChatId);
      if (!data) return;

      if (purpose === 'dm' && remoteMessage.data) {
        if (
          remoteMessage.data.customKey &&
          currentChatId &&
          typeof remoteMessage.data.customKey === 'string' &&
          typeof currentChatId === 'string' &&
          remoteMessage.data.customKey.trim() === currentChatId.trim()
        ) {
          console.log('🛑 Same chat — no notification shown');
          return; // Don't show notification
        }

        // In-app notification overlay
        setNotificationData({
          title: remoteMessage.notification?.title || 'New Message',
          body: remoteMessage.notification?.body || 'You have a new message.',
          chatId: data.customKey ?? '',
          sender: data.sender ?? '',
        });
        await incrementUnreadCount(data.customKey);
        const unreadCount = await getUnreadCount(data.customKey);
        if(unreadCount === 1) {
          setUnreadChats((prev) => prev + 1);
        }

        return;
      } else if (purpose === 'delete') {
        // Handle delete notification
        const messageId = remoteMessage.data?.customKey;
        if (messageId) {
          await deleteMessage(messageId);
          await decrementUnreadCount(remoteMessage.data.chatId);
          const unreadCount = await getUnreadCount(remoteMessage.data.chatId);
          if(unreadCount === 0) {
            setUnreadChats((prev) => prev - 1);
          }
          console.log('Message deleted:', messageId);
        } else {
          console.log('No message ID provided for deletion');
        }
        return;
      } else if (purpose === 'group-message') {
        // Handle group message notification
        const groupId = remoteMessage.data?.customKey;
        if (groupId === currentChatId) {
          console.log('Same group chat — no notification shown');
          return; // Don't show notification
        } else {
          setGroupNotificationData({
            title: remoteMessage.notification?.title || 'New Group Message',
            body: remoteMessage.notification?.body || 'You have a new group message.',
            groupId: groupId ?? '',
          });
          await incrementGroupUnreadCount(groupId);
          const unreadCount = await getGroupUnreadCount(groupId);
          if(unreadCount === 1) {
            setUnreadChats((prev) => prev + 1);
          }
        }
        return;
      }
      // Handle other types of notifications (e.g., delete, alert)
      const title = data.title || 'Notification';
      const body = data.body || 'You have a new message.';
      Alert.alert(title, body);
    });

    return () => unsubscribe();
  }, [currentChatId,setUnreadChats]);

  // 5. Handle notification press for local notifications
  useEffect(() => {
    PushNotification.configure({
      onNotification: function (notification) {
        console.log('🔔 Local notification tapped:', notification);

        const userInfo = notification.data;
        const chatId = userInfo?.chatId;
        const sender = userInfo?.sender;

        if (chatId && sender && navigationRef.isReady()) {
          navigationRef.navigate('ChatScreen', {
            chatId,
            receiver: sender,
          });
        }

        // Required for Android to handle properly
        notification.finish && notification.finish('NoData');
      },
      popInitialNotification: true,
      requestPermissions: true,
    });
    PushNotification.createChannel(
      {
        channelId: 'dm-messages-v3', // Must be same as used in local notification
        channelName: 'DM Messages',
        channelDescription: 'Direct message notifications',
        importance: 4, // high importance
        vibrate: true,
      },
      (created) => console.log(`Notification channel created v3: ${created}`)
    );
  }, []);

  const handleNotificationPress = () => {
    if (notificationData?.chatId && notificationData?.sender) {
      navigationRef.navigate('ChatScreen', {
        chatId: notificationData.chatId,
        receiver: notificationData.sender,
      });
    }
    setNotificationData(null);
  };

  const handleGroupNotificationPress = () => {
    if (groupNotificationData?.groupId) {
      navigationRef.navigate('GroupChatScreen', {
        groupId: groupNotificationData.groupId,
      });
    }
    setGroupNotificationData(null);
  };

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background notification received:', remoteMessage);
    if (remoteMessage.data) {
      if (remoteMessage.data.purpose === 'dm') {
        const message = {
          id: remoteMessage.data.id,
          sender: remoteMessage.data.sender,
          text: remoteMessage.data.text,
          media: remoteMessage.data.media,
          replyTo: remoteMessage.data.replyTo,
          timestamp: remoteMessage.data.timestamp,
          delivered: remoteMessage.data.delivered,
          seen: remoteMessage.data.seen,
        }
        await insertMessage(message, remoteMessage.data.customKey, remoteMessage.data.receiver);
        await incrementUnreadCount(remoteMessage.data.customKey);
        const unreadCount = await getUnreadCount(remoteMessage.data.customKey);
        if(unreadCount === 1) {
          setUnreadChats((prev) => prev + 1);
        }
        return;
      } else if (remoteMessage.data.purpose === 'delete') {
        const messageId = remoteMessage.data?.customKey;
        if (messageId) {
          await deleteMessage(messageId);
          await decrementUnreadCount(remoteMessage.data.customKey);
          const unreadCount = await getUnreadCount(remoteMessage.data.customKey);
          if(unreadCount === 0) {
            setUnreadChats((prev) => prev - 1);
          }
          console.log('Message deleted:', messageId);
        } else {
          console.log('No message ID provided for deletion');
        }
        return;
      } else if (remoteMessage.data.purpose === 'group-message') {
        await incrementGroupUnreadCount(remoteMessage.data.customKey);
        const unreadCount = await getGroupUnreadCount(remoteMessage.data.customKey);
        if(unreadCount === 1) {
          setUnreadChats((prev) => prev + 1);
        }
        return;
      }
    }

  });
  return (
    <>
      {notificationData && (
        <InAppNotification
          title={notificationData.title}
          body={notificationData.body}
          onPress={handleNotificationPress}
          onClose={() => setNotificationData(null)}
        />
      )}
      {groupNotificationData && (
        <InAppNotification
          title={groupNotificationData.title}
          body={groupNotificationData.body}
          onPress={handleGroupNotificationPress}
          onClose={() => setGroupNotificationData(null)}
        />
      )}
      <NavigationContainer ref={navigationRef} linking={linking}>
        <SocketProvider>
          <Navigation />
        </SocketProvider>
      </NavigationContainer>
    </>
  );
};

const linking = {
  prefixes: ['vicinity://', 'https://vicinity-deep-linking.vercel.app/'],
  config: {
    screens: {
      Home: '',
      Post: 'post/:postId',
    },
  },
};



const App = () => {


  return (
    <>
      <UserProvider>
        <ChatProvider>
          <Provider>
          <AppContent />
          </Provider>
        </ChatProvider>
      </UserProvider>
    </>
  );
};

export default App;

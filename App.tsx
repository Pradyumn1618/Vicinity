import './global.css';
import React, { useState, useEffect } from 'react';
import Navigation from './navigation';
import { Alert, AppState } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { SocketProvider } from './helper/socketProvider';
import auth from '@react-native-firebase/auth';
import { useNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { rootStackParamList } from './helper/types';
import InAppNotification from './components/inAppNotification';
import { getDBConnection, createTables } from './config/database';
import { ChatProvider } from './context/chatContext';
import { useChatContext } from './context/chatContext';
import { getAllChatsFromSQLite, incrementUnreadCount, deleteMessage } from './helper/databaseHelper';
import { Buffer } from 'buffer';
import PushNotification from 'react-native-push-notification';

global.Buffer = Buffer;

const App = () => {
  const { setChats, currentChatId } = useChatContext();
  const navigationRef = useNavigationContainerRef<rootStackParamList>(); // Create a typed navigation ref

  interface NotificationData {
    title: string;
    body: string;
    chatId?: string;
    sender?: string;
  }

  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);

  // 1. Create Notification Channel (only needed once)
  useEffect(() => {
    PushNotification.createChannel(
      {
        channelId: 'dm-messages', // Must be same as used in local notification
        channelName: 'DM Messages',
        channelDescription: 'Direct message notifications',
        importance: 4, // high importance
        vibrate: true,
      },
      (created) => console.log(`Notification channel created: ${created}`)
    );
  }, []);

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

  // 3. Handle notifications (foreground, background, killed)
  useEffect(() => {
    // const handleNotification = async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    //   // Only increment unread count if it's a DM
    //   if (remoteMessage.notification && remoteMessage.data?.purpose === 'dm') {
    //     const chatId = remoteMessage.data.customKey ?? '';
    //     await incrementUnreadCount(chatId); // Increment unread count in database
    //   } else if (remoteMessage.notification && remoteMessage.data?.purpose === 'delete') {
    //     // Handle delete notification
    //     const messageId = remoteMessage.data?.customKey;
    //     if (messageId) {
    //       if (typeof messageId === 'string') {
    //         await deleteMessage(messageId);
    //       } else {
    //         console.error('Invalid messageId type:', typeof messageId);
    //       }
    //       console.log('Message deleted:', messageId);
    //     } else {
    //       console.log('No message ID provided for deletion');
    //     }
    //     return;
    //   }
    // };

    // 3a. Handle notifications when app is opened from background
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(async (remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      // await handleNotification(remoteMessage);
      const user = auth().currentUser;
      if (user && navigationRef.isReady() && remoteMessage.notification && remoteMessage.data?.purpose === 'dm') {
        const sender = remoteMessage.data?.sender ?? '';
        const chatId = remoteMessage.data?.customKey ?? '';
        console.log(chatId, sender);
        navigationRef.navigate('ChatScreen', { chatId, receiver: sender });
      }else if(remoteMessage.userInfo){
        
      }
    });

    // 3b. Handle app being opened from the killed state (cold start)
    const checkInitialNotification = async () => {
      const remoteMessage = await messaging().getInitialNotification();
      // if (remoteMessage) {
      //   console.log('App was opened from a notification:', remoteMessage.notification);
      //   await handleNotification(remoteMessage);

      //   // Push local notification when the app is killed and opened by the notification
      //   if (remoteMessage.notification) {
      //     PushNotification.localNotification({
      //       channelId: 'dm-messages',
      //       title: remoteMessage.notification.title ?? 'New Message',
      //       message: remoteMessage.notification.body ?? 'You have a new message',
      //       playSound: true,
      //       soundName: 'default',
      //       userInfo: {
      //         chatId: remoteMessage.data?.customKey ?? '',
      //         sender: remoteMessage.data?.sender ?? '',
      //       },
      //     });
      //   }
      // }
      if (remoteMessage) {
        if (remoteMessage.data) {
          if (remoteMessage.data.purpose === 'dm') {
            const data = remoteMessage.data;
            PushNotification.localNotification({
              channelId: 'dm-messages',
              title: data.title ?? 'New Message',
              message: data.body ?? 'You have a new message',
              id: typeof data.tag === 'string' ? data.tag : JSON.stringify(data.tag ?? ''),
              playSound: true,
              soundName: 'default',
              userInfo: {
                chatId: remoteMessage.data?.customKey ?? '',
                sender: remoteMessage.data?.sender ?? '',
              },
            });
            return;
          }else if (remoteMessage.data.purpose === 'delete') {
            const messageId = remoteMessage.data?.customKey;
            if (messageId) {
              await deleteMessage(messageId);
              console.log('Message deleted:', messageId);
            } else {
              console.log('No message ID provided for deletion');
            }
            return;
          }else if (remoteMessage.data.purpose === 'clear-notification') {
            const messageId = remoteMessage.data?.tag;
            PushNotification.cancelLocalNotification(messageId);
            return;
          }
        }
      }
    };
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification received:', remoteMessage.notification);

      // await handleNotification(remoteMessage);

      // Push local notification when app is in the background
      if (remoteMessage.data) {
        if (remoteMessage.data.purpose === 'dm') {
          const data = remoteMessage.data;
          PushNotification.localNotification({
            channelId: 'dm-messages',
            title: data.title ?? 'New Message',
            message: data.body ?? 'You have a new message',
            id: typeof data.tag === 'string' ? data.tag : JSON.stringify(data.tag ?? ''),
            playSound: true,
            soundName: 'default',
            data: {
              chatId: remoteMessage.data?.customKey ?? '',
              sender: remoteMessage.data?.sender ?? '',
            },
          });
          return;
        }else if (remoteMessage.data.purpose === 'delete') {
          const messageId = remoteMessage.data?.customKey;
          if (messageId) {
            await deleteMessage(messageId);
            console.log('Message deleted:', messageId);
          } else {
            console.log('No message ID provided for deletion');
          }
          return;
        }else if (remoteMessage.data.purpose === 'clear-notification') {
          const messageId = remoteMessage.data?.tag;
          PushNotification.cancelLocalNotification(messageId);
          return;
        }
      }
      
    });

    // Check initial notification if the app was opened from a killed state
    checkInitialNotification();

    // 3c. App state listener when it comes to the foreground
    const appStateListener = AppState.addEventListener('change', async (nextAppState: string) => {
      if (nextAppState === 'active') {
        // The app has come to the foreground
        const userId = auth().currentUser?.uid;
        if (userId) {
          const chats = await getAllChatsFromSQLite(userId);
          setChats(chats);
        }
        PushNotification.cancelAllLocalNotifications();
        console.log('App has come to the foreground');
      }
    });

    return () => {
      unsubscribeOpenedApp();
      appStateListener.remove();
    };
  }, [navigationRef, setChats]);

  // 4. Handle incoming FCM notifications in the foreground
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('📩 Received in foreground:', remoteMessage);

      const purpose = remoteMessage.data?.purpose;
      const data = remoteMessage.data;
      if (!data) return;

      if (purpose === 'dm' && remoteMessage.data) {
        if (remoteMessage.data.customKey === currentChatId) {
          console.log('🛑 Same chat — no notification shown');
          return; // Exit early
        }

        // In-app notification overlay
        setNotificationData({
          title: typeof data.title === 'string' ? data.title : 'No Title',
          body: typeof data.body === 'string' ? data.body : JSON.stringify(data.body ?? 'No Body'),
          chatId: data.customKey ?? '',
          sender: data.sender ?? '',
        });
        return;
      } else if (purpose === 'delete') {
        // Handle delete notification
        const messageId = remoteMessage.data?.customKey;
        if (messageId) {
          await deleteMessage(messageId);
          console.log('Message deleted:', messageId);
        } else {
          console.log('No message ID provided for deletion');
        }
        return;
      } else if (purpose === 'clear-notification') {
        // Handle clear notification
        const messageId = remoteMessage.data?.customKey;
        PushNotification.cancelLocalNotification(messageId);
        return;
      }

      // Handle other types of notifications (e.g., delete, alert)
      const title = data.title || 'Notification';
      const body = data.body || 'You have a new message.';
      Alert.alert(title, body);
    });

    return () => unsubscribe();
  }, [currentChatId]);

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
  }, [navigationRef]);

  const handleNotificationPress = () => {
    if (notificationData?.chatId && notificationData?.sender) {
      navigationRef.navigate('ChatScreen', {
        chatId: notificationData.chatId,
        receiver: notificationData.sender,
      });
    }
    setNotificationData(null);
  };

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
      <NavigationContainer ref={navigationRef}>
        <ChatProvider>
          <SocketProvider>
            <Navigation />
          </SocketProvider>
        </ChatProvider>
      </NavigationContainer>
    </>
  );
};

export default App;

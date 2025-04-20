import './global.css';
import React, { useState, useEffect } from 'react';
import Navigation from './navigation';
import { Alert, AppState } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { SocketProvider } from './helper/socketProvider';
import auth from '@react-native-firebase/auth';
import { NavigationContainer } from '@react-navigation/native';
// import { rootStackParamList } from './helper/types';
import InAppNotification from './components/inAppNotification';
import { getDBConnection, createTables } from './config/database';
import { ChatProvider } from './context/chatContext';
import { useChatContext } from './context/chatContext';
import { getAllChatsFromSQLite, incrementUnreadCount, deleteMessage, insertMessage,decrementUnreadCount } from './helper/databaseHelper';
import { Buffer } from 'buffer';
import PushNotification from 'react-native-push-notification';
import { navigationRef } from './helper/navigationService'; // adjust path
import { send } from 'process';



global.Buffer = Buffer;


const App = () => {
  const { setChats, currentChatId } = useChatContext();

  interface NotificationData {
    title: string;
    body: string;
    chatId?: string;
    sender?: string;
  }

  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);

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
        navigationRef.navigate('ChatScreen', { chatId, receiver: sender });
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
          incrementUnreadCount(remoteMessage.data.customKey);
          return;
        }
        if (!remoteMessage.notification && remoteMessage.data) {
          if (remoteMessage.data.purpose === 'delete') {
            const messageId = remoteMessage.data?.customKey;
            if (messageId) {
              await deleteMessage(messageId);
              decrementUnreadCount(messageId);
              console.log('Message deleted:', messageId);
            } else {
              console.log('No message ID provided for deletion');
            }
            return;
          }
        }
      }
    };

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
  }, [setChats]);

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
          title: remoteMessage.notification?.title || 'New Message',
          body: remoteMessage.notification?.body || 'You have a new message.',
          chatId: data.customKey ?? '',
          sender: data.sender ?? '',
        });
        
        // const message = {
        //   id: remoteMessage.data.id,
        //   sender: remoteMessage.data.sender,
        //   text: remoteMessage.data.text,
        //   media: remoteMessage.data.media,
        //   replyTo: remoteMessage.data.replyTo,
        //   timestamp: remoteMessage.data.timestamp,
        //   delivered: remoteMessage.data.delivered,
        //   seen: remoteMessage.data.seen,
        // }

        // insertMessage(message, remoteMessage.data.customKey, remoteMessage.data.receiver);
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


import './global.css';
// filepath: /home/pradyumn/SWE/Vicinity/App.tsx
import React, { useState } from 'react';
import Navigation from './navigation';
import { useEffect } from 'react';
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
import { getAllChatsFromSQLite, incrementUnreadCount } from './helper/databaseHelper';
import { Buffer } from 'buffer';
global.Buffer = Buffer;



const App = () => {
  const { setChats } = useChatContext();
  const navigationRef = useNavigationContainerRef<rootStackParamList>(); // Create a typed navigation ref
  interface NotificationData {
    title: string;
    body: string;
    chatId?: string;
    sender?: string;
  }

  const [notificationData, setNotificationData] = useState<NotificationData | null>(null);
  // const navigationRef = useNavigationContainerRef(); // Create a navigation ref

  useEffect(() => {
    const setupDatabase = async () => {
      try{
      const db = await getDBConnection();
      await createTables(db);
      }catch(error){
        console.log("message start:",error.message);
      }
    };

    setupDatabase();
  }, []);


  useEffect(() => {

    const handleNotification = async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      // Only increment unread count if it's a DM
      if (remoteMessage.notification && remoteMessage.data?.purpose === 'dm') {
        const chatId = remoteMessage.data.customKey ?? '';
        await incrementUnreadCount(chatId); // Increment unread count in database
  
        // Optionally navigate to the chat screen, if the app is in the foreground
        // const user = auth().currentUser;
        // if (user && navigationRef.isReady()) {
        //   const sender = remoteMessage.data.sender ?? '';
        //   navigationRef.navigate('ChatScreen', { chatId, sender });
        // }
      }
    };
    // Handle notifications when the app is opened from the background
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(async (remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      await handleNotification(remoteMessage);
      const user = auth().currentUser;
        if (user && navigationRef.isReady()) {
          const sender = remoteMessage.data?.sender ?? '';
          const chatId = remoteMessage.data?.customKey ?? '';
          console.log(chatId,sender);
          navigationRef.navigate('ChatScreen', { chatId, receiver: sender });
        }
    });
  
  
    
    // 3. Handle the app being opened from the killed state (cold start)
    const checkInitialNotification = async () => {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('App was opened from a notification:', remoteMessage.notification);
        await handleNotification(remoteMessage);
      }
    };
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification received:', remoteMessage.notification);
      await handleNotification(remoteMessage);
    });
  
    // Check initial notification if the app was opened from a killed state
    checkInitialNotification();

    const appStateListener = AppState.addEventListener('change', async (nextAppState: string) => {
      if (nextAppState === 'active') {
        // The app has come to the foreground
        // You can optionally call a function to sync data here if needed
        const userId = auth().currentUser?.uid;
        if(userId){
        const chats = await getAllChatsFromSQLite(userId);
        setChats(chats);
        }
        console.log('App has come to the foreground');
      }
    });


    return () => {
      unsubscribeOpenedApp();
      appStateListener.remove();
      
    };
  }, [navigationRef,setChats]);
  

  useEffect(() => {
    // Handle notifications when the app is in the foreground
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('📩 Received in foreground:', remoteMessage);
      if (remoteMessage.notification) {
        const purpose = remoteMessage.data?.purpose;
        if (purpose === 'dm' && remoteMessage.data) {
          setNotificationData({
            title: remoteMessage.notification.title ?? 'No Title',
            body: remoteMessage.notification.body ?? 'No Body',
            chatId: remoteMessage.data.customKey ?? '',
            sender: remoteMessage.data.sender ?? '',
          });
        } else {
          const title = remoteMessage.notification.title || 'Notification';
          const body = remoteMessage.notification.body || 'You have a new message.';
          Alert.alert(title, body);
        }
      }
    });
    return () => {
      unsubscribe();
    };
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
  )
};

export default App;

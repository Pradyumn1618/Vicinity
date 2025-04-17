// /**
//  * Sample React Native App
//  * https://github.com/facebook/react-native
//  *
//  * @format
//  */

// import React from 'react';
// import type {PropsWithChildren} from 'react';
// import {
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   useColorScheme,
//   View,
// } from 'react-native';

// import {
//   Colors,
//   DebugInstructions,
//   Header,
//   LearnMoreLinks,
//   ReloadInstructions,
// } from 'react-native/Libraries/NewAppScreen';

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;

// function Section({children, title}: SectionProps): React.JSX.Element {
//   const isDarkMode = useColorScheme() === 'dark';
//   return (
//     <View style={styles.sectionContainer}>
//       <Text
//         style={[
//           styles.sectionTitle,
//           {
//             color: isDarkMode ? Colors.white : Colors.black,
//           },
//         ]}>
//         {title}
//       </Text>
//       <Text
//         style={[
//           styles.sectionDescription,
//           {
//             color: isDarkMode ? Colors.light : Colors.dark,
//           },
//         ]}>
//         {children}
//       </Text>
//     </View>
//   );
// }

// function App(): React.JSX.Element {
//   const isDarkMode = useColorScheme() === 'dark';

//   const backgroundStyle = {
//     backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
//   };

//   return (
//     <SafeAreaView style={backgroundStyle}>
//       <StatusBar
//         barStyle={isDarkMode ? 'light-content' : 'dark-content'}
//         backgroundColor={backgroundStyle.backgroundColor}
//       />
//       <ScrollView
//         contentInsetAdjustmentBehavior="automatic"
//         style={backgroundStyle}>
//         <Header />
//         <View
//           style={{
//             backgroundColor: isDarkMode ? Colors.black : Colors.white,
//           }}>
//           <Section title="Step One">
//             Edit <Text style={styles.highlight}>App.tsx</Text> to change this
//             screen and then come back to see your edits.
//           </Section>
//           <Section title="See Your Changes">
//             <ReloadInstructions />
//           </Section>
//           <Section title="Debug">
//             <DebugInstructions />
//           </Section>
//           <Section title="Learn More">
//             Read the docs to discover what to do next:
//           </Section>
//           <LearnMoreLinks />
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   sectionContainer: {
//     marginTop: 32,
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//   },
//   sectionDescription: {
//     marginTop: 8,
//     fontSize: 18,
//     fontWeight: '400',
//   },
//   highlight: {
//     fontWeight: '700',
//   },
// });

// export default App;

import './global.css';
// filepath: /home/pradyumn/SWE/Vicinity/App.tsx
import React, { useState } from 'react';
import Navigation from './navigation';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { SocketProvider } from './helper/socketProvider';
import auth from '@react-native-firebase/auth';
import { useNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { rootStackParamList } from './helper/types';
import InAppNotification from './components/inAppNotification';
import { getDBConnection, createTables } from './config/database';


const App = () => {
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
      const db = await getDBConnection();
      await createTables(db);
    };
  
    setupDatabase();
  }, []);
  

  useEffect(() => {
    // Handle notifications when the app is opened from the background
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      if (remoteMessage.notification) {
        const purpose = remoteMessage.data?.purpose;
        if (purpose === 'dm' && remoteMessage.data) {
          const chatId = remoteMessage.data.customKey ?? '';
          const sender = remoteMessage.data.sender ?? '';
          const user = auth().currentUser;
          if (user) {
            // Navigate to ChatScreen
            navigationRef.navigate('ChatScreen', { chatId, sender });
          }
        }
      }
    });

    return unsubscribe;
  }, [navigationRef]);

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

    return unsubscribe;
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
        <SocketProvider>
          <Navigation />
        </SocketProvider>
      </NavigationContainer>
    </>
  )
};

export default App;

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
import React from 'react';
import Navigation from './navigation';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {SocketProvider} from './helper/socketProvider';
import auth from '@react-native-firebase/auth';
import { useNavigationContainerRef,NavigationContainer } from '@react-navigation/native';
import { rootStackParamList } from './helper/types';


const App = () => {
  const navigationRef = useNavigationContainerRef<rootStackParamList>(); // Create a typed navigation ref
  // const navigationRef = useNavigationContainerRef(); // Create a navigation ref

  useEffect(() => {
    // Handle notifications when the app is opened from the background
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      if (remoteMessage.notification) {
        const purpose = remoteMessage.data?.purpose;
        if (purpose === 'dm' && remoteMessage.data) {
          const chatId = remoteMessage.data.customKey ?? '';
          const receiver = remoteMessage.data.receiver ?? '';
          const user = auth().currentUser;
          if (user) {
            // Navigate to ChatScreen
            navigationRef.navigate('ChatScreen', { chatId, receiver });
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
        const title = remoteMessage.notification.title || 'Notification';
        const body = remoteMessage.notification.body || 'You have a new message.';
        Alert.alert(title, body);
      }
    });

    return unsubscribe;
  }, []);
  return (
    <NavigationContainer ref={navigationRef}>
    <SocketProvider>
      <Navigation />
    </SocketProvider>
    </NavigationContainer>
    )
};

export default App;

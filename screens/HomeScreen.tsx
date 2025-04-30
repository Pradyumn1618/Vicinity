// filepath: /home/pradyumn/SWE/Vicinity/screens/HomeScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, Button, Alert, TouchableOpacity, Platform } from 'react-native';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import mmkv from '../storage';
// import {requestLocationPermission} from '../helper/locationPermission';
// import GetLocation from 'react-native-get-location';
// import * as geofire from 'geofire-common';
import sendNotificationAsync from '../helper/sendNotification';
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import messaging from '@react-native-firebase/messaging';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { requestLocationPermission, startLocationTracking,requestNotificationPermission } from '../helper/locationPermission';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import NavigationBar from '../components/NavigationBar';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}
// const user = mmkv.getString('user');
// const userData = user ? JSON.parse(user) : null;;

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      requestNotificationPermission();
      refreshFcmToken();

    }
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
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      return;
    }
    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        if (Platform.OS === 'android') {
          try {
            const enableResult = await promptForEnableLocationIfNeeded();
            console.log('enableResult', enableResult);
            startLocationTracking(auth().currentUser?.uid || '');
          } catch (error: unknown) {
            if (error instanceof Error) {
              console.error(error.message);
            }
          }
        }
      } else {
        Alert.alert(
          "Permission Required for best experience",
          "Enable location in Settings > Apps > Vicinity > Permissions"
        );
      }
    };

    checkPermission();
  }, []);

  const refreshFcmToken = async () => {
    try {
      const token = await messaging().getToken();
      // console.log('📲 New FCM Token:', token);
  
      const userId = auth().currentUser?.uid;
      if (userId && token) {
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();
        const savedToken = userDoc.data()?.fcmToken;
        if (savedToken === token) {
          return;
        }
        await db.collection('users').doc(userId).update({
          fcmToken: token,
        });
        // console.log('✅ Token updated in Firestore');
      }
    } catch (err) {
      console.error('Failed to refresh FCM token:', err);
    }
  };

  // Check authentication on initial mount
  const checkAuthentication = React.useCallback(() => {
    if (!mmkv.getString('user')) {
      // Use reset instead of navigate to remove the current screen from the stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [navigation]);
  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);
  // Check authentication every time the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      checkAuthentication();
    }, [checkAuthentication])
  );

  const sendNotification = async () => {
    const user = auth().currentUser;
    if (!user) return;

    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists) {
      const data = docSnap.data();
      const token = data?.fcmToken;
      if (token) {
        await messaging().requestPermission();
        const authStatus = await messaging().hasPermission();
        if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
          console.log('Notification permission not granted');
          return;
        }
        try {
          await sendNotificationAsync([token]);
        }
        catch (error) {
          Alert.alert("Error", error instanceof Error ? error.message : "An unknown error occurred");
        }
      } else {
        console.log("No token found for the user");
      }
    } else {
      console.log("No such document!");
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-white text-xl">Home Screen</Text>
      <Button title="Send Noti" onPress={() => sendNotification()} color="#4F46E5" /> {/* Optional custom color for visibility */}

     <NavigationBar/>
    </View>
  );
};

export default HomeScreen;

// import { check, PERMISSIONS, RESULTS } from "react-native-permissions";
// import { Alert, Linking } from "react-native";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import Geolocation from 'react-native-geolocation-service';
import Geohash from 'ngeohash';
import mmkv from '../storage';
import { collection, GeoPoint, getFirestore,doc,getDoc,setDoc } from "@react-native-firebase/firestore";
// import { useSocket } from "./socketProvider";
import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';
import socket from "../config/socket";



const firestore = getFirestore();

export const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
        try {
            // Request foreground permissions first
            const foregroundGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "Location Access Required",
                    message: "This app needs location access to show nearby posts",
                    buttonNeutral: "Ask Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK",
                }
            );

            if (foregroundGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return false;
            }

            // For Android 10+ background location
            // if (needsBackground && Platform.Version >= 29) {
            //     const backgroundGranted = await PermissionsAndroid.request(
            //         PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            //         {
            //             title: "Background Location Required",
            //             message: "Enable 'Allow all the time' for post updates in background",
            //             buttonNeutral: "Ask Later",
            //             buttonNegative: "Cancel",
            //             buttonPositive: "OK",
            //         }
            //     );
                
            //     return backgroundGranted === PermissionsAndroid.RESULTS.GRANTED;
            // }

            return true;
            
        } catch (err) {
            console.warn("Location permission error:", err);
            return false;
        }
    }
    return true; // iOS handling
};


export const startLocationTracking = (userId: string) => {
  console.log('Starting location tracking...');
  console.log('userId:', userId);
    Geolocation.watchPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        const currentGeoHash = Geohash.encode(latitude, longitude, 6);
        console.log("geohash",currentGeoHash);
  
        const oldHash = mmkv.getString('geohash');
        console.log('Old geohash:', oldHash);
        const userRef = doc(firestore, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const geohash = userData?.geohash;

        console.log('User geohash from Firestore:', geohash);

  
        if (currentGeoHash !== oldHash || geohash !== currentGeoHash) {
          try{
          mmkv.set('geohash', currentGeoHash);
          console.log('Geohash updated:', currentGeoHash);
          if(!socket.connected){
            socket.connect();
          }
          socket.emit('update_location', {
            userId,
            geohash: currentGeoHash,
            oldHash,
          });

          // Firestore update
          if (userId !== '') {
            const userRef2 = doc(firestore, 'users', userId);
            await setDoc(userRef2, {
              geohash: currentGeoHash,
              location: new GeoPoint(latitude, longitude),
            }, { merge: true });
            console.log('Firestore updated with new geohash:', currentGeoHash);
          }
        }catch (error) {
          console.error('Error updating Firestore:', error);
        }
  
          // Notify page/component
        }
      },
      error => {
        console.log('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 20, // Update only if user moves 20+ meters
        interval: 10000, // Every 10 seconds
        fastestInterval: 5000,
      }
    );
  };

  
export const requestNotificationPermission = async () => {
  // Check if the user has already selected "Don't ask again"
  const alreadyAsked = mmkv.getBoolean('notification_permission_requested');
  if (alreadyAsked) {
    console.log('User selected "Don\'t ask again". Skipping permission request.');
    return;
  }

  // Show an alert to ask for permission
  Alert.alert(
    'Enable Notifications',
    'This app needs notification permissions to keep you updated.',
    [
      {
        text: 'Don\'t Ask Again',
        onPress: () => {
          mmkv.set('notification_permission_requested', true); // Store the flag
          console.log('User selected "Don\'t ask again".');
        },
        style: 'cancel',
      },
      {
        text: 'Allow',
        onPress: async () => {
          const authStatus = await messaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

          if (enabled) {
            console.log('Notification permission granted.');
          } else {
            console.log('Notification permission denied.');
          }

          mmkv.set('notification_permission_requested', true); // Store the flag
        },
      },
    ]
  );
};

  export const refreshFcmToken = async () => {
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

  export const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else {
      return true; // iOS handled via plist
    }
  };

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

  const handleLogout = async () => {
    try {
      await auth().signOut();
      mmkv.delete('user');
      mmkv.delete('geohash');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }

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

      {/* Bottom Navigation Buttons */}
      <View className="absolute bottom-5 left-5 right-5 flex-row justify-around bg-zinc-900 py-3 rounded-xl shadow-lg border border-zinc-800" >
        <TouchableOpacity onPress={() => navigation.navigate('Events')} className="items-center">
          <Ionicons name="newspaper-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Events</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Profile')} className="items-center">
          <Ionicons name="person-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Inbox')} className="items-center">
          <Ionicons name="chatbubble-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} className="items-center">
          <Ionicons name="log-out-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HomeScreen;

// import React, { useEffect, useState, useCallback } from "react";
// import { View, FlatList, RefreshControl } from "react-native";
// import { MMKV } from 'react-native-mmkv';
// // import { fetchRecommendedPosts } from "../api/recommendations";
// // import geohash from "ngeohash";
// import PostCard from "../components/PostCard";

// const mmkv = new MMKV();

// const HomeScreen = () => {
//     const [posts, setPosts] = useState([]);
//     const [refreshing, setRefreshing] = useState(false);
//     const userGeohash = getUserGeohashRegion();

//     useEffect(() => {
//         loadPosts();
//     }, []);

//     const loadPosts = async () => {
//         const cachedPosts = mmkv.getString(`posts_${userGeohash}`);
//         if (cachedPosts) {
//             setPosts(JSON.parse(cachedPosts));
//         }
//         fetchAndCachePosts();
//     };

//     const fetchAndCachePosts = async () => {
//         try {
//             const newPosts = await fetchRecommendedPosts(userGeohash);
//             setPosts(newPosts);
//             mmkv.set(`posts_${userGeohash}`, JSON.stringify(newPosts));
//         } catch (error) {
//             console.error("Failed to fetch posts:", error);
//         }
//     };

//     const onRefresh = useCallback(() => {
//         setRefreshing(true);
//         fetchAndCachePosts().finally(() => setRefreshing(false));
//     }, []);

//     return (
//         <View style={{ flex: 1 }}>
//             <FlatList
//                 data={posts}
//                 keyExtractor={(item) => item.id.toString()}
//                 renderItem={({ item }) => <PostCard post={item} />}
//                 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//             />
//         </View>
//     );
// };

// export default HomeScreen;

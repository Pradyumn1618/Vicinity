// filepath: /home/pradyumn/SWE/Vicinity/screens/HomeScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, Button,Alert} from 'react-native';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import mmkv from '../storage';
import requestLocationPermission from '../helper/locationPermission';
import GetLocation from 'react-native-get-location';
import * as geofire from 'geofire-common';
import sendNotificationAsync from '../helper/sendNotification';
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import messaging from '@react-native-firebase/messaging';






interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission(true);
      
      if (hasPermission) {
        // Get the current location
        const location = await GetLocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        const geohash = geofire.geohashForLocation([location.latitude, location.longitude]);
        if(mmkv.getString('geohash')?.substring(5) !== geohash.substring(5)) {
          mmkv.set('geohash', geohash);
        }
      } else {
        Alert.alert(
          "Permission Required",
          "Enable location in Settings > Apps > [Your App] > Permissions"
        );
      }
    };

    checkPermission();
  }, []);
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
  }
  
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-black text-xl">Home Screen</Text>
      <Button title="Send Noti" onPress={()=>sendNotification()}/>
      {/* Buttons at the Bottom */}
      <View className="absolute bottom-5 left-5 right-5 flex-row justify-between">
        <Button title="Go to Details" onPress={() => navigation.navigate('Details')} />
        <Button title="Go to Profile" onPress={() => navigation.navigate('Profile')} />
        <Button title="Logout" onPress={handleLogout} />
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

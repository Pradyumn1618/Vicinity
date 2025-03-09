// filepath: /home/pradyumn/SWE/Vicinity/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-black text-xl">Home Screen</Text>
      <Button
        title="Go to Details"
        onPress={() => navigation.navigate('Details')}
      />
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

// const storage = new MMKV();

// const HomeScreen = () => {
//     const [posts, setPosts] = useState([]);
//     const [refreshing, setRefreshing] = useState(false);
//     const userGeohash = getUserGeohashRegion();

//     useEffect(() => {
//         loadPosts();
//     }, []);

//     const loadPosts = async () => {
//         const cachedPosts = storage.getString(`posts_${userGeohash}`);
//         if (cachedPosts) {
//             setPosts(JSON.parse(cachedPosts));
//         }
//         fetchAndCachePosts();
//     };

//     const fetchAndCachePosts = async () => {
//         try {
//             const newPosts = await fetchRecommendedPosts(userGeohash);
//             setPosts(newPosts);
//             storage.set(`posts_${userGeohash}`, JSON.stringify(newPosts));
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

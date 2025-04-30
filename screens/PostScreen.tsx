import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { storage, loadCachedPosts, savePostsToCache, updatePostCacheAfterFetch } from './storage';
import NavigationBar from '../components/NavigationBar';
import { NavigationProp } from '@react-navigation/native';

interface PostScreenProps {
    navigation: NavigationProp<any>;
}

const PostScreen = ({ navigation }:PostScreenProps) => {
//   const [posts, setPosts] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const fetchPosts = async () => {
//     try {
//       setLoading(true);
//       // Simulate fetching from Firestore or API
//       const fetchedPosts = await fetchFromFirestore(); // Implement your fetch function here
//       // Update the cache with fresh posts, excluding reported posts
//       updatePostCacheAfterFetch(locationKey, fetchedPosts, reportedPostIds);
//       // Update local state with new posts
//       setPosts(fetchedPosts);
//     } catch (error) {
//       console.error('Error fetching posts:', error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     // Load cached posts if available
//     const cachedPosts = loadCachedPosts(locationKey);
//     if (cachedPosts.length > 0) {
//       setPosts(cachedPosts);
//     }

//     // Fetch fresh posts in the background
//     fetchPosts();
//   }, []);

  return (
    <View className='flex-1 bg-zinc-900 items-center justify-center'>
      {/* {loading ? (
        <Text>Loading...</Text>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => <Text>{item.content}</Text>}
          keyExtractor={(item) => item.id.toString()}
        />
      )} */}
      <Text className='text-white'>Post Screen</Text>
      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default PostScreen;

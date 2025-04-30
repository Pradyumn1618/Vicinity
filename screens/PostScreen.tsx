import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Platform, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { requestLocationPermission, startLocationTracking } from '../helper/locationPermission';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import NavigationBar from '../components/NavigationBar';
import mmkv from '../storage';
import { Post } from '../helper/types'; // Create this interface if not already

interface PostScreenProps {
  navigation: NavigationProp<any>;
}

const PostScreen = ({ navigation }: PostScreenProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;

    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        if (Platform.OS === 'android') {
          try {
            const enableResult = await promptForEnableLocationIfNeeded();
            console.log('enableResult', enableResult);
            startLocationTracking(user.uid);
          } catch (error: unknown) {
            if (error instanceof Error) {
              console.error(error.message);
            }
          }
        }
      } else {
        Alert.alert(
          "Permission Required for Best Experience",
          "Enable location in Settings > Apps > Vicinity > Permissions"
        );
      }
    };

    checkPermission();
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const geohash5 = mmkv.getString('geohash')?.substring(0, 5);
        if (!geohash5) throw new Error("Missing geohash");

        const querySnapshot = await firestore()
          .collection('posts')
          .where('geohash5', '==', geohash5)
          // .orderBy('createdAt', 'desc')
          .get();

        const fetchedPosts: Post[] = querySnapshot.docs.map(doc => doc.data() as Post);
        setPosts(fetchedPosts);
      } catch (err) {
        console.error("Error fetching posts:", err);
        Alert.alert("Error", "Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const renderItem = ({ item }: { item: Post }) => (
    <View className="bg-zinc-800 p-4 mb-4 rounded-lg">
      <Text className="text-white text-lg font-semibold mb-1">{item.title}</Text>
      <Text className="text-white mb-2">{item.content}</Text>
      {item.mediaUrls?.map((url, index) => (
        <Image
          key={index}
          source={{ uri: url }}
          style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 10 }}
          resizeMode="cover"
        />
      ))}
      <Text className="text-zinc-400 text-sm">{item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-900">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-white mt-2">Loading posts...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text className="text-white text-center mt-10">No posts available in your area.</Text>
          }
        />
      )}
      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default PostScreen;

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import firestore, { getFirestore, collection, getDocs, doc, deleteDoc } from '@react-native-firebase/firestore';
import { Post } from '../helper/types';
import { useUser } from '../context/userContext';
import Icon from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Video from 'react-native-video';

interface SavedPostsScreenProps {
  navigation: NavigationProp<any>;
}

const db = getFirestore();

const SavedPostsScreen = ({ navigation }: SavedPostsScreenProps) => {
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0); // Track the current media index for videos
  const { user } = useUser();
  const screenWidth = Dimensions.get('window').width;

  const fetchSavedPosts = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch saved post IDs from the user's savedPosts subcollection
      const savedPostsRef = collection(db, 'users', user?.id, 'savedPosts');
      const snapshot = await getDocs(savedPostsRef);

      const postIds = snapshot.docs.map(doc => doc.data().id);

      if (postIds.length > 0) {
        // Fetch the actual posts using the post IDs
        const postsSnapshot = await getDocs(collection(db, 'posts'));
        const fetchedPosts = postsSnapshot.docs
          .filter(doc => postIds.includes(doc.id))
          .map(doc => ({
            ...(doc.data() as Post),
            id: doc.id,
          }));

        setSavedPosts(fetchedPosts);
      } else {
        setSavedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  const isVideo = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      return /\.(m3u8|mp4|mov|webm|avi|mkv)$/i.test(decoded.split('?')[0]);
    } catch {
      return false;
    }
  };

  const unsavePost = async (postId: string) => {
    try {
      const savedPostRef = doc(db, 'users', user?.id, 'savedPosts', postId);
      await deleteDoc(savedPostRef);
      setSavedPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      Alert.alert('Success', 'Post unsaved successfully.');
    } catch (error) {
      console.error('Error unsaving post:', error);
      Alert.alert('Error', 'Failed to unsave post.');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) {
      setCurrentMediaIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderItem = ({ item }: { item: Post }) => {
    const containerWidth = Dimensions.get('window').width - 32; // Adjust for padding
  
    return (
      <TouchableWithoutFeedback
        onPress={() => navigation.navigate('Post', { postId: item.id })}
      >
        <View style={styles.postContainer}>
          <View style={styles.postHeader}>
            <TouchableOpacity
              onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
            >
              <Image
                source={{ uri: item.profilePic || 'https://yourapp.com/default-profile.png' }}
                style={styles.profileImage}
              />
              <Text style={styles.username}>@{item.username}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => unsavePost(item.id)}>
              <Icon name="trash-2" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.postTitle}>{item.title}</Text>
          <Text style={styles.postContent}>{item.content}</Text>
  
          {item.mediaUrls?.length > 0 && (
            <>
              <FlatList
                data={item.mediaUrls}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(url, index) => `${item.id}-${index}`}
                renderItem={({ item: url, index }) =>
                  isVideo(url) ? (
                    <Video
                      source={{ uri: url }}
                      style={{
                        width: containerWidth - 40,
                        height: (containerWidth - 40) * 0.5625, // Maintain 16:9 aspect ratio
                        borderRadius: 8,
                        marginRight: 10,
                      }}
                      resizeMode="cover"
                      paused={currentMediaIndex !== index} // Pause videos not in view
                      controls
                    />
                  ) : (
                    <Image
                      source={{ uri: url }}
                      style={{
                        width: containerWidth,
                        height: containerWidth * 0.5625, // Maintain 16:9 aspect ratio
                        borderRadius: 8,
                        marginRight: 10,
                      }}
                      resizeMode="cover"
                    />
                  )
                }
                onViewableItemsChanged={onViewableItemsChanged.current}
                viewabilityConfig={viewConfigRef.current}
              />
  
              <View style={styles.paginationContainer}>
                {item.mediaUrls.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      { backgroundColor: index === currentMediaIndex ? 'white' : '#555' },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
  
          <Text style={styles.postTimestamp}>
            {item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading saved posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {savedPosts.length > 0 ? (
        <FlatList
          data={savedPosts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <Text style={styles.emptyText}>No saved posts yet.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 8,
  },
  listContainer: {
    paddingBottom: 100,
  },
  postContainer: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
  },
  postTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  postContent: {
    color: 'white',
    marginBottom: 8,
  },
  postTimestamp: {
    color: '#888',
    fontSize: 12,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  emptyText: {
    color: 'white',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default SavedPostsScreen;
import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, Image, StyleSheet, Dimensions } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Video from 'react-native-video';

interface Post {
  id: string;
  mediaType: string;
  mediaUrl: string;
  caption?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  fileSize?: number; // optional size in bytes
}

const { width } = Dimensions.get('window');

const PostList = () => {
  const currentUser = auth().currentUser;
  const [posts, setPosts] = useState<Post[]>([]);
  const [lastPost, setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMorePosts, setNoMorePosts] = useState(false);

  const fetchPosts = useCallback(async (loadMore = false) => {
    if (!currentUser || loadingMore || (loadMore && noMorePosts)) return;

    loadMore ? setLoadingMore(true) : setLoading(true);

    try {
      let query = firestore()
        .collection('posts')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(10);

      if (loadMore && lastPost) {
        query = query.startAfter(lastPost);
      }

      const snapshot = await query.get();

      if (!snapshot.empty) {
        const newPosts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() })) as Post[];

        setPosts(prev => [...prev, ...newPosts]);
        setLastPost(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setNoMorePosts(true);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      loadMore ? setLoadingMore(false) : setLoading(false);
    }
  }, [currentUser, lastPost, loadingMore, noMorePosts]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const renderPost = ({ item }: { item: Post }) => {
    const isVideoTooLarge = item.mediaType === 'video' && item.fileSize && item.fileSize > 100 * 1024 * 1024; // 100MB

    return (
      <View style={styles.card}>
        {item.mediaType === 'image' && (
          <Image source={{ uri: item.mediaUrl }} style={styles.media} />
        )}

        {item.mediaType === 'video' && !isVideoTooLarge && (
          <Video
            source={{ uri: item.mediaUrl }}
            style={styles.media}
            controls
            paused
            resizeMode="cover"
          />
        )}

        {item.mediaType === 'video' && isVideoTooLarge && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>This video is too large to preview (over 100MB).</Text>
          </View>
        )}

        <Text style={styles.caption}>{item.caption}</Text>
      </View>
    );
  };

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      renderItem={renderPost}
      onEndReached={() => fetchPosts(true)}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  card: {
    marginBottom: 16,
    paddingHorizontal: 10
  },
  media: {
    width: width - 20,
    height: 250,
    borderRadius: 10,
    backgroundColor: '#000'
  },
  caption: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500'
  },
  errorContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 10
  },
  errorText: {
    color: 'red',
    fontWeight: 'bold',
    padding: 10,
    textAlign: 'center'
  }
});

export default PostList;
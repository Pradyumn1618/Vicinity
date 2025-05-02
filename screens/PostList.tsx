import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, Image, StyleSheet, Dimensions } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Video from 'react-native-video';
import { Post } from '../helper/types';



interface PostListProps {
  initialPosts: Post[],
  lastP: FirebaseFirestoreTypes.DocumentSnapshot,
}

const { width } = Dimensions.get('window');

const PostList = ( {initialPosts,lastP} : PostListProps) => {
  const currentUser = auth().currentUser;
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [lastPost, setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(lastP);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMorePosts, setNoMorePosts] = useState(initialPosts.length < 10);

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
        query = firestore()
        .collection('posts')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc').startAfter(lastPost)
        .limit(10);
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
    if(initialPosts.length == 0){

    }
  }, [fetchPosts]);

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const renderPost = ({ item }: { item: Post }) => {
  const mediaUrl = item.mediaUrls[0];

  const isVideo = mediaUrl?.match(/\.(mp4|mov|avi|mkv)$/i);
  const isImage = mediaUrl?.match(/\.(jpg|jpeg|png|webp)$/i);

  return (
    <View style={styles.card}>
      {isImage && (
        <Image source={{ uri: mediaUrl }} style={styles.media} />
      )}

      {isVideo && (
        <Video
          source={{ uri: mediaUrl }}
          style={styles.media}
          controls
          paused
          resizeMode="cover"
        />
      )}

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content}>{item.content}</Text>
      <Text style={styles.caption}>
        Likes: {item.likeCount} | Comments: {item.commentCount}
      </Text>
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
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  content: {
    marginTop: 4,
    fontSize: 15,
  }

});

export default PostList;
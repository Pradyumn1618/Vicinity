import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, Image, StyleSheet, Dimensions, TouchableOpacity, TouchableWithoutFeedback, Alert } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Video from 'react-native-video';
import { Post, rootStackParamList } from '../helper/types';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';



interface PostListProps {
  initialPosts: Post[],
  lastP: FirebaseFirestoreTypes.DocumentSnapshot,
  userId: string;
  isMine?: boolean;
}

const { width } = Dimensions.get('window');

const PostList = ( {initialPosts,lastP, userId,isMine = false} : PostListProps) => {
  // const currentUser = auth().currentUser;
  const navigation = useNavigation<NavigationProp<rootStackParamList>>();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [lastPost, setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(lastP);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMorePosts, setNoMorePosts] = useState(initialPosts.length < 10);

  const fetchPosts = useCallback(async (loadMore = false) => {
    if (!userId || loadingMore || (loadMore && noMorePosts)) return;

    loadMore ? setLoadingMore(true) : setLoading(true);

    try {
      let query = firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10);

      if (loadMore && lastPost) {
        query = firestore()
        .collection('posts')
        .where('userId', '==', userId)
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
  }, [userId, lastPost, loadingMore, noMorePosts]);

  useEffect(() => {
    console.log('posts:', posts);
  }, [posts]);

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const checkVideo = (url) => {
    try {
        const decoded = decodeURIComponent(url);
        return /\.(m3u8|mp4|mov|webm|avi|mkv)$/i.test(decoded.split('?')[0]);
    } catch {
        return false;
    }
};

  const renderPost = ({ item }: { item: Post }) => {
  const mediaUrl = item.mediaUrls[0];
  const isVideo = checkVideo(mediaUrl);
  const isImage = !isVideo && mediaUrl;
  

  return (
    <TouchableWithoutFeedback onPress={() => navigation.navigate('Post', { postId: item.id })}>
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

      {isMine && (
        <TouchableOpacity
          style={{ marginTop: 8, alignSelf: 'flex-end' }}
          onPress={async () => {
            try {
              Alert.alert(
                'Delete Post',
                'Are you sure you want to delete this post?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'OK', onPress: async () => {
                      try {
                        await firestore().collection('posts').doc(item.id).delete();
                        setPosts(prev => prev.filter(post => post.id !== item.id));
                      } catch (error) {
                        console.error('Error deleting post:', error);
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error deleting post:', error);
            }
          }}
        >
          <Icon source="delete" size={20} color="white" />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content}>{item.content}</Text>
      <Text style={styles.caption}>
        Likes: {item.likeCount} | Comments: {item.commentCount}
      </Text>
    </View>
    </TouchableWithoutFeedback>
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
    width: 'auto',
    height: 250,
    borderRadius: 10,
    backgroundColor: '#000'
  },
  caption: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
    color: 'white'
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
    color: 'white'
  },
  content: {
    marginTop: 4,
    fontSize: 15,
    color: 'white'
  }

});

export default PostList;
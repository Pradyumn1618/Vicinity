import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { requestLocationPermission, startLocationTracking } from '../helper/locationPermission';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import NavigationBar from '../components/NavigationBar';
import mmkv from '../storage';
import { Post } from '../helper/types';
import Icon from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

interface PostScreenProps {
  navigation: NavigationProp<any>;
}

const PostScreen = ({ navigation }: PostScreenProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [comments, setComments] = useState<any[]>([]); // Store comments separately
  const [user, setUser] = useState<any>(null);
  const [commentLikes, setCommentLikes] = useState<{ [commentId: string]: { liked: boolean, likeCount: number } }>({});

  useEffect(() => {
    const fetchUser = () => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        setUser(currentUser);
      }
    };

    fetchUser();

    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission && Platform.OS === 'android') {
        try {
          await promptForEnableLocationIfNeeded();
          startLocationTracking(user?.uid);
        } catch (error: unknown) {
          if (error instanceof Error) console.error(error.message);
        }
      } else if (!hasPermission) {
        Alert.alert(
          'Permission Required for Best Experience',
          'Enable location in Settings > Apps > Vicinity > Permissions'
        );
      }
    };

    if (user) {
      checkPermission();
    }
  }, [user]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const geohash5 = mmkv.getString('geohash')?.substring(0, 5);
      if (!geohash5) throw new Error('Missing geohash');

      const querySnapshot = await firestore()
        .collection('posts')
        .where('geohash5', '==', geohash5)
        .get();

      const fetchedPosts: Post[] = querySnapshot.docs.map(doc => ({
        ...(doc.data() as Post),
        id: doc.id,
      }));
      setPosts(fetchedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      Alert.alert('Error', 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Update like status in Firestore for a comment
  const likeComment = async (postId: string, commentId: string, liked: boolean) => {
    try {
      const postRef = firestore().collection('posts').doc(postId);
      const postDoc = await postRef.get();
      
      if (postDoc.exists) {
        const postData = postDoc.data();
        const updatedComments = postData?.comments.map((comment: any) => {
          if (comment.id === commentId) {
            return {
              ...comment,
              likeCount: liked
                ? comment.likeCount + 1
                : comment.likeCount - 1,
            };
          }
          return comment;
        });

        // Update Firestore with the new like count
        await postRef.update({
          comments: updatedComments,
        });
      }
    } catch (error) {
      console.error('Error updating comment like:', error);
    }
  };

  const toggleLike = (postId: string, commentId: string) => {
    setCommentLikes(prev => {
      const currentLikes = prev[commentId] || { liked: false, likeCount: 0 };
      const updatedLikes = currentLikes.liked
        ? { liked: false, likeCount: currentLikes.likeCount - 1 }
        : { liked: true, likeCount: currentLikes.likeCount + 1 };

      // Update Firestore immediately when a like is toggled
      likeComment(postId, commentId, updatedLikes.liked);

      return {
        ...prev,
        [commentId]: updatedLikes,
      };
    });
  };

  const openComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  const postComment = async () => {
    if (!selectedPostId || !newComment[selectedPostId]) return;

    try {
      const comment = {
        userId: user?.uid,
        username: user?.displayName || 'Anonymous',
        text: newComment[selectedPostId],
        likeCount: 0, // Initial like count
        id: new Date().toISOString(), // Generate unique ID for the comment
      };

      // Get the current post reference
      const postRef = firestore().collection('posts').doc(selectedPostId);
      const postDoc = await postRef.get();

      if (postDoc.exists) {
        const currentComments = postDoc.data()?.comments || [];

        // Add the new comment to the current list of comments
        const updatedComments = [...currentComments, comment];

        // Update the post with the new comment array and set the timestamp for the post itself
        await postRef.update({
          comments: updatedComments,
          lastCommentTimestamp: firestore.FieldValue.serverTimestamp(),
        });

        // Clear the comment input after posting
        setNewComment((prev) => ({ ...prev, [selectedPostId]: '' }));
        setCommentModalVisible(false);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  // Fetch comments and likes when modal is opened
  useEffect(() => {
    if (selectedPostId) {
      const fetchPostComments = async () => {
        try {
          const postRef = firestore().collection('posts').doc(selectedPostId);
          const postDoc = await postRef.get();

          if (postDoc.exists) {
            const postData = postDoc.data();
            setComments(postData?.comments || []);
            const initialLikes = postData?.comments.reduce((acc: any, comment: any) => {
              acc[comment.id] = { liked: false, likeCount: comment.likeCount || 0 };
              return acc;
            }, {});
            setCommentLikes(initialLikes);
          }
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      };

      fetchPostComments();
    }
  }, [selectedPostId]);

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
      <Text className="text-zinc-400 text-sm mb-2">
        {item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
      </Text>
      <View className="flex-row justify-between items-center px-1">
        <TouchableOpacity onPress={() => toggleLike(item.id, item.id)}>
          <FontAwesome
            name={likedPosts[item.id] ? 'heart' : 'heart-o'}
            size={20}
            color={likedPosts[item.id] ? 'red' : 'white'}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openComments(item.id)}>
          <Icon name="message-circle" size={20} color="white" />
        </TouchableOpacity>
      </View>
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
          refreshing={loading}
          onRefresh={fetchPosts}
        />
      )}

      <NavigationBar navigation={navigation} />

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white p-4 rounded-t-2xl max-h-[80%]">
            <ScrollView>
              {comments.map((comment, index) => (
                <View key={index} className="border-b border-gray-300 py-2">
                  <Text className="text-black font-semibold">{comment.username}</Text>
                  <Text className="text-gray-800">{comment.text}</Text>
                  <View className="flex-row items-center mt-1">
                    <TouchableOpacity onPress={() => toggleLike(selectedPostId!, comment.id)}>
                      <FontAwesome
                        name={commentLikes[comment.id]?.liked ? 'heart' : 'heart-o'}
                        size={16}
                        color={commentLikes[comment.id]?.liked ? 'red' : 'black'}
                      />
                    </TouchableOpacity>
                    <Text className="ml-2 text-gray-600">{commentLikes[comment.id]?.likeCount ?? 0}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TextInput
              placeholder="Add a comment..."
              className="border border-gray-400 rounded px-2 py-1 mt-2 text-black"
              value={newComment[selectedPostId || ''] || ''}
              onChangeText={(text) => setNewComment((prev) => ({ ...prev, [selectedPostId || '']: text }))}
            />
            <TouchableOpacity
              onPress={postComment}
              className="bg-blue-500 p-2 rounded mt-2"
            >
              <Text className="text-white text-center">Post Comment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
export default PostScreen;    
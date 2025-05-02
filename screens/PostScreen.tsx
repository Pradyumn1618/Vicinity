import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  TouchableWithoutFeedback,
  StyleSheet,
  Share,
  ToastAndroid,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore, { addDoc, collection, serverTimestamp, getFirestore, getDocs, query, orderBy, doc, setDoc, updateDoc, increment, deleteDoc, getDoc, limit, startAfter } from '@react-native-firebase/firestore';
import { requestLocationPermission, requestNotificationPermission, startLocationTracking } from '../helper/locationPermission';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import NavigationBar from '../components/NavigationBar';
import mmkv from '../storage';
import { Post } from '../helper/types';
import Icon from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Video from 'react-native-video';
import { EmptyComments, FooterLoader } from '../components/commentsEnd';
import { useUser } from '../context/userContext';
import Icon1 from 'react-native-vector-icons/MaterialCommunityIcons';
import GradientText from '../components/animatedText';
import { refreshFcmToken } from '../helper/locationPermission';
import { Menu, Provider } from "react-native-paper";


interface PostScreenProps {
  navigation: NavigationProp<any>;
}

const db = getFirestore();

const PostScreen = ({ navigation }: PostScreenProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [commentCounts, setCommentCounts] = useState({});
  const [comments, setComments] = useState<any[]>([]); // Store comments separately
  // const [user, setUser] = useState<any>(null);
  const [commentLikes, setCommentLikes] = useState<{ [commentId: string]: { liked: boolean, likeCount: number } }>({});
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
      refreshFcmToken();

    }
  }, [user]);

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

  useEffect(() => {

    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission && Platform.OS === 'android') {
        try {
          await promptForEnableLocationIfNeeded();
          startLocationTracking(user?.id);
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
      const sortedPost = fetchedPosts.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      }
      );
      setPosts((prevPosts) => {
        const mergedPosts = [...prevPosts];
        sortedPost.forEach((newPost) => {
          const index = mergedPosts.findIndex((post) => post.id === newPost.id);
          if (index !== -1) {
            mergedPosts[index] = newPost; // Replace existing post with the same id
          } else {
            mergedPosts.push(newPost); // Add new post if id doesn't exist
          }
        });
        return mergedPosts;
      });
      mmkv.set('posts', JSON.stringify(sortedPost));
      setCommentCounts(fetchedPosts.reduce((acc, post) => {
        acc[post.id] = post.commentCount || 0;
        return acc;
      }, {}));
    } catch (err) {
      console.error('Error fetching posts:', err);
      Alert.alert('Error', 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  };

  const loadCachedPosts = () => {
    const cachedPosts = mmkv.getString('posts');
    if (cachedPosts) {
      const parsedPosts = JSON.parse(cachedPosts);
      setPosts(parsedPosts);
      setCommentCounts(parsedPosts.reduce((acc, post) => {
        acc[post.id] = post.commentCount || 0;
        return acc;
      }, {}));
    }
  };

  useEffect(() => {
    loadCachedPosts();
    fetchPosts();
  }, []);

  // Update like status in Firestore for a comment
  const likeComment = async (postId, commentId, liked) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', user.id);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);

      if (liked) {
        await setDoc(likeRef, { likedAt: Date.now() }); // or serverTimestamp()
        await updateDoc(commentRef, { likeCount: increment(1) });
      } else {
        await deleteDoc(likeRef);
        await updateDoc(commentRef, { likeCount: increment(-1) });
      }

      // setCommentLikes((prev) => ({
      //   ...prev,
      //   [commentId]: {
      //     liked,
      //     likeCount: prev[commentId]?.likeCount ?? 0 + (liked ? 1 : -1),
      //   },
      // }));
    } catch (err) {
      console.error('Error updating like status:', err);
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
    console.log('Opening comments for post:', postId);
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  const postComment = async () => {
    if (!selectedPostId || !newComment[selectedPostId]) return;

    try {
      const comment = {
        userId: user?.id,
        username: user?.username || 'Anonymous',
        text: newComment[selectedPostId],
        likeCount: 0,
        timestamp: serverTimestamp(),
      };

      // Reference to the subcollection: posts/{postId}/comments
      const commentRef = collection(db, 'posts', selectedPostId, 'comments');
      const postRef = doc(db, 'posts', selectedPostId);
      setDoc(postRef, { commentCount: increment(1) }, { merge: true });
      await addDoc(commentRef, comment);


      // Clear input and close modal
      setNewComment((prev) => ({ ...prev, [selectedPostId]: '' }));
      setComments((prev) => [
        ...prev,
        { ...comment, id: commentRef.id },
      ]);
      setCommentCounts((prev) => ({
        ...prev,
        [selectedPostId]: (prev[selectedPostId] || 0) + 1,
      }));
      // setCommentModalVisible(false);
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const [lastVisible, setLastVisible] = useState(null); // To store the last visible comment for pagination
  const [loadingMore, setLoadingMore] = useState(false); // To manage loading state for pagination
  const [hasMoreComments, setHasMoreComments] = useState(true); // To manage if there are more comments to load
  // Fetch comments and likes when modal is opened



  useEffect(() => {
    if (!selectedPostId || !user) return;

    // Reset state before new fetch
    setComments([]);
    setCommentLikes({});

    const fetchPostComments = async () => {
      setLoadingMore(true);
      console.log('Fetching comments for post:', selectedPostId);

      try {
        const commentsRef = collection(db, 'posts', selectedPostId, 'comments');
        let q = query(commentsRef, orderBy('timestamp', 'desc'), limit(20));

        const snapshot = await getDocs(q);

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (snapshot.empty || snapshot.docs.length < 20) {
          setHasMoreComments(false);
        }

        if (lastDoc) {
          setLastVisible(lastDoc);
        }

        const results = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const commentId = docSnap.id;
            if (typeof data === 'object' && data !== null) {
              const likeRef = doc(db, 'posts', selectedPostId, 'comments', commentId, 'likes', user.id);
              const likeDoc = await getDoc(likeRef);
              const liked = likeDoc.exists;

              return {
                comment: { ...data, id: commentId },
                likeInfo: {
                  [commentId]: {
                    liked: liked,
                    likeCount: data.likeCount || 0,
                  },
                },
              };
            } else {
              console.error('Invalid comment data:', data);
              return null;
            }
          })
        );

        const filtered = results.filter(Boolean); // Remove nulls
        const commentsList = filtered.map((r) => r.comment);
        const initialLikes = Object.assign({}, ...filtered.map((r) => r.likeInfo));

        setComments((prev) => [...prev, ...commentsList]);
        setCommentLikes((prev) => ({ ...prev, ...initialLikes }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoadingMore(false);
      }
    };
    fetchPostComments();

  }, [selectedPostId, user]);

  const fetchPostComments = async (startAfterDoc = null) => {
    setLoadingMore(true);

    try {
      const commentsRef = collection(db, 'posts', selectedPostId, 'comments');
      let q = query(commentsRef, orderBy('timestamp', 'desc'), limit(20));

      if (startAfterDoc) {
        q = query(commentsRef, orderBy('timestamp', 'desc'), startAfter(startAfterDoc), limit(20));
      }

      const snapshot = await getDocs(q);

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.empty || snapshot.docs.length < 20) {
        setHasMoreComments(false);
      }

      if (lastDoc) {
        setLastVisible(lastDoc);
      }

      const results = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const commentId = docSnap.id;

          if (typeof data === 'object' && data !== null) {
            const likeRef = doc(db, 'posts', selectedPostId, 'comments', commentId, 'likes', user.id);
            const likeDoc = await getDoc(likeRef);
            const liked = likeDoc.exists;

            return {
              comment: { ...data, id: commentId },
              likeInfo: {
                [commentId]: {
                  liked,
                  likeCount: data.likeCount || 0,
                },
              },
            };
          } else {
            console.error('Invalid comment data:', data);
            return null;
          }
        })
      );

      const filtered = results.filter(Boolean); // remove nulls
      const commentsList = filtered.map((r) => r.comment);
      const initialLikes = Object.assign({}, ...filtered.map((r) => r.likeInfo));

      setComments((prev) => [...prev, ...commentsList]);
      setCommentLikes((prev) => ({ ...prev, ...initialLikes }));

    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingMore(false);
    }
  };
  const handleEndReached = () => {
    if (hasMoreComments && !loadingMore) {
      fetchPostComments(lastVisible);
    }
  };


  const screenWidth = Dimensions.get('window').width;


  const isVideo = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      return /\.(m3u8|mp4|mov|webm|avi|mkv)$/i.test(decoded.split('?')[0]);
    } catch {
      return false;
    }
  };

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) {
      setCurrentMediaIndex(viewableItems[0].index);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const savePost = async (post: Post) => {
    try {
      const savedPostsRef = doc(db, 'users', user?.id, 'savedPosts', post.id);
      await setDoc(savedPostsRef, { id: post.id });
      ToastAndroid.show('Post saved successfully!', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error saving post:', error);
      Alert.alert('Error', 'Failed to save post.');
    }
  };

  const sharePost = async (post) => {
    // Prepare your share message, including title, content, and media URLs
    const { title, content, mediaUrls, username } = post;
    
    // Create a message to share, including the text and media links
    let shareMessage = `Check out this post by ${username}:\n\n`;
    shareMessage += `Title: ${title}\n\n`;
    shareMessage += `Content: ${content}\n\n`;
    
    // Add media URLs (if any)
    // if (mediaUrls?.length > 0) {
    //   shareMessage += '\nMedia: \n';
    //   mediaUrls.forEach((url) => {
    //     shareMessage += `${url}\n`; // Include each media URL
    //   });
    // }
    shareMessage += 'https://vicinity-deep-linking.vercel.app/post/' + post.id; // Add your app link here
  
    try {
      await Share.share({
        message: shareMessage,  // This will include the entire post content
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };
  

  const renderItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
    onPress={() => {
      navigation.navigate('Post', { postId: item.id });
    }
    }
    >
    <View className="bg-zinc-800 py-4 px-1 mb-6 rounded-lg">
      <View className="flex-row justify-between items-start mb-2 px-1">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
        >
          <Image
            source={{ uri: item.profilePic || 'https://yourapp.com/default-profile.png' }}
            className="w-8 h-8 rounded-full mr-2"
          />
          <Text className="text-white text-base font-medium">@{item.username}</Text>
        </TouchableOpacity>

        <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>


        <Menu
          visible={menuVisible === item.id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <TouchableOpacity onPress={() => setMenuVisible(item.id)}>
              <Icon name="more-vertical" size={20} color="white" />
            </TouchableOpacity>
          }
        >
          <Menu.Item
            onPress={async () => {
              await sharePost(item);
              setMenuVisible(null);
            }}
            title="Share"
          />
          <Menu.Item
            onPress={async () => {
              await savePost(item); // you define this
              setMenuVisible(null);
            }}
            title="Save Post"
          />
        </Menu>
        </View>
      </View>
      <Text className="text-white text-lg font-semibold mb-1">{item.title}</Text>

      <Text className="text-white mb-2">{item.content}</Text>

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
                    width: screenWidth - 50,
                    height: 250,
                    borderRadius: 8,
                    marginRight: 10,
                  }}
                  resizeMode="cover"
                  paused={currentMediaIndex !== index}
                  controls
                />
              ) : (
                <Image
                  source={{ uri: url }}
                  style={{
                    width: screenWidth - 32,
                    height: 250,
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

          <View className="flex-row justify-center mt-2">
            {item.mediaUrls.map((_, index) => (
              <View
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: index === currentMediaIndex ? 'white' : '#555',
                  marginHorizontal: 4,
                }}
              />
            ))}
          </View>
        </>
      )}

      <Text className="text-zinc-400 text-sm mt-2">
        {item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
      </Text>

      <View className="flex-row justify-between items-center px-1 mt-2">
        <TouchableOpacity onPress={() => toggleLike(item.id, item.id)}>
          <FontAwesome
            name={likedPosts[item.id] ? 'heart' : 'heart-o'}
            size={20}
            color={likedPosts[item.id] ? 'red' : 'white'}
          />
        </TouchableOpacity>
        <View className="flex-row items-center space-x-2 mt-1">
          <TouchableOpacity onPress={() => openComments(item.id)}>
            <Icon name="message-circle" size={18} color="white" />
          </TouchableOpacity>
          {commentCounts[item.id] > 0 && (
            <Text className="text-white text-m">
              {commentCounts[item.id]}
            </Text>
          )}
        </View>

      </View>
    </View>
    </TouchableOpacity>
  );
  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-800">
        <View className="flex-1">
          <GradientText />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Inbox')} className="items-center">
          {/* <Icon name="chatbubble-ellipses-outline" size={24} color="white" /> */}
          <Icon1 name="chat" size={24} color="white" />

          {/* <Text className="text-white text-xs mt-1">Chat</Text> */}
        </TouchableOpacity>
      </View>

      <View className="flex-1 bg-zinc-900">
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="text-white mt-2">Loading posts...</Text>
          </View>
        ) : (
          <>
            <FlatList
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListEmptyComponent={
                <Text className="text-white text-center mt-10">No posts available in your area.</Text>
              }
              refreshing={loading}
              onRefresh={fetchPosts}
            />
          </>
        )}


        {/* Comments Modal */}
        <Modal
          visible={commentModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => { setCommentModalVisible(false); setComments([]); setCommentLikes({}); setSelectedPostId(null); }}
        >
          <TouchableWithoutFeedback onPress={() => { setCommentModalVisible(false); setComments([]); setCommentLikes({}); setSelectedPostId(null); }}>
            <View className="flex-1 justify-end">
              <BlurView
                style={StyleSheet.absoluteFillObject}
                blurType="dark"
                blurAmount={10}
                reducedTransparencyFallbackColor="rgba(0,0,0,0.5)"
              />

              <TouchableWithoutFeedback onPress={() => { }}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  className="bg-zinc-900 p-4 rounded-t-2xl max-h-[75%]"
                  style={{ width: '100%' }}
                >
                  <FlatList
                    data={comments}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => {
                      return (
                        <View className="border-b border-zinc-700 py-2">
                          <Text className="text-white font-semibold">{item.username}</Text>
                          <Text className="text-zinc-300">{item.text}</Text>
                          <View className="flex-row items-center mt-1">
                            <TouchableOpacity onPress={() => toggleLike(selectedPostId!, item.id)}>
                              <FontAwesome
                                name={commentLikes[item.id]?.liked ? 'heart' : 'heart-o'}
                                size={16}
                                color={commentLikes[item.id]?.liked ? 'red' : 'white'}
                              />
                            </TouchableOpacity>
                            <Text className="ml-2 text-zinc-400">
                              {commentLikes[item.id]?.likeCount ?? 0}
                            </Text>
                          </View>
                        </View>
                      );
                    }}
                    ListEmptyComponent={EmptyComments}
                    ListFooterComponent={<FooterLoader loading={loadingMore} />}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    keyboardShouldPersistTaps="handled"
                  />
                  <TextInput
                    placeholder="Add a comment..."
                    placeholderTextColor="#aaa"
                    className="border border-zinc-600 rounded px-2 py-1 mt-2 text-white"
                    value={newComment[selectedPostId || ''] || ''}
                    onChangeText={(text) =>
                      setNewComment((prev) => ({ ...prev, [selectedPostId || '']: text }))
                    }
                  />
                  <TouchableOpacity
                    onPress={postComment}
                    className="bg-blue-500 p-2 rounded mt-2"
                  >
                    <Text className="text-white text-center">Post Comment</Text>
                  </TouchableOpacity>
                </KeyboardAvoidingView>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        <NavigationBar navigation={navigation} />

      </View>
    </View>
  );
};
export default PostScreen;

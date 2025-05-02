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
import { useIsFocused } from '@react-navigation/native';
import Modal from 'react-native-modal';import { useChatContext } from '../context/chatContext';


interface PostScreenProps {
  navigation: NavigationProp<any>;
}

const DistanceFilterDropdown = ({ navigation, distanceFilter, setDistanceFilter }) => {
  const [isModalVisible, setModalVisible] = useState(false);

  const handleOptionSelect = (distance) => {
    setDistanceFilter(distance);
    setModalVisible(false);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.inboxButton}
      >
        <Icon1 name="dots-vertical" size={24} color="#F4F5F7" />
      </TouchableOpacity>

      <Modal
        isVisible={isModalVisible}
        onBackdropPress={() => setModalVisible(false)}
        style={styles.modal}
        animationIn="slideInDown"
        animationOut="slideOutUp"
      >
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.option}
            onPress={() => handleOptionSelect('nearby')}
          >
            <Text style={styles.optionText}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => handleOptionSelect('far')}
          >
            <Text style={styles.optionText}>Far</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => handleOptionSelect('farther')}
          >
            <Text style={styles.optionText}>Farther</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const db = getFirestore();
const screenWidth = Dimensions.get('window').width;

const PostScreen = ({ navigation }: PostScreenProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [commentCounts, setCommentCounts] = useState({});
  const [comments, setComments] = useState<any[]>([]);
  const [commentLikes, setCommentLikes] = useState<{ [commentId: string]: { liked: boolean, likeCount: number } }>({});
  const { user } = useUser();
  const [isSwiping, setIsSwiping] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [replies, setReplies] = useState<{ [commentId: string]: any[] }>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [commentId: string]: string }>({});
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<{ [postId: string]: { liked: boolean, likeCount: number } }>({});
  const [distanceFilter, setDistanceFilter] = useState<'nearby' | 'far' | 'farther'>('nearby');

  const isFocused = useIsFocused();  const {unreadChats} = useChatContext();


  useEffect(() => {
    if (user) {
      requestNotificationPermission();
      refreshFcmToken();
    }
  }, [user]);

  const checkAuthentication = React.useCallback(() => {
    if (!mmkv.getString('user')) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [navigation]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

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
          console.log('Location enabled');
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

  const waitForGeohash = async (timeout = 10000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const geo = mmkv.getString('geohash');
        if (geo) {
          clearInterval(interval);
          resolve(geo);
        }
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for geohash'));
        }
      }, 200);
    });
  };


  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const geo = await waitForGeohash() as string;
      let geohash = geo?.substring(0, 4);
      switch (distanceFilter) {
        case 'far':
          geohash = geo?.substring(0,5);
          break;
        case 'farther':
          geohash = geo?.substring(0,4);
          break;
        default:
          geohash = geo?.substring(0,6);
      }
      
      if (!geohash) return;

      let querySnapshot = await firestore()
        .collection('posts')
        .where('geohash6', '==', geohash)
        .get();

      switch (distanceFilter){
        case 'far':
          querySnapshot = await firestore()
          .collection('posts')
          .where('geohash5', '==', geohash)
          .get();
          break;
        case 'farther':
          querySnapshot = await firestore()
          .collection('posts')
          .where('geohash4', '==', geohash)
          .get();
          break;
        default :
          querySnapshot = await firestore()
          .collection('posts')
          .where('geohash6', '==', geohash)
          .get();
      }

      const fetchedPosts: Post[] = querySnapshot.docs.map(doc => ({
        ...(doc.data() as Post),
        id: doc.id,
      }));
      const sortedPost = fetchedPosts.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      setPosts((prevPosts) => {
        const mergedPosts = [...prevPosts];
        sortedPost.forEach((newPost) => {
          const index = mergedPosts.findIndex((post) => post.id === newPost.id);
          if (index !== -1) {
            mergedPosts[index] = newPost;
          } else {
            mergedPosts.push(newPost);
          }
        });
        return mergedPosts;
      });
      mmkv.set('posts', JSON.stringify(sortedPost));
      setCommentCounts(fetchedPosts.reduce((acc, post) => {
        acc[post.id] = post.commentCount || 0;
        return acc;
      }, {}));

      const likedP = await Promise.all(
        sortedPost.map(async (post) => {
          const likeRef = doc(db, 'posts', post.id, 'likes', user?.id);
          const likeDoc = await getDoc(likeRef);
          return {
            [post.id]: {liked:likeDoc.exists,likeCount: post.likeCount || 0}
          };
        })
      );
      console.log(likedP);
      setLikeCounts(Object.assign({}, ...likedP));
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }, [user, distanceFilter]);

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
    if (!user) return;
    loadCachedPosts();
    fetchPosts();
  }, [user, fetchPosts]);

  const likeComment = async (postId: string, commentId: string, liked: boolean) => {
    try {
      const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', user.id);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);

      if (liked) {
        await setDoc(likeRef, { likedAt: serverTimestamp() });
        await updateDoc(commentRef, { likeCount: increment(1) });
      } else {
        await deleteDoc(likeRef);
        await updateDoc(commentRef, { likeCount: increment(-1) });
      }
    } catch (err) {
      console.error('Error updating like status:', err);
    }
  };

  const toggleLike = async (postId: string) => {
    try{
    const liked = likeCounts[postId].liked;
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: { liked: !liked, likeCount: (prev[postId]?.likeCount || 0) + (liked ? -1 : 1) },
    }));
      const postRef = doc(db, 'posts', postId);
    if (liked) {
      await updateDoc(postRef, { likeCount: increment(-1) });
      const likeRef = doc(db,'posts',postId,'likes',user.id);
      await deleteDoc(likeRef);
      
    } else {
      await updateDoc(postRef, { likeCount: increment(1) });
      const likeRef = doc(db,'posts',postId,'likes',user.id);
      await setDoc(likeRef,{id:user.id});
    }
    setPosts((prevPosts) =>
      prevPosts.map((post) => (post.id === postId ? { ...post, likeCount: post.likeCount + (liked ? -1 : 1) } : post))
    );
  }catch(error){
    console.log(error);
  }
    
  };

  const openComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

  const postComment = async () => {
    if (!selectedPostId || !newComment[selectedPostId]?.trim()) return;

    try {
      const comment = {
        userId: user?.id,
        username: user?.username || 'Anonymous',
        text: newComment[selectedPostId],
        likeCount: 0,
        timestamp: serverTimestamp(),
      };

      const commentRef = collection(db, 'posts', selectedPostId, 'comments');
      const postRef = doc(db, 'posts', selectedPostId);
      const docRef = await addDoc(commentRef, comment);
      await updateDoc(postRef, { commentCount: increment(1) });

      setComments((prev) => [
        { ...comment, id: docRef.id },
        ...prev,
      ]);
      setCommentCounts((prev) => ({
        ...prev,
        [selectedPostId]: (prev[selectedPostId] || 0) + 1,
      }));
      setCommentLikes((prev) => ({
        ...prev,
        [docRef.id]: { liked: false, likeCount: 0 },
      }));
      setNewComment((prev) => ({ ...prev, [selectedPostId]: '' }));
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const fetchReplies = async (commentId: string) => {
    try {
      const repliesRef = collection(db, 'posts', selectedPostId, 'comments', commentId, 'replies');
      const q = query(repliesRef, orderBy('timestamp', 'desc'));
      const replySnap = await getDocs(q);
      const repliesData = replySnap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setReplies(prev => ({
        ...prev,
        [commentId]: repliesData,
      }));
    } catch (err) {
      console.error('Error fetching replies:', err);
    }
  };

  const addReply = async (commentId: string) => {
    if (!replyText[commentId]?.trim()) return;
    try {
      const repliesRef = collection(db, 'posts', selectedPostId, 'comments', commentId, 'replies');
      const replyData = {
        userId: user?.id,
        username: user?.username || 'Anonymous',
        text: replyText[commentId],
        timestamp: serverTimestamp(),
      };
      const docRef = await addDoc(repliesRef, replyData);
      setReplies(prev => ({
        ...prev,
        [commentId]: [{ id: docRef.id, ...replyData }, ...(prev[commentId] || [])],
      }));
      setReplyText(prev => ({ ...prev, [commentId]: '' }));
      setReplyTo(null);
    } catch (err) {
      console.error('Error adding reply:', err);
    }
  };

  useEffect(() => {
    if (!selectedPostId || !user) return;

    setComments([]);
    setCommentLikes({});
    setReplies({});

    const fetchPostComments = async () => {
      setLoadingMore(true);
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
              return {
                comment: { ...data, id: commentId },
                likeInfo: {
                  [commentId]: {
                    liked: likeDoc.exists,
                    likeCount: data.likeCount || 0,
                  },
                },
              };
            }
            return null;
          })
        );

        const filtered = results.filter(Boolean);
        const commentsList = filtered.map((r) => r.comment);
        const initialLikes = Object.assign({}, ...filtered.map((r) => r.likeInfo));

        setComments(commentsList);
        setCommentLikes(initialLikes);
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
            return {
              comment: { ...data, id: commentId },
              likeInfo: {
                [commentId]: {
                  liked: likeDoc.exists,
                  likeCount: data.likeCount || 0,
                },
              },
            };
          }
          return null;
        })
      );

      const filtered = results.filter(Boolean);
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
    const { title, content, username } = post;
    let shareMessage = `Check out this post by ${username}:\n\n`;
    shareMessage += `Title: ${title}\n\n`;
    shareMessage += `Content: ${content}\n\n`;
    shareMessage += 'https://vicinity-deep-linking.vercel.app/post/' + post.id;

    try {
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const renderItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      disabled={isSwiping}
      onPress={() => {
        navigation.navigate('Post', { postId: item.id });
      }}
    >
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
          >
            <Image
              source={{ uri: item.profilePic || 'https://yourapp.com/default-profile.png' }}
              style={styles.profileImage}
            />
            <Text style={styles.username}>@{item.username}</Text>
          </TouchableOpacity>

          <View style={styles.menuContainer}>
            <Menu
              visible={menuVisible === item.id}
              onDismiss={() => setMenuVisible(null)}
              anchor={
                <TouchableOpacity onPress={() => setMenuVisible(item.id)}>
                  <Icon name="more-vertical" size={20} color="#F4F5F7" />
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
                  await savePost(item);
                  setMenuVisible(null);
                }}
                title="Save Post"
              />
            </Menu>
          </View>
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
              onTouchStart={() => setIsSwiping(true)}
              onTouchEnd={() => setIsSwiping(false)}
              renderItem={({ item: url, index }) =>
                isVideo(url) ? (
                  <Video
                    source={{ uri: url }}
                    style={styles.media}
                    resizeMode="cover"
                    paused={currentMediaIndex !== index || !isFocused}
                    controls
                  />
                ) : (
                  <Image
                    source={{ uri: url }}
                    style={styles.media}
                    resizeMode="cover"
                  />
                )
              }
              onViewableItemsChanged={onViewableItemsChanged.current}
              viewabilityConfig={viewConfigRef.current}
            />
            <View style={styles.mediaIndicators}>
              {item.mediaUrls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentMediaIndex ? styles.activeIndicator : styles.inactiveIndicator,
                  ]}
                />
              ))}
            </View>
          </>
        )}

        <Text style={styles.timestamp}>
          {item.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
        </Text>

        <View style={styles.actions}>
          <View style={styles.commentSection}>
            <TouchableOpacity onPress={() => toggleLike(item.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FontAwesome
                name={likeCounts[item.id]?.liked ? 'heart' : 'heart-o'}
                size={20}
                color={likeCounts[item.id]?.liked ? '#FF6B6B' : '#F4F5F7'}
              />
              {likeCounts[item.id]?.likeCount > 0 && (
                <Text style={[styles.commentCount, { marginLeft: 6 }]}>{likeCounts[item.id].likeCount}</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.commentSection}>
            <TouchableOpacity onPress={() => openComments(item.id)}>
              <Icon name="message-circle" size={18} color="#F4F5F7" />
            </TouchableOpacity>
            {commentCounts[item.id] > 0 && (
              <Text style={styles.commentCount}>{commentCounts[item.id]}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f26e0" />
      </View>
    );
  }

  return (
    <Provider>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <GradientText />
          </View>
          <DistanceFilterDropdown
            navigation={navigation}
            distanceFilter={distanceFilter}
            setDistanceFilter={setDistanceFilter}
          />
            <TouchableOpacity onPress={() => navigation.navigate('Inbox')} style={styles.inboxButton}>
            <Icon1 name="chat" size={24} color="#F4F5F7" />
            {unreadChats > 0 && (
              <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#FF6B6B',
                borderRadius: 8,
                paddingHorizontal: 4,
                paddingVertical: 2,
                minWidth: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              >
              <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                {unreadChats > 99 ? '99+' : unreadChats}
              </Text>
              </View>
            )}
            </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f26e0" />
              <Text style={styles.loadingText}>Loading posts...</Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.postList}
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No posts available in your area.</Text>
              }
              refreshing={loading}
              onRefresh={fetchPosts}
            />
          )}

          <Modal
            visible={commentModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => {
              setCommentModalVisible(false);
              setComments([]);
              setCommentLikes({});
              setReplies({});
              setSelectedPostId(null);
            }}
          >
            <TouchableWithoutFeedback onPress={() => {
              setCommentModalVisible(false);
              setComments([]);
              setCommentLikes({});
              setReplies({});
              setSelectedPostId(null);
            }}>
              <View style={styles.modalContainer}>
                <BlurView
                  style={StyleSheet.absoluteFillObject}
                  blurType="dark"
                  blurAmount={10}
                  reducedTransparencyFallbackColor="rgba(0,0,0,0.5)"
                />
                <TouchableWithoutFeedback>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.commentModal}
                  >
                    <FlatList
                      data={comments}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <View style={styles.commentContainer}>
                          <View style={styles.commentTopRow}>
                            <Text style={styles.commentUsername}>{item.username}</Text>
                            <TouchableOpacity onPress={() => likeComment(selectedPostId!, item.id, commentLikes[item.id].liked)} style={styles.likeButton}>
                              <FontAwesome
                                name={commentLikes[item.id]?.liked ? 'heart' : 'heart-o'}
                                size={14}
                                color={commentLikes[item.id]?.liked ? '#FF6B6B' : '#A1A1AA'}
                              />
                              <Text style={styles.likeCount}>{commentLikes[item.id]?.likeCount || 0}</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.commentText}>{item.text}</Text>
                          <View style={styles.commentActions}>
                            <TouchableOpacity onPress={() => setReplyTo(item.id)} style={styles.replyButton}>
                              <Text style={styles.replyButtonText}>Reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                              if (replies[item.id]) {
                                setReplies(prev => ({ ...prev, [item.id]: undefined }));
                              } else {
                                fetchReplies(item.id);
                              }
                            }}>
                              <Text style={styles.replyButtonText}>
                                {replies[item.id] ? 'Hide replies' : 'View replies'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {replyTo === item.id && (
                            <View style={styles.replyInputContainer}>
                              <TextInput
                                style={styles.replyInput}
                                value={replyText[item.id] || ''}
                                onChangeText={text => setReplyText(prev => ({ ...prev, [item.id]: text }))}
                                placeholder="Write a reply..."
                                placeholderTextColor="#7A8290"
                              />
                              <TouchableOpacity
                                onPress={() => addReply(item.id)}
                                style={styles.replySendButton}
                              >
                                <Text style={styles.replySendText}>Send</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {replies[item.id] && (
                            <View style={styles.repliesContainer}>
                              {replies[item.id].map(reply => (
                                <Text key={reply.id} style={styles.replyText}>
                                  <Text style={styles.replyUsername}>{reply.username}: </Text>
                                  {reply.text}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                      ListEmptyComponent={<Text style={styles.emptyComments}>No comments yet.</Text>}
                      ListFooterComponent={<FooterLoader loading={loadingMore} />}
                      onEndReached={handleEndReached}
                      onEndReachedThreshold={0.5}
                      keyboardShouldPersistTaps="handled"
                    />
                    <View style={styles.commentInputContainer}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor="#7A8290"
                        value={newComment[selectedPostId || ''] || ''}
                        onChangeText={(text) =>
                          setNewComment((prev) => ({ ...prev, [selectedPostId || '']: text }))
                        }
                      />
                      <TouchableOpacity
                        onPress={postComment}
                        style={styles.commentSendButton}
                      >
                        <Text style={styles.commentSendText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
          <NavigationBar navigation={navigation} />
        </View>
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black', // Deep navy background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1B1C2A',
  },
  logoContainer: {
    flex: 1,
  },
  inboxButton: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  content: {
    flex: 1,
    backgroundColor: '#0A0B14',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#F4F5F7',
    marginTop: 8,
    fontSize: 16,
  },
  postList: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyText: {
    color: '#F4F5F7',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    fontWeight: '500',
  },
  postContainer: {
    backgroundColor: '#1B1C2A', // Dark post background
    padding: 12,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 38, 224, 0.2)', // Subtle purple border
    shadowColor: '#4f26e0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  username: {
    color: '#F4F5F7',
    fontSize: 15,
    fontWeight: '600',
  },
  menuContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitle: {
    color: '#F4F5F7',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  postContent: {
    color: '#F4F5F7',
    fontSize: 15,
    marginBottom: 8,
  },
  media: {
    width: screenWidth - 40,
    height: 250,
    borderRadius: 8,
    marginRight: 10,
  },
  mediaIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: '#F4F5F7',
  },
  inactiveIndicator: {
    backgroundColor: '#555',
  },
  timestamp: {
    color: '#7A8290',
    fontSize: 12,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  commentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentCount: {
    color: '#F4F5F7',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentModal: {
    backgroundColor: '#1B1C2A',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    width: '100%',
  },
  commentContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3F3F46',
  },
  commentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentUsername: {
    fontWeight: '600',
    color: '#F4F5F7',
    fontSize: 14,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  likeCount: {
    color: '#A1A1AA',
    fontSize: 12,
    marginLeft: 4,
  },
  commentText: {
    color: '#F4F5F7',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  replyButton: {
    marginRight: 16,
  },
  replyButtonText: {
    color: '#4f26e0',
    fontSize: 12,
    fontWeight: '600',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 14,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#27293A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
    padding: 8,
    fontSize: 13,
    color: '#F4F5F7',
    marginRight: 8,
  },
  replySendButton: {
    padding: 8,
  },
  replySendText: {
    color: '#4f26e0',
    fontWeight: '700',
    fontSize: 13,
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 14,
  },
  replyText: {
    color: '#D4D4D8',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  replyUsername: {
    fontWeight: '600',
    color: '#F4F5F7',
  },
  emptyComments: {
    color: '#F4F5F7',
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#1B1C2A',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#27293A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
    padding: 10,
    fontSize: 14,
    color: '#F4F5F7',
    marginRight: 10,
  },
  commentSendButton: {
    padding: 8,
  },
  commentSendText: {
    color: '#4f26e0',
    fontWeight: '700',
    fontSize: 14,
  },
  modal: {
    justifyContent: 'flex-start',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'black',
    borderRadius: 8,
    marginTop: 50,
    marginHorizontal: 20,
    padding: 10,
    elevation: 5,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  optionText: {
    fontSize: 16,
    color: 'white',
  },
});

export default PostScreen;
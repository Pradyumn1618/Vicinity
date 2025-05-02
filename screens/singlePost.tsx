import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Image, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { doc, getDoc, getFirestore, setDoc, collection, getDocs, addDoc, query, orderBy, limit, startAfter, serverTimestamp } from '@react-native-firebase/firestore';
import Video from 'react-native-video';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useUser } from '../context/userContext';
import { set } from 'date-fns';

const db = getFirestore();

const IndividualPostScreen = () => {
    const route = useRoute();
    const { user } = useUser();
    const { postId } = route.params;

    const [post, setPost] = useState(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [commentCount, setCommentCount] = useState(0);
    const [comments, setComments] = useState([]);
    const [lastCommentDoc, setLastCommentDoc] = useState(null);
    const [commentInput, setCommentInput] = useState('');
    const [reply, setReply] = useState('');
    const [replies, setReplies] = useState({});
    const [lastReplyDoc, setLastReplyDoc] = useState({});
    const [hasMoreReplies, setHasMoreReplies] = useState({});
    const [replyTo, setReplyTo] = useState(null);
    const [visibleReplies, setVisibleReplies] = useState({});
    const [replyText, setReplyText] = useState('');
    const [replyVisible, setReplyVisible] = useState(false);


    const screenWidth = Dimensions.get('window').width;
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems?.length > 0) {
            setCurrentMediaIndex(viewableItems[0].index);
        }
    });

    const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

    useEffect(() => {
        const fetchPost = async () => {
            try {
                setIsLoading(true);
                const postRef = doc(db, 'posts', postId);
                const postSnap = await getDoc(postRef);
                if (postSnap.exists) {
                    const postData = postSnap.data();
                    setPost(postData);
                    setCommentCount(postData.commentCount || 0);
                    setLikeCount(postData.likeCount || 0);

                    const likeRef = doc(db, 'posts', postId, 'likes', user.id);
                    const likeSnap = await getDoc(likeRef);
                    setLiked(likeSnap.exists);
                }
            } catch (err) {
                console.error('Error fetching post:', err);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchComments = async () => {
            try {
                const commentsRef = collection(db, 'posts', postId, 'comments');
                let q = query(commentsRef, orderBy('timestamp', 'desc'), limit(20));

                const commentSnap = await getDocs(q);
                const commentsData = await Promise.all(
                    commentSnap.docs.map(async (docSnap) => {
                        const data = docSnap.data();
                        //   const replies = await fetchReplies(docSnap.id);
                        return {
                            id: docSnap.id,
                            ...data,
                        };
                    })
                );

                setComments(prev => [...prev, ...commentsData]);
                if (!commentSnap.empty) {
                    setLastCommentDoc(commentSnap.docs[commentSnap.docs.length - 1]);
                }
            } catch (err) {
                console.error('Error fetching comments:', err);
            }
        };

        fetchPost();
        fetchComments();
    }, [postId, user.id]);

    const fetchMoreComments = async () => {
        if (!lastCommentDoc) return;
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'desc'), startAfter(lastCommentDoc), limit(20));
            const commentSnap = await getDocs(q);
            const commentsData = await Promise.all(
                commentSnap.docs.map(async (docSnap) => {
                    const data = docSnap.data();
                    //   const replies = await fetchReplies(docSnap.id);
                    return {
                        id: docSnap.id,
                        ...data,
                    };
                })
            );

            setComments(prev => [...prev, ...commentsData]);
            if (commentSnap.docs.length === 20) {
                setLastCommentDoc(commentSnap.docs[commentSnap.docs.length - 1]);
            } else {
                setLastCommentDoc(null);
            }
        } catch (err) {
            console.error('Error fetching more comments:', err);
        }
    }

    const toggleLike = async () => {
        try {
            const postRef = doc(db, 'posts', postId);
            const likeRef = doc(db, 'posts', postId, 'likes', user.id);

            if (liked) {
                await setDoc(likeRef, { liked: false });
                await setDoc(postRef, { likeCount: likeCount - 1 }, { merge: true });
                setLiked(false);
                setLikeCount(prev => prev - 1);
            } else {
                await setDoc(likeRef, { liked: true });
                await setDoc(postRef, { likeCount: likeCount + 1 }, { merge: true });
                setLiked(true);
                setLikeCount(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    };



    const fetchReplies = async (commentId) => {
        try {
            const repliesRef = collection(db, 'posts', postId, 'comments', commentId, 'replies');
            let q = query(repliesRef, orderBy('timestamp', 'desc'));
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
            return [];
        }
    };

    const addComment = async () => {
        if (!commentInput.trim()) return;
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            const commentData = {
                userId: user?.id,
                username: user?.username || 'Anonymous',
                text: commentInput,
                likeCount: 0,
                timestamp: serverTimestamp(),
            };
            const commentDoc = await addDoc(commentsRef, commentData);
            await setDoc(doc(db, 'posts', postId), { commentCount: commentCount + 1 }, { merge: true });
            setComments(prev => [
                ...prev,
                {
                    id: commentDoc.id,
                    ...commentData,
                },
            ]);
            setCommentCount(prev => prev + 1);
            setCommentInput('');
            setLastCommentDoc(null);
        } catch (err) {
            console.error('Error adding comment:', err);
        }
    };

    const addReply = async (commentId) => {
        if (!reply.trim()) return;
        try {
            const repliesRef = collection(db, 'posts', postId, 'comments', commentId, 'replies');
            const replyData = {
                userId: user?.id,
                username: user?.username || 'Anonymous',
                text: reply,
                timestamp: serverTimestamp(),
            };
            setReplies(prev => ({
                ...prev,
                [commentId]: [...(prev[commentId] || []), replyData],
            }));
            await addDoc(repliesRef, replyData);
            setReply('');
        } catch (err) {
            console.error('Error adding reply:', err.message);
        }
    }

    const isVideo = (url) => {
        try {
            const decoded = decodeURIComponent(url);
            return /\.(m3u8|mp4|mov|webm|avi|mkv)$/i.test(decoded.split('?')[0]);
        } catch {
            return false;
        }
    };

    if (isLoading) {
        return <ActivityIndicator size="large" color="#fff" />;
    }

    return (
        <View className="bg-zinc-800 py-4 px-2 mb-6 rounded-lg flex-1">
            <Text className="text-white text-lg font-semibold mb-1">{post.title}</Text>
            <Text className="text-white mb-2">{post.content}</Text>

            {post.mediaUrls?.length > 0 && (
                <>
                    <FlatList
                        data={post.mediaUrls}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(url, index) => `${post.id}-${index}`}
                        renderItem={({ item: url }) =>
                            isVideo(url) ? (
                                <Video source={{ uri: url }} style={{ width: screenWidth - 10, height: 250 }} resizeMode="cover" paused={false} controls />
                            ) : (
                                <Image source={{ uri: url }} style={{ width: screenWidth - 10, height: 250 }} resizeMode="cover" />
                            )
                        }
                        onViewableItemsChanged={onViewableItemsChanged.current}
                        viewabilityConfig={viewConfigRef.current}
                    />
                </>
            )}

            <Text className="text-zinc-400 text-sm mt-2">{post.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</Text>

            <View className="flex-row justify-between items-center px-1 mt-2">
                <TouchableOpacity onPress={toggleLike}>
                    <FontAwesome name={liked ? 'heart' : 'heart-o'} size={20} color={liked ? 'red' : 'white'} />
                    {likeCount > 0 && <Text className="text-white text-m">{likeCount}</Text>}
                </TouchableOpacity>
                <View className="flex-row items-center space-x-2 mt-1">
                    <FontAwesome name="comment-o" size={20} color="white" />
                    {commentCount > 0 && <Text className="text-white text-m">{commentCount}</Text>}
                </View>
            </View>

            <View className="mt-4">
                <TextInput
                    placeholder="Add a comment..."
                    placeholderTextColor="#aaa"
                    value={commentInput}
                    onChangeText={setCommentInput}
                    onSubmitEditing={addComment}
                    className="text-white border border-zinc-600 rounded px-3 py-2"
                />
            </View>

            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                onEndReached={fetchMoreComments}
                onEndReachedThreshold={0.5}
                renderItem={({ item: comment }) => (
                    <View className="border-t border-zinc-700 mt-2 pt-2">
                        <Text className="text-white">{comment.text}</Text>

                        <TouchableOpacity onPress={() => setReplyTo(comment.id)}>
                            <Text className="text-blue-400 text-xs mt-1">Reply</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => fetchReplies(comment.id)}>
                            <Text className="text-blue-400 text-xs mt-1">
                                {replies[comment.id] ? 'Hide replies' : 'View replies'}
                            </Text>
                        </TouchableOpacity>

                        {replyTo === comment.id && (
                            <View className="mt-2">
                                <TextInput
                                    placeholder="Write a reply..."
                                    placeholderTextColor="#999"
                                    value={reply}
                                    onChangeText={setReply}
                                    className="border border-zinc-600 text-white p-2 rounded"
                                />
                                <TouchableOpacity onPress={addReply} className="mt-1">
                                    <Text className="text-green-400 text-sm">Send</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Replies, if visible */}
                        {replies[comment.id]?.map(reply => (
                            <View key={reply.id} className="ml-4 mt-1">
                                <Text className="text-zinc-300 text-sm">↳ {reply.text}</Text>
                            </View>
                        ))}
                    </View>
                )}
            />
        </View>
    );
};

export default IndividualPostScreen;

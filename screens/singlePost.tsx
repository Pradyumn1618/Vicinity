import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Image, TouchableOpacity, Dimensions, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { doc, getDoc, getFirestore, setDoc, collection, getDocs, addDoc, query, orderBy, limit, startAfter, serverTimestamp, deleteDoc, updateDoc, increment } from '@react-native-firebase/firestore';
import Video from 'react-native-video';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useUser } from '../context/userContext';
import mmkv from '../storage';

const db = getFirestore();

const IndividualPostScreen = ({ navigation }) => {
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
    // const [replyText, setReplyText] = useState('');
    const [replyVisible, setReplyVisible] = useState(false);
    const [replyText, setReplyText] = useState({});
    const [commentLikes, setCommentLikes] = useState({});



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

                setComments(commentsData);
                const updatedLikes = {};

                for (const comment of commentsData) {
                    const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', user.id);
                    const likeDoc = await getDoc(likeRef);
                    updatedLikes[comment.id] = {
                        liked: likeDoc.exists,
                        count: comment.likeCount || 0,
                    };
                }

                setCommentLikes(prev => ({ ...prev, ...updatedLikes }));
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
            const updatedLikes = {};
            for (const comment of commentsData) {
                const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', user.id);
                const likeDoc = await getDoc(likeRef);
                updatedLikes[comment.id] = {
                    liked: likeDoc.exists,
                    count: comment.likeCount || 0,
                };
            }
            setCommentLikes(prev => ({ ...prev, ...updatedLikes }));
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


    const toggleCommentLike = async (commentId) => {
        const current = commentLikes[commentId];
        const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', user.id);
        const commentRef = doc(db, 'posts', postId, 'comments', commentId);

        if (current?.liked) {
            await deleteDoc(likeRef);
            await updateDoc(commentRef, {
                likeCount: increment(-1),
            });
            setCommentLikes(prev => ({
                ...prev,
                [commentId]: {
                    liked: false,
                    count: Math.max(0, prev[commentId].count - 1),
                },
            }));
        } else {
            await setDoc(likeRef, { liked: true });
            await updateDoc(commentRef, {
                likeCount: increment(1),
            });
            setCommentLikes(prev => ({
                ...prev,
                [commentId]: {
                    liked: true,
                    count: (prev[commentId]?.count || 0) + 1,
                },
            }));
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
        if (!replyText[commentId].trim()) return;
        try {
            const repliesRef = collection(db, 'posts', postId, 'comments', commentId, 'replies');
            const replyData = {
                userId: user?.id,
                username: user?.username || 'Anonymous',
                text: replyText[commentId],
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

    // if (isLoading) {
    //     return <ActivityIndicator size="large" color="#fff" />;
    // }

    return (
        <View className="bg-zinc-800 py-4 px-2 flex-1">
            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : (
                <>
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: post.userId })}>
                        <View className="flex-row items-center mb-3">
                            <Image
                                source={{ uri: post.profilePic || 'https://via.placeholder.com/40' }}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    marginRight: 10,
                                    borderWidth: 1,
                                    borderColor: '#3f3f46',
                                }}
                            />
                            <Text style={{ color: '#e4e4e7', fontSize: 15, fontWeight: '600' }}>
                                {post.username || 'Anonymous'}
                            </Text>
                        </View>
                    </TouchableOpacity>

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
                                        <Video source={{ uri: url }} style={{ width: screenWidth - 10, height: 'auto' }} resizeMode="cover" paused={false} controls />
                                    ) : (
                                        <Image source={{ uri: url }} style={{ width: screenWidth - 10, height: 'auto' }} resizeMode="cover" />
                                    )
                                }
                                onViewableItemsChanged={onViewableItemsChanged.current}
                                viewabilityConfig={viewConfigRef.current}
                            />
                        </>
                    )}

                    <Text className="text-zinc-400 text-sm mt-2">{post.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}</Text>

                    <View className="flex-row justify-between items-center px-1 mt-2 mb-4">
                        <TouchableOpacity onPress={toggleLike}>
                            <View className="flex-row items-center">
                                <FontAwesome name={liked ? 'heart' : 'heart-o'} size={20} color={liked ? 'red' : 'white'} />
                                <Text className="text-white text-lg ml-2">{likeCount}</Text>
                            </View>

                        </TouchableOpacity>
                        <View className="flex-row items-center space-x-2 mt-1">
                            <FontAwesome name="comment-o" size={20} color="white" />
                            {commentCount > 0 && <Text className="text-white text-lg ml-2">{commentCount}</Text>}
                        </View>
                    </View>

                    <FlatList
                        data={comments}
                        keyExtractor={item => item.id}
                        renderItem={({ item: comment }) => (
                            <View style={styles.commentContainer}>

                                {/* Like button in top-right */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={styles.username}>{comment.username}</Text>
                                    <TouchableOpacity onPress={() => toggleCommentLike(comment.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <FontAwesome
                                            name={commentLikes[comment.id]?.liked ? 'heart' : 'heart-o'}
                                            size={16}
                                            color={commentLikes[comment.id]?.liked ? 'red' : 'white'}
                                        />
                                        <Text style={{ color: 'white', marginLeft: 4, fontSize: 12 }}>
                                            {commentLikes[comment.id]?.count || 0}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Comment text */}
                                <Text style={styles.commentText}>{comment.text}</Text>

                                {/* Action row: Reply and View Replies */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                    <TouchableOpacity onPress={() => setReplyTo(comment.id)} style={{ marginRight: 20 }}>
                                        <Text style={styles.replyButton}>Reply</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        if (replies[comment.id]) {
                                            setReplies(prev => ({ ...prev, [comment.id]: undefined }));
                                        } else {
                                            fetchReplies(comment.id);
                                        }
                                    }}>
                                        <Text style={styles.replyButton}>
                                            {replies[comment.id] ? 'Hide replies' : 'View replies'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Reply input */}
                                {replyTo === comment.id && (
                                    <View style={styles.replyInputContainer}>
                                        <TextInput
                                            style={styles.replyInput}
                                            value={replyText[comment.id] || ''}
                                            onChangeText={text => setReplyText(prev => ({ ...prev, [comment.id]: text }))}
                                            placeholder="Write a reply..."
                                        />
                                        <TouchableOpacity
                                            onPress={() => {
                                                addReply(comment.id);
                                                setReplyText(prev => ({ ...prev, [comment.id]: '' }));
                                                setReplyTo(null);
                                            }}
                                        >
                                            <Text style={styles.replySend}>Send</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Replies */}
                                {replies[comment.id] && (
                                    <View style={styles.repliesContainer}>
                                        {replies[comment.id].map(reply => (
                                            <Text key={reply.id} style={styles.replyText}>
                                                <Text style={{ fontWeight: 'bold' }}>{reply.username}: </Text>
                                                {reply.text}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}


                        onEndReached={fetchMoreComments}
                    />
                    <View style={styles.addCommentContainer}>
                        <TextInput
                            style={styles.commentInput}
                            value={commentInput}
                            onChangeText={setCommentInput}
                            placeholder="Add a comment..."
                        />
                        <TouchableOpacity onPress={addComment}>
                            <Text style={styles.commentSend}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
};

export default IndividualPostScreen;

const styles = StyleSheet.create({
    commentContainer: {
        backgroundColor: '#27272a', // dark gray bg
        borderRadius: 10,
        padding: 10,
        marginVertical: 6,
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    username: {
        fontWeight: 'bold',
        color: '#e4e4e7',
        fontSize: 15,
    },
    commentText: {
        color: '#f4f4f5',
        fontSize: 15,
        marginTop: 4,
        marginBottom: 8,
        lineHeight: 20,
    },
    replyButton: {
        color: '#60a5fa', // blue-400
        fontSize: 13,
        marginRight: 16,
    },
    replyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        marginLeft: 16,
    },
    replyInput: {
        flex: 1,
        backgroundColor: '#1f2937', // dark input background
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#4b5563',
        padding: 8,
        fontSize: 14,
        color: 'white',
        marginRight: 8,
    },
    replySend: {
        color: '#3b82f6', // blue-500
        fontWeight: 'bold',
        fontSize: 14,
    },
    repliesContainer: {
        marginTop: 8,
        paddingLeft: 14,
        marginLeft: 10,
        borderLeftWidth: 2,
        borderLeftColor: '#3f3f46',
    },
    replyText: {
        color: '#d4d4d8',
        fontSize: 14,
        marginBottom: 10,
        lineHeight: 18,
    },
    addCommentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#3f3f46',
        backgroundColor: '#18181b',
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#1f2937',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#4b5563',
        padding: 10,
        fontSize: 15,
        color: 'white',
        marginRight: 10,
    },
    commentSend: {
        color: '#60a5fa',
        fontWeight: 'bold',
        fontSize: 16,
    },
});


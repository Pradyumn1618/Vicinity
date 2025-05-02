import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';
import PostList from './PostList';
import EventList from './EventList';
import { Post } from '../helper/types';
import { Event } from '../helper/types';
import { useUser } from '../context/userContext';

interface ProfileScreenProps {
    navigation: NavigationProp<any>;
}

const db = getFirestore();

const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
    const [userData, setUserData] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
    const [lastEvent, setLastEvent] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
    const [lastPost, setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const { user } = useUser();

    useFocusEffect(
        useCallback(() => {
            const localUser = mmkv.getString('user');
            if (!localUser) {
                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                    });
                }, 500);
                return;
            }

            // const user = auth().currentUser;
            if (!user) {
                setLoading(false);
                return;
            }

            const fetchProfileData = async () => {
                try {
                    const userRef = doc(db, 'users', user.id);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        setUserData(userData);

                        const [postDocs, eventDocs] = await Promise.all([
                            getDocs(query(collection(db, "posts"), where("userId", "==", user.id), orderBy('createdAt', 'desc'), limit(10))),
                            getDocs(query(collection(db, "Events"), where("userId", "==", user.id), orderBy('dateTime', 'desc'), limit(10))),
                        ]);

                        setPosts(postDocs.docs.map(doc => {
                            const data = doc.data();
                            // console.log('Post data:', data);
                            return {
                                id: doc.id,
                                title: data.title ?? '',
                                content: data.content ?? '',
                                mediaUrls: data.mediaUrls ?? [],
                                createdAt: data.createdAt ?? null,
                                geohash6: data.geohash6 ?? '',
                                geohash5: data.geohash5 ?? '',
                                geohash4: data.geohash4 ?? '',
                                commentCount: data.commentCount ?? 0,
                                likeCount: data.likeCount ?? 0,
                            } as Post;
                        }));
                        setEvents(
                            eventDocs.docs.map(doc => {
                                const data = doc.data();
                                return {
                                    id: doc.id,
                                    title: data.title ?? '',
                                    description: data.description ?? '',
                                    dateTime: data.dateTime?.toDate?.() ?? new Date(),
                                    venue: data.venue ?? '',
                                    geohash: data.geohash ?? '',
                                    location: data.location ?? { _latitude: 0, _longitude: 0 },
                                    public: data.public ?? false,
                                    createdBy: data.createdBy ?? '',
                                    allowedUsers: data.allowedUsers ?? [],
                                    notifierUsers: data.notifierUsers ?? [],
                                } as Event;
                            })
                        );
                        if (eventDocs.docs.length > 0) {
                            setLastEvent(eventDocs.docs[eventDocs.docs.length - 1]);
                        }
                        if (postDocs.docs.length > 0) {
                            setLastPost(postDocs.docs[postDocs.docs.length - 1]);
                        }
                    } else {
                        console.log('No such user document!');
                    }
                } catch (error) {
                    console.error('Error fetching profile data:', error);
                    setPosts([]);
                    setEvents([]);
                } finally {
                    setLoading(false);
                }
            };

            fetchProfileData();
        }, [navigation,user])
    );

    const handleLogout = async () => {
        try {
            await auth().signOut();
            mmkv.delete('user');
            mmkv.delete('geohash');
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4f26e0" />
            </View>
        );
    }

    const deletePost = async (postId: string) => {
        try {
            await getFirestore().collection('posts').doc(postId).delete();
            setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    const deleteEvent = async (eventId: string) => {
        try {
            await getFirestore().collection('events').doc(eventId).delete();
            setEvents((prevEvents) => prevEvents.filter((event) => event.id !== eventId));
        } catch (error) {
            console.error("Error deleting event:", error);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setShowSettingsMenu(!showSettingsMenu)}
            >
                <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>

            {showSettingsMenu && (
                <View style={styles.dropdownMenu}>
                    <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={handleLogout}
                    >
                        <Text style={styles.dropdownText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            )}

            {userData && (
                <View style={styles.profileContainer}>
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate('FullProfile', {
                                profilePic: userData.profilePic,
                                username: userData.username,
                            })
                        }
                    >
                        <Image
                            source={
                                userData.profilePic
                                    ? { uri: userData.profilePic }
                                    : {
                                          uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
                                      }
                            }
                            style={styles.profileImage}
                        />
                    </TouchableOpacity>
                    <Text style={styles.username}>{userData.username || "No username"}</Text>
                    <Text style={styles.bio}>{userData.bio || 'No bio available'}</Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('UpdateProfile')}
            >
                <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    onPress={() => setActiveTab('posts')}
                    style={[styles.tabButton, activeTab === 'posts' ? styles.tabActive : styles.tabInactive]}
                >
                    <Text style={[styles.tabText, activeTab === 'posts' ? styles.tabTextActive : styles.tabTextInactive]}>Posts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('events')}
                    style={[styles.tabButton, activeTab === 'events' ? styles.tabActive : styles.tabInactive]}
                >
                    <Text style={[styles.tabText, activeTab === 'events' ? styles.tabTextActive : styles.tabTextInactive]}>Events</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'posts' ? (
                posts.length > 0 ? (
                    <PostList initialPosts={posts} lastP={lastPost} userId={userData.id} isMine={true} />
                ) : (
                    <Text style={styles.emptyText}>No posts yet.</Text>
                )
            ) : null}

            {activeTab === 'events' ? (
                events.length > 0 ? (
                    <EventList initialEvents={events} lastE={lastEvent} userId={userData.id} isMine={true} />
                ) : (
                    <Text style={styles.emptyText}>No events yet.</Text>
                )
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0B14', // Deep navy background
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A0B14',
    },
    settingsButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: '#1B1C2A', // Dark background for button
        borderRadius: 12,
        padding: 8,
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 10,
    },
    settingsIcon: {
        fontSize: 24,
        color: '#F4F5F7',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#1B1C2A', // Dark dropdown background
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(79, 38, 224, 0.2)', // Subtle purple border
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        zIndex: 10,
        paddingVertical: 8,
        width: 150,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    dropdownText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '600',
    },
    profileContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#4f26e0', // Purple border
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    username: {
        fontSize: 24,
        fontWeight: '800',
        color: '#F4F5F7', // Soft white
        marginTop: 12,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(79, 38, 224, 0.3)', // Purple glow
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
    },
    bio: {
        fontSize: 16,
        fontWeight: '500',
        color: '#7A8290', // Gray for bio
        marginTop: 8,
        textAlign: 'center',
    },
    editButton: {
        backgroundColor: '#3B3D8A', // Deep indigo
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#3B3D8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    editButtonText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '700',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#1B1C2A', // Dark tab background
        borderRadius: 24,
        padding: 6,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(79, 38, 224, 0.2)', // Subtle purple border
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabActive: {
        backgroundColor: '#4f26e0', // Purple for active tab
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    tabInactive: {
        backgroundColor: 'transparent',
    },
    tabText: {
        fontSize: 16,
        fontWeight: '700',
    },
    tabTextActive: {
        color: '#F4F5F7', // White for active tab text
    },
    tabTextInactive: {
        color: '#7A8290', // Gray for inactive tab text
    },
    emptyText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default ProfileScreen;
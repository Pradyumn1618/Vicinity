import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { NavigationProp,useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';
import PostList from './PostList';
import EventList from './EventList';
import { Post } from '../helper/types';
import { Event } from '../helper/types';

interface ProfileScreenProps {
    navigation: NavigationProp<any>;
}

const db = getFirestore();
const currentUser = auth().currentUser;

const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
    const [userData, setUserData] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
    const [lastEvent, setLastEvent] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
    const [lastPost,setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
    
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
    
        const user = auth().currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
    
        const fetchProfileData = async () => {
          try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
    
            if (userDoc.exists) {
              const userData = userDoc.data();
              setUserData(userData);
    
              const [postDocs, eventDocs] = await Promise.all([
                getDocs(query(collection(db, "posts"), where("userId", "==", user.uid),orderBy('createdAt','desc'),limit(10))),
                getDocs(query(collection(db, "Events"), where("userId", "==", user.uid),orderBy('dateTime','desc'),limit(10))),
              ]);
    
              setPosts(postDocs.docs.map(doc => {
                const data = doc.data();
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
              if(postDocs.docs.length>0){
                setLastPost(postDocs.docs[postDocs.docs.length-1]);
              }
              console.log('lastEvent',lastEvent);
              
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
      }, [navigation])
    );
    

      if (loading) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator size="large" color="#0000ff" />
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
      <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
        {userData && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
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
                    ?  
                    { uri: userData.profilePic }
                    : {
                        uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
                      }
                }
                className="w-24 h-24 rounded-full"
              />
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>
              {userData.username || "No username"}
            </Text>
            <Text style={{ fontSize: 14, color: 'gray' }}>
              {userData.bio || 'No bio available'}
            </Text>
          </View>
        )}
    
        <Button title="Edit Profile" onPress={() => navigation.navigate('UpdateProfile')} />
    
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('posts')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'posts' ? '#007bff' : '#ccc',
              padding: 10,
              borderTopLeftRadius: 10,
              borderBottomLeftRadius: 10,
              marginTop: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: activeTab === 'posts' ? '#fff' : '#000' }}>Posts</Text>
          </TouchableOpacity>
    
          <TouchableOpacity
            onPress={() => setActiveTab('events')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'events' ? '#007bff' : '#ccc',
              padding: 10,
              borderTopRightRadius: 10,
              borderBottomRightRadius: 10,
              marginTop: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: activeTab === 'events' ? '#fff' : '#000' }}>Events</Text>
          </TouchableOpacity>
        </View>
    
        { activeTab === 'posts' ? (
          posts.length > 0 ?  ( 
            <PostList initialPosts={posts} lastP={lastPost} userId={userData.uid}/>
        ) : (
          <Text style={{ color: 'white', textAlign: 'center', marginTop: 20 }}>No posts yet.</Text>
        )
        ) : null}

        {activeTab === 'events' ? (
          events.length > 0 ? (
            <EventList initialEvents={events} lastE={lastEvent} userId={userData.uid} />
          ) : (
            <Text style={{ color: 'white', textAlign: 'center', marginTop: 20 }}>No events yet.</Text>
          )
        ) : null}
      </View>
    );
  };

  export default ProfileScreen;
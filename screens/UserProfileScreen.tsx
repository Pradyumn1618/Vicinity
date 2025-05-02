import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import PostList from './PostList';
import EventList from './EventList';
import { Post, Event } from '../helper/types';
import { useUser } from '../context/userContext';
import Navigation from '../navigation';

type RouteParams = {
  userId: string;
};

const UserProfileScreen = ({navigation}) => {
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const userId = route.params.userId;
  const { user } = useUser();

  const [userData, setUserData] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
  const [lastPost, setLastPost] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
  const [lastEvent, setLastEvent] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);

  useEffect(() => {
    if(userId === user.id){
      navigation.replace('Profile');
    }
  },[userId, user,navigation]);

    useEffect( () => {
      const fetchData = async () => {
        try {
          const userDoc = await firestore().collection('users').doc(userId).get();
          if (userDoc.exists) {
            setUserData(userDoc.data());

            const [postDocs, eventDocs] = await Promise.all([
              firestore()
                .collection('posts')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get(),
              firestore()
                .collection('Events')
                .where('userId', '==', userId)
                .orderBy('dateTime', 'desc')
                .limit(10)
                .get(),
            ]);

            setPosts(postDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
            setEvents(eventDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
            if (postDocs.docs.length > 0) setLastPost(postDocs.docs[postDocs.docs.length - 1]);
            if (eventDocs.docs.length > 0) setLastEvent(eventDocs.docs[eventDocs.docs.length - 1]);
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [userId]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 50 }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      {userData && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image
            source={
              userData.profilePic
                ? { uri: userData.profilePic }
                : { uri: 'https://img.freepik.com/placeholder.jpg' }
            }
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>
            {userData.username || 'No username'}
          </Text>
          <Text style={{ fontSize: 14, color: 'gray' }}>{userData.bio || 'No bio available'}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => setActiveTab('posts')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'posts' ? '#007bff' : '#ccc',
            padding: 10,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
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
            alignItems: 'center',
          }}
        >
          <Text style={{ color: activeTab === 'events' ? '#fff' : '#000' }}>Events</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'posts' && (
        posts.length > 0 ? (
          <PostList initialPosts={posts} lastP={lastPost} userId={userId} />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center', marginTop: 20 }}>No posts yet.</Text>
        )
      )}

      {activeTab === 'events' && (
        events.length > 0 ? (
          <EventList initialEvents={events} lastE={lastEvent} userId={userId} />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center', marginTop: 20 }}>No events yet.</Text>
        )
      )}
    </View>
  );
};

export default UserProfileScreen;
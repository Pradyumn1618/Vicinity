import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@react-native-firebase/firestore';
import { RouteProp, useRoute, NavigationProp } from '@react-navigation/native';

interface UserProfileScreenProps {
  navigation: NavigationProp<any>;
}

type RouteParams = {
  UserProfile: {
    userId: string;
  };
};

const UserProfileScreen = ({ navigation }: UserProfileScreenProps) => {
  const route = useRoute<RouteProp<RouteParams, 'UserProfile'>>();
  const { userId } = route.params;

  const [userData, setUserData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const db = getFirestore();

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap) {
          const user = userSnap.data();
          setUserData(user);

          const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
          const postDocs = await getDocs(postsQuery);
          setPosts(postDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

          const eventsQuery = query(collection(db, 'events'), where('userId', '==', userId));
          const eventDocs = await getDocs(eventsQuery);
          setEvents(eventDocs.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        } else {
          console.warn('User not found');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white' }}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity
          onPress={ () =>
            navigation.navigate('FullProfile',{
                profilePic: userData.profilePic,
                username: userData.username,
            })


          }
        >

        <Image
          source={{
              uri:
              userData.profilePic ||
              'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
            }}
            style={{
                width: 96,
                height: 96,
                borderRadius: 48,
            }}
            />
            </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'white', marginTop: 10 }}>
          {userData.username}
        </Text>
        <Text style={{ fontSize: 14, color: 'gray' }}>{userData.bio || 'No bio available'}</Text>
      </View>

      {/* Tab Switcher */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => setActiveTab('posts')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'posts' ? '#007bff' : '#444',
            padding: 10,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: activeTab === 'posts' ? '#fff' : '#ccc' }}>Posts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('events')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'events' ? '#007bff' : '#444',
            padding: 10,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: activeTab === 'events' ? '#fff' : '#ccc' }}>Events</Text>
        </TouchableOpacity>
      </View>

      {/* Render Posts or Events */}
      <FlatList
        data={activeTab === 'posts' ? posts : events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 10,
              borderWidth: 1,
              borderColor: '#333',
              marginBottom: 10,
              borderRadius: 8,
              backgroundColor: '#111',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>
              {item.title || item.name}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: 'gray' }}>
                Likes: {item.likes?.length || 0}
              </Text>
              <Text style={{ color: 'gray' }}>
                Comments: {item.comments?.length || 0}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: 'gray' }}>
            No {activeTab === 'posts' ? 'posts' : 'events'} to show.
          </Text>
        }
      />
    </View>
  );
};

export default UserProfileScreen;
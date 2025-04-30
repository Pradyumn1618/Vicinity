import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { NavigationProp,useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';
import PostList from './PostList';

interface ProfileScreenProps {
    navigation: NavigationProp<any>;
}

const db = getFirestore();
const currentUser = auth().currentUser;

const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
    const [userData, setUserData] = useState<any>(null);
    const [posts, setPosts] = useState<{ id: string; [key: string]: any }[]>([]);
    const [events, setEvents] = useState<{ id: string; [key: string]: any }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'events'>('posts');
    

    const checkAuthentication = React.useCallback(() => {
        const user = mmkv.getString('user');
        console.log('MMKV user:', user);
        if (!user) {
          // Use reset instead of navigate to remove the current screen from the stack
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }, 500);
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
      

      useFocusEffect(
        useCallback(() => {
          if (!currentUser) {
            setLoading(false);
            return ;
          }
      
          const fetchProfileData = async () => {
            try {
              const userRef = doc(db, 'users', currentUser.uid);
              const userDoc = await getDoc(userRef);
      
              if (userDoc.exists) {
                const user = userDoc.data();
                console.log('User data:', user);
                setUserData(user);
      
                // Fetch posts created by the user
                const postsQuery = query(collection(db, "posts"), where("userId", "==", currentUser.uid));
                const postDocs = await getDocs(postsQuery);
                setPosts(postDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
                // Fetch events created by the user
                const eventsQuery = query(collection(db, "events"), where("userId", "==", currentUser.uid));
                const eventDocs = await getDocs(eventsQuery);
                setEvents(eventDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
              } else {
                console.log('No such document!');
              }
            } catch (error) {
              console.error('Error fetching profile data:', error);
              setPosts([]);
              setEvents([]);
            } finally {
              setLoading(false);
            }
          };
      
          setLoading(true);
          fetchProfileData();
        }, [currentUser])
      );

      if (loading) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
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
                    ? { uri: userData.profilePic }
                    : {
                        uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
                      }
                }
                className="w-24 h-24 rounded-full"
              />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>
              {userData.username}
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
    
        {activeTab === 'posts' ? (
          <PostList/>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ padding: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.title}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: 'gray' }}>Likes: {item.likes?.length || 0}</Text>
                  <Text style={{ color: 'gray' }}>Comments: {item.comments?.length || 0}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => deletePost(item.id)}
                  style={{
                    marginTop: 10,
                    backgroundColor: 'red',
                    padding: 8,
                    borderRadius: 5,
                    alignSelf: 'flex-end',
                  }}
                >
                  <Text style={{ color: 'white' }}>Delete Post</Text>
                </TouchableOpacity>
              </View>
            )}
          />

        )}
      </View>
    );
  };

  export default ProfileScreen;
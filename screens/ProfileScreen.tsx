import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator, Button } from 'react-native';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { NavigationProp,useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';

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
        if (!currentUser) return;

        const fetchProfileData = async () => {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('User data:', userData);
                    setUserData(userData);

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
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, []);

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
            {userData && (
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Image
                              source={userData.profilePic ? { uri: userData.profilePic } : { uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg' }}
                              className="w-24 h-24 rounded-full"
                            />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>{userData.username}</Text>
                    <Text style={{ fontSize: 14, color: 'gray' }}>{userData.bio || 'No bio available'}</Text>
                </View>
            )}
            <Button title="Edit Profile" onPress={() => navigation.navigate('UpdateProfile')} />

            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Posts</Text>
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={{ marginBottom: 10 }}>
                        <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 200, borderRadius: 10 }} />
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 5 }}>{item.caption}</Text>
                    </View>
                )}
            />

            <Text style={{ fontSize: 18, fontWeight: 'bold', marginVertical: 10 }}>Events</Text>
            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.title}</Text>
                        <Text style={{ fontSize: 14, color: 'gray' }}>{item.date}</Text>
                    </View>
                )}
            />
        </View>
    );
};

export default ProfileScreen;

// Make sure you're using modular imports
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, FlatList, Image } from 'react-native';
// import  Ionicons  from  'react-native-vector-icons/Ionicons';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, onSnapshot } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import Geohash from 'ngeohash';
import { NavigationProp } from '@react-navigation/native';



interface chatMainScreenProps {
  navigation: NavigationProp<any>;
}



const db = getFirestore();
const auth = getAuth();

export default function InboxScreen({ navigation }: chatMainScreenProps) {
  const [tab, setTab] = useState('messages'); // Active tab
  const [searchText, setSearchText] = useState(''); // Search input text
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; photoURL?: string; username?: string }[]>([]);
  const [chats, setChats] = useState<Message[]>([]); // Direct messages
  const [groups, setGroups] = useState<Group[]>([]); // Groups

  interface Message {
    id: string;
    time: string;
    message?: string;
    participants: string[];
    photoURL?: string;
    username?: string;
  }

  interface Group {
    id: string;
    name: string;
    photoURL?: string;
    message?: string;
    time: string;
    lastSender?: string;
  }

  useEffect(() => {
    // Fetch nearby online users
    const fetchNearbyOnlineUsers = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const userSnap = await getDoc(doc(db, 'users', userId));
        const userData = userSnap.data();
        if (!userData || !userData.geohash) {
          console.error('❌ User data or geohash is missing');
          return;
        }
        const { geohash: currentGeohash } = userData;

        const neighbors = Geohash.neighbors(currentGeohash);
        const hashesToQuery = [currentGeohash, ...neighbors];

        const userFetchPromises = hashesToQuery.map(async (hash) => {
          const bucketRef = collection(db, 'geoBuckets', hash, 'onlineUsers');
          const snapshot = await getDocs(bucketRef);
          return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        });

        const nearbyUsers = (await Promise.all(userFetchPromises)).flat();
        setOnlineUsers(nearbyUsers);
      } catch (error) {
        console.error('❌ Error fetching online users:', error);
      }
    };

    fetchNearbyOnlineUsers();
  }, []);

  useEffect(() => {
    // Fetch direct messages
    const fetchChats = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const chatsRef = collection(db, 'chats');
      const chatsQuery = query(chatsRef, where('participants', 'array-contains', userId));

      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatList = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data();
            const otherParticipant = getOtherParticipant(data.participants);

            // Fetch the profile picture of the other participant
            let photoURL = null;
            let username = null;
            if (otherParticipant) {
              const userRef = doc(db, 'users', otherParticipant);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists) {
                photoURL = userSnap.data()?.profilePic || null;
                username = userSnap.data()?.username || null;
              }
            }

            return {
              id: d.id,
              time: data.time || new Date().toISOString(),
              message: data.message || '',
              participants: data.participants || [],
              photoURL,
              username,
            };
          })
        );
        setChats(chatList);
      });

      return unsubscribe;
    };

    fetchChats();
  }, []);

  useEffect(() => {
    // Fetch groups
    const fetchUserGroups = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      if (!userData || !userData.groups) {
        console.error('❌ User data or groups are missing');
        return;
      }
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where(firestore.FieldPath.documentId(), 'in', userData.groups));
      const unsubscribe = onSnapshot(groupsQuery, async (snapshot) => {
        const groupList = await Promise.all(
          snapshot.docs.map(async (d) => {
            const groupData = d.data();
            const groupId = d.id;

            return {
              id: groupId,
              name: groupData?.name,
              photoURL: groupData?.photoURL || null,
              time: groupData?.lastMessageTime || null,
              message: groupData?.lastMessage || '',
              lastSender: groupData?.lastSender || null,
            };
          })
        );
        setGroups(groupList);
      });

      return unsubscribe;
    };

    fetchUserGroups();
  }, []);

  const getOtherParticipant = (participants: string[]): string | undefined => {
    const userId = auth.currentUser?.uid;
    return participants.find((participant) => participant !== userId);
  };

  return (
    <View className="flex-1 bg-black px-4 pt-6">
      <Text className="text-white text-2xl font-bold mb-4 text-center">Inbox</Text>

      {/* Search Input */}
      <TextInput
        placeholder="Search here"
        placeholderTextColor="#aaa"
        className="bg-zinc-800 rounded-xl px-4 py-2 text-white"
        value={searchText}
        onChangeText={setSearchText} // Update search text dynamically
      />

      {/* Online Users */}

      {onlineUsers.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 8,
            alignItems: 'center',
          }}
          style={{
            marginBottom: 4,
            maxHeight: 76, // tightly restricts total height
          }}
        >
          {onlineUsers.map((user) => (
            <View key={user.id} style={{ alignItems: 'center', marginRight: 12 }}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: user.photoURL || 'https://via.placeholder.com/40' }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 10,
                    height: 10,
                    backgroundColor: 'limegreen',
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: 'black',
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: 'white',
                  marginTop: 2,
                  width: 52,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {user.username}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ alignItems: 'center', marginVertical: 16 }}>
          <Text style={{ color: 'white', fontSize: 14 }}>No online users in your vicinity</Text>
        </View>
      )}

      {/* Tabs */}
      <View className="flex-row justify-around mb-4">
        <TouchableOpacity
          onPress={() => setTab('messages')}
          className={`flex-1 py-2 rounded-xl ${tab === 'messages' ? 'bg-white' : 'bg-zinc-700'}`}
        >
          <Text className={`text-center ${tab === 'messages' ? 'text-black font-semibold' : 'text-white'}`}>
            Direct Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('groups')}
          className={`flex-1 py-2 ml-2 rounded-xl ${tab === 'groups' ? 'bg-white' : 'bg-zinc-700'}`}
        >
          <Text className={`text-center ${tab === 'groups' ? 'text-black font-semibold' : 'text-white'}`}>
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* List of Chats or Groups */}
      {tab === 'messages' ? (
        <FlatList
          data={chats.filter((chat) => chat.username?.toLowerCase().includes(searchText.toLowerCase()))}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const otherParticipant = getOtherParticipant(item.participants);
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('ChatScreen', { chatId: item.id, receiver: otherParticipant })}
                className="flex-row items-center p-4 bg-zinc-800 rounded-2xl mb-3"
              >
                <Image
                  source={{
                    uri:
                      item.photoURL ||
                      'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
                  }}
                  className="w-12 h-12 rounded-full mr-3"
                />
                <View className="flex-1">
                  <Text className="text-white font-semibold">{item.username}</Text>
                  <Text className="text-gray-400 text-sm mt-1">{item.message}</Text>
                </View>
                <Text className="text-gray-400 text-xs">{new Date(item.time).toLocaleTimeString()}</Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={groups.filter((group) => group.name?.toLowerCase().includes(searchText.toLowerCase()))}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('GroupChatScreen', { groupId: item.id })}
              className="flex-row items-center p-4 bg-zinc-800 rounded-2xl mb-3"
            >
              <Image
                source={{
                  uri:
                    item.photoURL ||
                    'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg',
                }}
                className="w-12 h-12 rounded-full mr-3"
              />
              <View className="flex-1">
                <Text className="text-white font-semibold">{item.name}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
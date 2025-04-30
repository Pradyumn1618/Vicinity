// Make sure you're using modular imports
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, FlatList, Image } from 'react-native';
// import  Ionicons  from  'react-native-vector-icons/Ionicons';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, onSnapshot } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
// import Geohash from 'ngeohash';
import { NavigationProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
// import { getDatabase, ref, onValue } from '@react-native-firebase/database';
import useNearbyOnlineUsers from '../helper/onlineUsers';
import { insertOrUpdateChatInSQLite, getAllChatsFromSQLite, resetUnreadCount } from '../helper/databaseHelper';
import { useChatContext } from '../context/chatContext';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';



interface chatMainScreenProps {
  navigation: NavigationProp<any>;
}



const db = getFirestore();
const auth = getAuth();

export default function InboxScreen({ navigation }: chatMainScreenProps) {
  const {setCurrentChatId} = useChatContext();
  const [tab, setTab] = useState('messages'); // Active tab
  const [searchText, setSearchText] = useState(''); // Search input text
  const onlineUsers = useNearbyOnlineUsers(); // Online users
  const {chats, setChats} = useChatContext(); // Direct messages
  const [groups, setGroups] = useState<Group[]>([]); // Groups
  const [isModalVisible, setIsModalVisible] = useState(false); // Modal visibility
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; photoURL?: string }[]>([]); // Search results


  
  interface Group {
    id: string;
    name: string;
    photoURL?: string;
    message?: string;
    time: string;
    lastSender?: string;
  }

  
useFocusEffect(
  useCallback(() => {
    setCurrentChatId('');
    let unsubscribeFirestore = () => {};

    const fetchChats = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId){
        console.log('user not found!');
      return;
      }
        

      // STEP 1: Fetch from SQLite immediately
      let localChats = null;
      localChats = await getAllChatsFromSQLite(userId);
      console.log('Local chats:', localChats);
      setChats(localChats); // show cached chats first
      
      // STEP 2: Start listening to Firestore updates
      console.log("userId:",userId);
      const chatsRef = collection(db, 'chats');
      const chatsQuery = query(chatsRef, where('participants', 'array-contains', userId));

      unsubscribeFirestore = onSnapshot(chatsQuery, async (snapshot) => {
        const localChatMap = new Map(localChats?.map((chat) => [chat.id, chat]));

        const chatList = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data();
            const otherParticipant = getOtherParticipant(data.participants);

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

            const existing = localChatMap.get(d.id);

            await insertOrUpdateChatInSQLite({
              id: d.id,
              participants: data.participants || [],
              photoURL,
              username,
            });

            return {
              id: d.id,
              participants: data.participants || [],
              photoURL,
              username,
              unreadCount: existing?.unreadCount || 0,
            };
          })
        );

        console.log('Fetched chats:', chatList);
        setChats(chatList);
      });
    };

    fetchChats();

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [setCurrentChatId, setChats])
);


useFocusEffect(
  useCallback(() => {
    let unsubscribeFirestore = () => {};

    const fetchUserGroups = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (!userData || !userData.groups || userData.groups.length === 0) {
        console.error('❌ User data or groups are missing');
        setGroups([]); // Optionally clear group list if user has none
        return;
      }

      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(
        groupsRef,
        where(firestore.FieldPath.documentId(), 'in', userData.groups)
      );

      unsubscribeFirestore = onSnapshot(groupsQuery, async (snapshot) => {
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
    };

    fetchUserGroups();

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [setGroups])
);


  const getOtherParticipant = (participants: string[]): string | undefined => {
    const userId = auth.currentUser?.uid;
    return participants.find((participant) => participant !== userId);
  };

  const handleSearchUsers = async (queryText: string) => {
    setSearchText(queryText);
    if (queryText.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '>=', queryText), where('username', '<=', queryText + '\uf8ff'));
      const snapshot = await getDocs(q);

      const currentUserId = auth.currentUser?.uid; // Get the current user's ID

      const results = snapshot.docs
        .filter((doc) => doc.id !== currentUserId) // Exclude the current user's document
        .map((doc) => ({
          id: doc.id,
          username: doc.data().username,
          photoURL: doc.data().profilePic || 'https://via.placeholder.com/40',
        }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const generateChatId = (userId: string) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return '';
    return currentUserId > userId ? `chat_${userId}_${currentUserId}` : `chat_${currentUserId}_${userId}`;
  }

  const handleStartChat = (user: { id: string; username: string; photoURL?: string }) => {
    setIsModalVisible(false);
    setSearchText('');
    const chatId = generateChatId(user.id);
    resetUnreadCount(chatId);
    navigation.navigate('ChatScreen', { chatId: chatId, receiver: user.id });
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
            <View key={user.userId} style={{ alignItems: 'center', marginRight: 12 }}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: user.profilePic || 'https://via.placeholder.com/40' }}
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
                  {/* <Text className="text-gray-400 text-sm mt-1">{item.message}</Text> */}
                </View>
                <View className="flex-row items-center">
                  {item.unreadCount && item.unreadCount > 0 && (
                    <View
                      className="bg-blue-500 rounded-full px-2 py-1"
                      style={{ backgroundColor: '#4F46E5', borderRadius: 9999 }}
                    >
                      <Text className="text-white text-xs">{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
                {/* <Text className="text-gray-400 text-xs">{new Date(item.time).toLocaleTimeString()}</Text> */}
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
      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: '#4F46E5',
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Search Modal */}
      <Modal isVisible={isModalVisible} onBackdropPress={() => setIsModalVisible(false)}>
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 8 }}>
          <TextInput
            placeholder="Search users..."
            value={searchText}
            onChangeText={handleSearchUsers}
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              padding: 8,
              marginBottom: 16,
            }}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleStartChat(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#eee',
                }}
              >
                <Image
                  source={{ uri: item.photoURL }}
                  style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                />
                <Text>{item.username}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
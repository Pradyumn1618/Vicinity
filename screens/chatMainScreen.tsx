// Make sure you're using modular imports
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import Geohash from 'ngeohash';

const db = getFirestore();
const auth = getAuth();

export default function InboxScreen() {
  const [tab, setTab] = useState('messages');
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; photoURL?: string; username?: string }[]>([]);
  interface Message {
    id: string;
    photoURL: string;
    username: string;
    time: string;
    message: string;
  }

  const [messages, setMessages] = useState<Message[]>([]); // Later populate this with Firestore chat history

  useEffect(() => {
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

        const userFetchPromises = hashesToQuery.map(async hash => {
          const bucketRef = collection(db, 'geoBuckets', hash, 'onlineUsers');
          const snapshot = await getDocs(bucketRef);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const nearbyUsers = (await Promise.all(userFetchPromises)).flat();
        setOnlineUsers(nearbyUsers);
      } catch (error) {
        console.error('❌ Error fetching online users:', error);
      }
    };

    fetchNearbyOnlineUsers();
  }, []);

  return (
    <View className="flex-1 bg-black px-4 pt-6">
      <Text className="text-white text-2xl font-bold mb-4 text-center">Inbox</Text>

      <TextInput
        placeholder="Search here"
        placeholderTextColor="#aaa"
        className="bg-zinc-800 rounded-xl px-4 py-2 text-white"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-4">
        <View className="items-center mr-4">
          <View className="w-14 h-14 rounded-full border border-zinc-600 items-center justify-center">
            <Ionicons name="add" size={24} color="white" />
          </View>
          <Text className="text-white text-xs mt-1">New</Text>
        </View>
        {onlineUsers.map(user => (
          <View key={user.id} className="items-center mr-4">
            <View className="relative">
              <Image source={{ uri: user.photoURL }} className="w-14 h-14 rounded-full" />
              <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
            </View>
            <Text className="text-white text-xs mt-1">{user.username}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-around mb-4">
        <TouchableOpacity
          onPress={() => setTab('messages')}
          className={`flex-1 py-2 rounded-xl ${tab === 'messages' ? 'bg-white' : 'bg-zinc-700'}`}
        >
          <Text className={`text-center ${tab === 'messages' ? 'text-black font-semibold' : 'text-white'}`}>Direct Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('groups')}
          className={`flex-1 py-2 ml-2 rounded-xl ${tab === 'groups' ? 'bg-white' : 'bg-zinc-700'}`}
        >
          <Text className={`text-center ${tab === 'groups' ? 'text-black font-semibold' : 'text-white'}`}>Groups</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-start p-4 bg-zinc-800 rounded-2xl mb-3">
            <Image source={{ uri: item.photoURL }} className="w-12 h-12 rounded-full mr-3" />
            <View className="flex-1">
              <View className="flex-row justify-between">
                <Text className="text-white font-semibold">{item.username}</Text>
                <Text className="text-gray-400 text-xs">{item.time}</Text>
              </View>
              <Text className="text-white mt-1">{item.message}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

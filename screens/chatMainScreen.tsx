import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const onlineUsers = [
  { id: '1', username: 'mariio5', photoURL: 'https://example.com/mariio.jpg' },
  { id: '2', username: 'lea.98', photoURL: 'https://example.com/lea.jpg' },
  { id: '3', username: 'loco_cafe', photoURL: 'https://example.com/loco.jpg' },
  { id: '4', username: 'gabriel.g', photoURL: 'https://example.com/gabriel.jpg' },
];

const messages = [
  { id: '1', username: 'mariio5', message: 'You owe me money! Respond!', time: 'Just now', photoURL: 'https://example.com/mariio.jpg' },
  { id: '2', username: 'lea.98', message: "I'm afraid he will sue me...", time: '12 min.', photoURL: 'https://example.com/lea.jpg' },
  { id: '3', username: 'gabriel.g', message: "Hello, can you answer? What's wrong with...", time: '1 d.', photoURL: 'https://example.com/gabriel.jpg' },
];

export default function InboxScreen() {
  const [tab, setTab] = useState('messages');

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

import React, { useState, useRef } from 'react';

// Define the Message type
type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: string;
  replyTo?: string | null;
};
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hey!', senderId: 'user1', timestamp: '10:00 AM' },
    { id: '2', text: 'What’s up?', senderId: 'me', timestamp: '10:01 AM' },
  ]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<{ text: string } | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);

  const currentUserId = 'me'; // Replace with auth().currentUser.uid

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      senderId: currentUserId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: replyTo?.text || null,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setReplyTo(null);

    // Scroll to bottom after sending
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

const handleReply = (message: Message) => setReplyTo(message);
const handleDelete = (messageId: string): void => {
    setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
};

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUserId;
    return (
      <View
        className={`max-w-[80%] p-3 rounded-xl mb-2 ${
          isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
        }`}
      >
        {item.replyTo && (
          <View className="mb-1 border-l-2 border-white pl-2">
            <Text className="text-white text-xs italic">Reply: {item.replyTo}</Text>
          </View>
        )}
        <Text className="text-white">{item.text}</Text>
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-gray-300">{item.timestamp}</Text>
          <View className="flex-row gap-x-2">
            <TouchableOpacity onPress={() => handleReply(item)}>
              <Ionicons name="return-up-back-outline" size={16} color="white" />
            </TouchableOpacity>
            {isMine && (
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={16} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => renderMessage({ item })}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
      />

      {replyTo && (
        <View className="bg-zinc-800 px-4 py-2 border-l-4 border-blue-500">
          <Text className="text-white text-xs">Replying to: {replyTo.text}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)} className="absolute top-2 right-3">
            <Ionicons name="close" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-row items-center px-4 py-3 bg-zinc-900 border-t border-zinc-700">
        <TouchableOpacity className="mr-3">
          <Ionicons name="attach" size={24} color="white" />
        </TouchableOpacity>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message"
          placeholderTextColor="#aaa"
          className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-xl"
        />
        <TouchableOpacity onPress={handleSend} className="ml-3">
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

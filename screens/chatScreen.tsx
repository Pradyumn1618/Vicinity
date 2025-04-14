import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from '@react-native-firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from '@react-native-firebase/storage';
import Ionicons  from  'react-native-vector-icons/Ionicons';
import socket from '../config/socket';

import { RouteProp } from '@react-navigation/native';

type ChatScreenRouteProp = RouteProp<{ ChatScreen: { chatId: string; receiver: string } }, 'ChatScreen'>;

export default function ChatScreen({ route }: { route: ChatScreenRouteProp }) {
  const { chatId, receiver } = route.params;
  interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
    media?: string | null;
    replyTo?: { text: string; id: string } | null;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<{ text: string; id: string } | null>(null);
  const [media, setMedia] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);

  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;
  const db = getFirestore();
  const storage = getStorage();

  // Fetch messages from Firestore
  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages: Message[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          timestamp: data.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          media: data.media || null,
          replyTo: data.replyTo || null,
        };
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [chatId, db]);

  const handleSend = async () => {
    if (!inputText.trim() && !media) return; // Ensure either text or media is present
    if (!currentUserId) return;

    const newMessage: Message = {
      id: chatId + Date.now().toString(),
      text: inputText,
      senderId: currentUserId,
      timestamp: new Date().toISOString(),
      replyTo: replyTo || null,
      media: media,
    };

    // Add the message to Firestore
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(messagesRef, {
      text: newMessage.text,
      senderId: newMessage.senderId,
      timestamp: serverTimestamp(),
      media: newMessage.media,
      replyTo: replyTo?.id || null,
    });

    setInputText('');
    setReplyTo(null);
    setMedia(null); // Clear media after sending

    // Scroll to bottom after sending
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    socket.emit('send-dm', { id: chatId, receiver: receiver, message: newMessage });
  };

  const handleAttachMedia = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed', // Supports both images and videos
        selectionLimit: 1,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `media_${Date.now()}`;
      const uri = asset.uri;

      if (!uri) return;

      // Upload media to Firebase Storage
      const storageRef = ref(storage, `chats/${chatId}/${fileName}`);
      const response = await fetch(uri);
      const blob = await response.blob();
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed', (snapshot) => {
        console.log(`Progress: ${(snapshot.bytesTransferred / snapshot.totalBytes) * 100}%`);
      });

      await uploadTask;

      const downloadURL = await getDownloadURL(storageRef);
      setMedia(downloadURL); // Set the media URL to include in the message
      console.log('Media uploaded successfully:', downloadURL);
    } catch (error) {
      console.error('Error attaching media:', error);
    }
  };

  const handleReply = (message: Message) => setReplyTo(message);

  const handleDelete = (messageId: string): void => {
    setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUserId;

    const handleScrollToReply = () => {
      if (item.replyTo?.id) {
        const targetIndex = messages.findIndex((msg) => msg.id === item.replyTo?.id);
        if (targetIndex !== -1) {
          try {
            flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
          } catch (error) {
            console.error('Error scrolling to message:', error);
          }
        }
      }
    };

    return (
      <View
        className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
          }`}
      >
        {item.replyTo && (
          <TouchableOpacity onPress={handleScrollToReply}>
            <View className="mb-1 border-l-2 border-white pl-2">
              <Text className="text-white text-xs italic">Reply: {item.replyTo.text}</Text>
            </View>
          </TouchableOpacity>
        )}
        {item.media && (
          <Image
            source={{ uri: item.media }}
            className="w-full h-40 rounded-lg mb-2"
            resizeMode="cover"
          />
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
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => renderMessage({ item })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        initialNumToRender={10} // Optimize for large lists
        getItemLayout={(data, index) => ({
          length: 80, // Approximate height of each message
          offset: 80 * index,
          index,
        })}
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
        <TouchableOpacity onPress={handleAttachMedia} className="mr-3">
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
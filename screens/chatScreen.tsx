import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,Alert,StyleSheet, Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc,getDoc,deleteDoc } from '@react-native-firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL,deleteObject } from '@react-native-firebase/storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import socket from '../config/socket';
import Video from 'react-native-video'; // For video rendering
import FastImage from 'react-native-fast-image'; // For better image and GIF support

import { RouteProp } from '@react-navigation/native';
import { Modal } from 'react-native';
import { sendDMNotification } from '../helper/sendNotification';
import useReceiverStatus from '../helper/receiverStatus';
import { useSocket } from '../helper/socketProvider';
import { insertMessage,incrementUnreadCount } from '../helper/databaseHelper';
// import MediaTest from './test';

type ChatScreenRouteProp = RouteProp<{ ChatScreen: { chatId: string; receiver: string } }, 'ChatScreen'>;

export default function ChatScreen({ route }: { route: ChatScreenRouteProp }) {
  const { chatId, receiver } = route.params;
  const socket = useSocket();
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
  // const [media, setMedia] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedMedia,setAttachedMedia] = useState<{uri:string,filename:string,type:string}|null>(null);
  const [pressedFileExt, setPressedFileExt] = useState<string | null>(null);
  const [receiverDetails, setReceiverDetails] = useState<any>(null);
  // const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // const [initialScrollDone, setInitialScrollDone] = useState(false);
  useEffect(() => {
    socket.on('private_message', (msg) => {
      // 1. Save to local DB
      insertMessage(msg);
  
      // 2. Show in chat screen if open
      if (chatId === msg.chatId) {
        setMessages(prev => [...prev, msg]);
      } else {
        // 3. Update unread badge
        incrementUnreadCount(msg.chatId);
      }
    });
  
    return () => {
      socket.off('private_message');
    };
  }, [socket,chatId]);
  


  const handleMediaPress = (uri: string) => {
    // Check if the media is a video
    const cleanUrl = uri.split('?')[0].toLowerCase();
    const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1);
    setPressedFileExt(ext);
    setSelectedMedia(uri);
    setModalVisible(true);
  };

  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;
  const db = getFirestore();
  const storage = getStorage();


  useReceiverStatus(receiver, setReceiverDetails);

  // Fetch messages from Firestore
  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'));

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

  // useEffect(() => {
  //   if (messages.length > 0 && !initialScrollDone) {
  //     scrollToBottom();
  //     setInitialScrollDone(true);
  //   }
  // }, [messages, initialScrollDone]);
  
  const handleSend = async () => {
    if (!inputText.trim() && !attachedMedia) return; // Ensure either text or media is present
    if (!currentUserId) return;
    let media = null;
  if (attachedMedia) {
    try {
      setUploading(true);
      const response = await fetch(attachedMedia.uri);
      const blob = await response.blob();

      const storageRef = ref(storage, `chats/${chatId}/${attachedMedia.filename}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed', (snapshot) => {
        const progress = snapshot.bytesTransferred / snapshot.totalBytes;
        setUploadProgress(progress);
      });

      await uploadTask;
      media = await getDownloadURL(storageRef);
      // setMedia(mediaUrl);
      setUploading(false);
      setAttachedMedia(null);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      // setMedia(null);
      setAttachedMedia(null);
      return;
    }
  }

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
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text } : null,
    });

    const chatsRef = collection(db, 'chats');
    const chatDocRef = doc(chatsRef, chatId);
    try {
      await setDoc(chatDocRef, {
        lastMessage: newMessage.text,
        lastTimestamp: serverTimestamp(),
        participants: [currentUserId, receiver],
      }, { merge: true });
    } catch (error) {
      console.error("Error updating chat doc:", error);
    }


    setInputText('');
    setReplyTo(null);
    // setMedia(null); // Clear media after sending
    setUploadProgress(0);
    // Scroll to bottom after sending
    // scrollToBottom();
    sendDMNotification([receiverDetails?.fcmToken], currentUserId, newMessage.text,chatId);
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

      setAttachedMedia({ uri, filename: fileName, type: asset.type || 'unknown' });

    } catch (error) {
      console.error('Error attaching media:', error);
    }
  };

  const handleReply = (message: Message) => setReplyTo(message);

  const messageIdToIndexMap = useMemo(() => {
    const map: { [key: string]: number } = {};
    messages.forEach((msg, idx) => {
      map[msg.id] = idx;
    });
    return map;
  }, [messages]);

const handleDelete = (messageId: string): void => {
  Alert.alert(
    "Delete Message",
    "Are you sure you want to delete this message?",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => confirmDelete(messageId)
      }
    ],
    { cancelable: true }
  );
};

const confirmDelete = async (messageId: string): Promise<void> => {
  try {
    // Remove the message from the local state
    setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));

    // Reference to the message in Firestore
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);

    if (messageDoc.exists) {
      const messageData = messageDoc.data();

      // Check if the message has media
      if (messageData?.media) {
        const mediaUrl = messageData.media;

        // Extract the file path from the media URL
        const filePath = decodeURIComponent(mediaUrl.split('/o/')[1].split('?')[0]);

        // Reference to the file in Firebase Storage
        const storageRef = ref(storage, filePath);

        // Delete the file from Firebase Storage
        await deleteObject(storageRef);
        console.log('Media deleted successfully from storage');
      }

      // Delete the message from Firestore
      await deleteDoc(messageRef);
      console.log('Message deleted successfully from Firestore');
    } else {
      console.error('Message does not exist in Firestore');
    }
  } catch (error) {
    console.error('Error deleting message or media:', error);
  }
};


  const renderMedia = (media: string, onPress?: () => void) => {
    const cleanUrl = media.split('?')[0].toLowerCase();
    const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1);

    const isVideo = ext === 'mp4' || ext === 'mov';


    const mediaStyle = {
      width: 220,
      height: 280,
      borderRadius: 12,
      marginBottom: 8,
    };

    if (isVideo) {
      return (
        <TouchableOpacity onPress={onPress}>
          <Video
            source={{ uri: media }}
            style={mediaStyle}
            controls
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={onPress}>
        <FastImage
          source={{ uri: media }}
          style={mediaStyle}
          resizeMode={FastImage.resizeMode.cover}
        />
      </TouchableOpacity>
    );
  };

  // const scrollToBottom = () => {
  //   InteractionManager.runAfterInteractions(() => {
  //     requestAnimationFrame(() => {
  //       flatListRef.current?.scrollToEnd({ animated: true });
  //     });
  //   });
  // };


  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUserId;
    const isHighlighted = item.id === highlightedMessageId;

    const scrollToMessageById = (messageId:string) => {
      const targetIndex = messageIdToIndexMap[messageId];
      console.log('targetIndex:', targetIndex);
      if (targetIndex !== undefined) {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5, // keeps it mid-screen, feels smoother
        });
        setHighlightedMessageId(messageId); // for highlight effect
        setTimeout(() => setHighlightedMessageId(null), 2000);
      } else {
        console.warn('Message ID not found in map:', messageId);
      }
    };

    const handleScrollToReply = () => {
      if (item.replyTo?.id) {
        scrollToMessageById(item.replyTo.id);
      }
         else {
          console.error("could not find the message");
        }
    };

    return (
      <View
        className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
          } ${isHighlighted ? 'border-2 border-yellow-400' : ''}`}
      >
        {item.replyTo && (
          <TouchableOpacity onPress={handleScrollToReply}>
            <View className="mb-1 border-l-2 border-white pl-2">
              <Text className="text-white text-xs italic">Reply: {item.replyTo.text}</Text>
            </View>
          </TouchableOpacity>
        )}
        {item.media ? renderMedia(item.media as string, () => handleMediaPress(item.media as string)) : null}
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
    {receiverDetails &&
    <View style={styles.statusBar}>
        <Image source={{ uri: receiverDetails.profilePic }} style={styles.profilePic} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{receiverDetails.username}</Text>
          {receiverDetails.status&&<Text style={styles.status}>{receiverDetails.status}</Text>}
          {receiverDetails.lastSeen && <Text style={styles.status}>Last seen: {receiverDetails.lastSeen}</Text>}
        </View>
      </View>
}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        inverted={true}
        renderItem={({ item }) => renderMessage({ item })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        initialNumToRender={10} // Optimize for large lists
        onScrollToIndexFailed={({ index }) => {
          console.log('Scroll failed. Retrying index:', index);
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 300); // wait for layout
        }}
        />

      {replyTo && (
        <View className="bg-zinc-800 px-4 py-2 border-l-4 border-blue-500">
          <Text className="text-white text-xs">Replying to: {replyTo.text}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)} className="absolute top-2 right-3">
            <Ionicons name="close" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {attachedMedia && (
        <View style={{ marginBottom: 8 }}>
          {attachedMedia.uri.endsWith('.mp4') || attachedMedia.uri.endsWith('.mov') ? (
            <Video
              source={{ uri: attachedMedia.uri }}
              style={{ width: 180, height: 200, borderRadius: 12 }}
              controls={true}
              resizeMode="cover"
            />
          ) : (
            <FastImage
              source={{ uri: attachedMedia.uri }}
              style={{ width: 180, height: 200, borderRadius: 12 }}
              resizeMode={FastImage.resizeMode.cover}
            />
          )}
          <TouchableOpacity
            onPress={() => setAttachedMedia(null)}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: 4,
              borderRadius: 20,
            }}
          >
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
        {uploading && (
          <View style={{ marginVertical: 4 }}>
            <Text style={{ color: 'white' }}>Uploading: {(uploadProgress * 100).toFixed(0)}%</Text>
            <View style={{ height: 6, backgroundColor: '#444', borderRadius: 6 }}>
              <View style={{
                width: `${uploadProgress * 100}%`,
                height: 6,
                backgroundColor: 'dodgerblue',
                borderRadius: 6
              }} />
            </View>
          </View>
        )}
        <TouchableOpacity onPress={handleSend} className="ml-3">
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 1 }}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>
          {pressedFileExt === 'mp4' || pressedFileExt === 'mov'  ? (
            <Video
              // source={{ uri: media }}
              // style={{ width: 220, height: 280, borderRadius: 12 }}
              // resizeMode="cover"
              paused={false}
              source={{ uri: selectedMedia || undefined }}
              style={{ width: '100%', height: '100%' }}
              controls={true}
              resizeMode="contain"
              // paused={false}
              onError={(error) => console.error('Video error:', error)} // Debugging video issues
            />
          ) : (
            <FastImage
              source={{ uri: selectedMedia || undefined }}
              style={{ width: '100%', height: '80%' }}
              resizeMode={FastImage.resizeMode.contain}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  status: {
    color: 'green', // Change to red or gray for offline
    fontSize: 12,
  },
});
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, StyleSheet, Image, ActivityIndicator, ToastAndroid, PermissionsAndroid, Pressable } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from '@react-native-firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, FirebaseStorageTypes } from '@react-native-firebase/storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import socket from '../config/socket';
import Video from 'react-native-video'; // For video rendering
import FastImage from 'react-native-fast-image'; // For better image and GIF support

import { RouteProp } from '@react-navigation/native';
import { Modal } from 'react-native';
import { sendDeleteNotification, sendDMNotification } from '../helper/sendNotification';
import useReceiverStatus from '../helper/receiverStatus';
import { useSocket } from '../helper/socketProvider';
import { useChatContext } from '../context/chatContext';
import NetInfo from '@react-native-community/netinfo';
import { nanoid } from 'nanoid';
import moment from 'moment';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Clipboard from '@react-native-clipboard/clipboard';
import ImageViewing from "react-native-image-viewing";

import DateTimePicker from '@react-native-community/datetimepicker';



import { resetUnreadCount, resetUnreadTimestamp, getUnreadTimestamp, insertMessage, getMessages, deleteMessage, setSeenMessages, getLocalMessages, getReceiver, insertIntoDeletedMessages, filterMessagesDB } from '../helper/databaseHelper';
import { DownloadHeader } from '../components/downLoad';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';






type ChatScreenRouteProp = RouteProp<{ ChatScreen: { chatId: string; receiver: string } }, 'ChatScreen'>;

export default function ChatScreen({ route, navigation }: { route: ChatScreenRouteProp, navigation: any }) {
  const { chatId, receiver } = route.params;
  const socket = useSocket();
  interface Message {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    media?: string | null;
    replyTo?: string | null;
    delivered?: boolean;
    seen?: boolean;
  }

  const { messages, setMessages } = useChatContext();
  const { setCurrentChatId } = useChatContext();



  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  // const [media, setMedia] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedMedia, setAttachedMedia] = useState<{ uri: string, filename: string, type: string } | null>(null);
  const [pressedFileExt, setPressedFileExt] = useState<string | null>(null);
  const [receiverDetails, setReceiverDetails] = useState<any>(null);
  const [unreadTimestamp, setUnreadTimestamp] = useState<number | null>(null);
  const [unreadIndex, setUnreadIndex] = useState<number | null>(null);
  const receiverDetailsRef = useRef(receiverDetails);
  const uploadTaskRef = useRef<FirebaseStorageTypes.Task | null>(null);
  const [showDivider, setShowDivider] = useState(false);
  const [offset, setOffset] = useState(0);
  const [typing, setTyping] = useState(false);
  const timestampToshowDivider = useRef<number | null>(null);
  const [searchText, setSearchText] = useState('');
  // const [showDatePicker, setShowDatePicker] = useState(false);
  // const [selectedDate, setSelectedDate] = useState(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);

  // const showSearchBar = useSharedValue(false);

// const receiverStyle = useAnimatedStyle(() => ({
//   opacity: withTiming(showSearchBar.value ? 0 : 1, { duration: 200 }),
//   height: withTiming(showSearchBar.value ? 0 : 60, { duration: 200 }),
// }));

// const searchBarStyle = useAnimatedStyle(() => {
//   return {
//     opacity: withTiming(showSearchBar.value ? 1 : 0, { duration: 200 }),
//     height: showSearchBar.value
//       ? 'auto'  // Let it expand naturally when shown
//       : 0,
//     overflow: 'hidden',
//   };
// });
// const toggleSearch = () => {
//   showSearchBar.value = !showSearchBar.value;
//   if (!showSearchBar.value) {
//     setSearchText('');
//     setSelectedDate(undefined);
//   }
// };







  // const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // const [initialScrollDone, setInitialScrollDone] = useState(false);

  async function hasAndroidPermission() {
    const getCheckPermissionPromise = () => {
      if (Number(Platform.Version) >= 33) {
        return Promise.all([
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES),
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO),
        ]).then(
          ([hasReadMediaImagesPermission, hasReadMediaVideoPermission]) =>
            hasReadMediaImagesPermission && hasReadMediaVideoPermission,
        );
      } else {
        return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      }
    };

    const hasPermission = await getCheckPermissionPromise();
    if (hasPermission) {
      return true;
    }
    const getRequestPermissionPromise = () => {
      if (Number(Platform.Version) >= 33) {
        return PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        ]).then(
          (statuses) =>
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
            PermissionsAndroid.RESULTS.GRANTED &&
            statuses[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
            PermissionsAndroid.RESULTS.GRANTED,
        );
      } else {
        return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE).then((status) => status === PermissionsAndroid.RESULTS.GRANTED);
      }
    };

    return await getRequestPermissionPromise();
  }

  const downloadAndSaveToGallery = useCallback(async (url: string, filename = 'myfile.jpg') => {
    const hasPermission = await hasAndroidPermission();
    if (!hasPermission) {
      console.log('Permission denied');
      ToastAndroid.show('Permission denied', ToastAndroid.SHORT);
      return;
    }
    try {
      const localPath = `${RNFS.TemporaryDirectoryPath}/${filename}`;

      // Step 1: Download file
      const result = await RNFS.downloadFile({
        fromUrl: url,
        toFile: localPath,
      }).promise;

      if (result.statusCode === 200) {
        // Step 2: Save to gallery
        const savedUri = await CameraRoll.saveAsset(`file://${localPath}`);
        ToastAndroid.show('Saved to gallery', ToastAndroid.SHORT);

        console.log('Saved to gallery at:', savedUri);
        return savedUri;
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.error('Failed to save media:', err);
      throw err;
    }
  }, []);

  const getFileNameFromUrl = (url: string) => {
    const extension = url.split('.').pop()?.split(/#|\?/)[0]; // jpg, mp4, etc.
    const uniqueName = `chat_media_${Date.now()}.${extension}`;
    return uniqueName;
  };

  useEffect(() => {
  const filterMessages = async () => {
    if (searchText.trim() === '') {
      return messages;
    }
    const lowerCaseSearchText = searchText.toLowerCase();
    const result = await filterMessagesDB(lowerCaseSearchText,chatId);
    console.log('Filtered messages:', result);
    setFilteredMessages(result);
  }
    filterMessages();
  }, [chatId, messages, searchText, setFilteredMessages]);


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

  useEffect(() => {
    socket.on('typing', (data: { chatId: string }) => {
      if (data.chatId === chatId) {
        setTyping(true);
      }
    });

    socket.on('StoppedTyping', (data: { chatId: string; }) => {
      if (data.chatId === chatId) {
        setTyping(false);
      }
    });
    return () => {
      socket.off('typing');
      socket.off('StoppedTyping');
    }
  }, [chatId, receiver, socket])

  useEffect(() => {
    socket.emit('get_status', { userId: receiver });
    socket.on('status_response', (data: { status: string; lastSeen: string }) => {
      const formattedLastSeen = data.lastSeen
        ? new Date(data.lastSeen).toLocaleString()
        : null;

      setReceiverDetails((prevDetails: any) => ({
        ...prevDetails,
        ...(data.status === 'online'
          ? { status: data.status, lastSeen: null }
          : { lastSeen: formattedLastSeen, status: null }),
      }));
    }
    );
    return () => {
      socket.off('status_response');
    };
  }, [socket, receiver]);

  useEffect(() => {
    const getReceiverDetails = async () => {
      console.log('getting receiver details')
      const details = await getReceiver(chatId);
      console.log('details', details);
      setReceiverDetails((prev: any) => ({
        ...prev,
        username: details.username,
        photoURL: details.photoURL,
      }));
    };
    getReceiverDetails();
  }, [chatId]);


  useReceiverStatus(receiver, setReceiverDetails);
  useEffect(() => {

    const fetchunreadTimestamp = async () => {
      const timestamp = await getUnreadTimestamp(chatId);
      timestampToshowDivider.current = timestamp;
      if (timestamp) {
        setUnreadTimestamp(timestamp);
      }
    };

    const fetchReceiverDetails = async () => {
      if (!receiver) return;

      try {
        const userRef = doc(db, 'users', receiver);
        const userDoc = await getDoc(userRef);


        if (userDoc.exists) {
          setReceiverDetails((prev: any) => ({
            ...prev,
            ...userDoc.data(),
          }));
        }
        receiverDetailsRef.current = userDoc.data();
      } catch (error) {
        console.error('Failed to fetch receiver details:', error);
      }
    };
    fetchReceiverDetails();
    fetchunreadTimestamp();
  }, [receiver, db, chatId]);

  type DividerItem = {
    type: 'divider';
    date: number;
    id: string;
  };
  type DecoratedMessage = Message & { type: 'message' } | DividerItem;

  const formatMessagesWithDateDividers = useCallback((msgs: Message[]): DecoratedMessage[] => {
    const formatted: DecoratedMessage[] = [];
    let lastDate: moment.Moment | null = null;

    const reversedMsgs = [...msgs].reverse();

    for (const msg of reversedMsgs) {
      const msgDate = moment(msg.timestamp).local().startOf('day');
      if (!lastDate || !msgDate.isSame(lastDate)) {
        formatted.push({
          type: 'divider',
          date: msg.timestamp,
          id: msg.id + nanoid(6),
        });
        lastDate = msgDate;
      }
      formatted.push({ ...msg, type: 'message' });
    }

    return formatted.reverse();
  }, []);





  const decoratedMessages = useMemo(() => {
    return searchText.trim() === '' ? formatMessagesWithDateDividers(messages) : formatMessagesWithDateDividers(filteredMessages);
  }, [messages, formatMessagesWithDateDividers, searchText, filteredMessages]);


  useEffect(() => {
    if (timestampToshowDivider.current && decoratedMessages.length > 0) {
      const index = decoratedMessages.findIndex(msg => msg.type === 'message' && msg.timestamp > timestampToshowDivider.current && msg.sender === receiver);
      if (index !== -1) {
        setUnreadIndex(index);
        setShowDivider(true);
      }
    }
  }, [decoratedMessages, receiver]);

  useEffect(() => {
    if (unreadIndex !== null && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: unreadIndex,
        viewPosition: 0.5, // centers it
        animated: true,
      });
    }
  }, [unreadIndex]);


  useLayoutEffect(() => {
    setCurrentChatId(chatId);
    resetUnreadCount(chatId);
    // resetUnreadTimestamp(chatId);
  }, [chatId, setCurrentChatId, receiver]);


  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  // const [newestTimestamp, setNewestTimestamp] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const MESSAGES_PAGE_SIZE = 40;

  useEffect(() => {
    const updateSeenMessages = async () => {
      const lastSeenTimestamp = await getUnreadTimestamp(chatId);
      console.log(lastSeenTimestamp);
      if (lastSeenTimestamp !== null && currentUserId) {
        await setSeenMessages(chatId, currentUserId, lastSeenTimestamp);

      }
      socket.emit('seen-messages', {
        chatId: chatId,
        receiver: receiver,
        timestamp: Date.now(),
        userId: currentUserId,
      });
    };
    updateSeenMessages();
    resetUnreadTimestamp(chatId);
    return () => {
      socket.off('seen-messages');
    };
  }, [chatId, currentUserId, receiver, socket]);


  useEffect(() => {
    async function fetchMessages(chatId: string, lastTimestamp: number = 0) {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("User not authenticated");

        const idToken = await currentUser.getIdToken();

        const url = new URL("https://vicinity-backend.onrender.com/messages/sync");
        url.searchParams.append("chatId", chatId);
        url.searchParams.append("after", String(lastTimestamp || 0));

        console.log("Fetching messages from URL:", url.toString());

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });
        // console.log("Response:", response);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Error ${response.status}: ${error.error}`);
        }

        const data = await response.json();
        console.log("response", data);
        return data.messages;
      } catch (err) {
        console.error("Failed to fetch messages:", err.message);
        return [];
      }
    }

    const syncMissedMessages = async () => {
      try {
        const newMessages = await fetchMessages(chatId, lastTimestamp || 0);

        for (const msg of newMessages) {
          await insertMessage(msg, chatId, receiver);
        }

        setMessages(() => {
          return newMessages.sort((a: Message, b: Message) => b.timestamp - a.timestamp);
        });
      } catch (err) {
        console.error('Failed to sync missed messages:', err);
      }
    };
    if (lastTimestamp !== null) {
      const checkNetworkAndSync = async () => {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          syncMissedMessages();
        }
      };
      checkNetworkAndSync();
    }
  }, [chatId, lastTimestamp, receiver, setMessages])


  useEffect(() => {
    const fetchInitialCachedMessages = async () => {
      setLoadingMore(true);
      const cachedMessages = await getMessages(chatId, MESSAGES_PAGE_SIZE);
      console.log('Fetched initial cached messages:', cachedMessages);

      if (cachedMessages && cachedMessages.length > 0) {
        setMessages(cachedMessages);
        setLastTimestamp(cachedMessages[cachedMessages.length - 1].timestamp);
        if (cachedMessages.length < MESSAGES_PAGE_SIZE) {
          setHasMore(false);

        }
        setOffset(cachedMessages.length);
      } else {
        setLastTimestamp(0);
      }
      setLoadingMore(false);
    };

    fetchInitialCachedMessages();
  }, [chatId, setMessages]); // Only run when chatId changes


  const syncMessages = useCallback(async (fetchedMessages: Message[], beforeTimestamp: number) => {
    // Step 1: Insert all fetched messages
    for (const message of fetchedMessages) {
      await insertMessage(message, chatId, receiver); // assume this already exists
    }

    // Step 2: Get local messages before timestamp
    const localMessages = await getLocalMessages(chatId, beforeTimestamp, 20);
    const localMessageIds = localMessages.map(msg => msg.messageId);

    // Step 3: Compare with server messages and delete extra local ones
    const serverMessageIds = fetchedMessages.map(msg => msg.id);
    const extraLocalIds = localMessageIds.filter(id => !serverMessageIds.includes(id));

    // Step 4: Delete extra local messages
    for (const id of extraLocalIds) {
      await deleteMessage(id);
    }
  }, [chatId, receiver]);

  const loadMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;

      if (isOffline) {
        console.log("Offline mode - loading older messages from local DB");

        const cachedMessages = await getMessages(chatId, MESSAGES_PAGE_SIZE, offset);
        if (cachedMessages.length > 0) {
          setOffset((prevOffset) => prevOffset + cachedMessages.length);
          setMessages((prev) => {
            const combined = [...cachedMessages, ...prev];
            return combined.sort((a, b) => b.timestamp - a.timestamp);
          });
        }

        if (cachedMessages.length < MESSAGES_PAGE_SIZE) {
          setHasMore(false);
        }
        setLoadingMore(false);

        return;
      }

      // No more cached — fetch from Firestore
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User not authenticated");

      const idToken = await currentUser.getIdToken(); // Get the Firebase ID token
      console.log(chatId, lastTimestamp);

      const url = new URL('https://vicinity-backend.onrender.com/messages/sync');
      url.searchParams.append('chatId', chatId);
      url.searchParams.append('limit', '40');
      url.searchParams.append('before', String(lastTimestamp || 0));

      console.log('Fetching messages from URL:', url.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`, // Add Bearer token for authentication
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.log(error);
        throw new Error(`Error ${response.status}: ${error.error}`);
      }
      const data = await response.json();
      const fetchedMessages: Message[] = data.messages;

      if (fetchedMessages.length < MESSAGES_PAGE_SIZE) {
        setHasMore(false);
      }
      if (fetchedMessages.length > 0) {

        setMessages((prevMessages) => {
          const combined = [...fetchedMessages, ...prevMessages];
          return combined.sort((a, b) => b.timestamp - a.timestamp) as Message[];
        });
        syncMessages(fetchedMessages, lastTimestamp || 0);
        setLastTimestamp(fetchedMessages[fetchedMessages.length - 1].timestamp);
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, chatId, lastTimestamp, offset, setMessages, syncMessages]);

  const onEndReached = () => {
    if (messages.length >= 40) {
      loadMessages();
    }
  };
  //let the error be here




  const handleSend = async () => {
    if (!inputText.trim() && !attachedMedia) return; // Ensure either text or media is present
    if (!currentUserId) {
      console.log("No user found");
      return;
    }
    console.log('currentUserId:', currentUserId);
    let media = null;
    if (attachedMedia) {
      console.log('attachedMedia:', attachedMedia);
      try {
        setUploading(true);
        const response = await fetch(attachedMedia.uri);
        const blob = await response.blob();

        const storageRef = ref(storage, `chats/${chatId}/${attachedMedia.filename}`);
        const uploadTask = uploadBytesResumable(storageRef, blob);
        uploadTaskRef.current = uploadTask;

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = snapshot.bytesTransferred / snapshot.totalBytes;
            setUploadProgress(progress);
          },
          (error) => {
            if (error.code === 'storage/canceled') {
              console.log('Upload canceled');
            } else {
              console.error('Upload failed:', error);
            }
            setUploading(false);
            setUploadProgress(0);
            setAttachedMedia(null);
            uploadTaskRef.current = null;
          },
          async () => {
            console.log('Upload complete');
            media = await getDownloadURL(storageRef);
            setUploading(false);
            setUploadProgress(0);
            uploadTaskRef.current = null;
          }
        );

        await uploadTask;
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
    const messageId = chatId + `${Date.now()}_${nanoid(6)}`;

    const messageToDisplay = {
      id: messageId,
      text: inputText,
      sender: currentUserId,
      timestamp: Date.now(),
      media: media || null,
      replyTo: replyTo || null,
      delivered: false,
      seen: false,
    };
    setShowDivider(false);
    setMessages(prevMessages => [messageToDisplay, ...prevMessages]);
    insertMessage(messageToDisplay, chatId, receiver);
    const inptext = inputText;
    const reply = replyTo;
    setInputText('');
    setReplyTo(null);



    const newMessage = {
      id: messageId, // unique id for the message
      sender: currentUserId,
      receiver: receiver,
      timestamp: Date.now(),
      replyTo: reply || null,
      delivered: false,
      seen: false,
    };
    try {

      // Add the message to Firestore
      const chatsRef = collection(db, 'chats');
      const chatDocRef = doc(chatsRef, chatId);
      const chatDoc = await getDoc(chatDocRef); // Check if the document exists
      if (!chatDoc.exists) {
        await setDoc(chatDocRef, {
          participants: [currentUserId, receiver],
        }, { merge: true });
      }
      const messagesRef = doc(db, 'chats', chatId, 'messages', messageId);
      await setDoc(messagesRef, {
        ...newMessage,
      });

      const userToken = await auth.currentUser?.getIdToken();
      const response = await fetch("https://vicinity-backend.onrender.com/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`, // Firebase ID token
        },
        body: JSON.stringify({
          chatId,
          text: inptext,
          media,
          messageId,
        }),
      });

      console.log(response);

    } catch (error) {
      console.error('Error sending message:', error);
    }
    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        message.id === messageId ? { ...message, delivered: true } : message
      )
    );
    messageToDisplay.delivered = true;
    insertMessage(messageToDisplay, chatId, receiver);
    setReplyTo(null);
    // setMedia(null); // Clear media after sending
    setUploadProgress(0);
    let nmessage = { ...messageToDisplay, chatId: chatId, receiver: receiver };
    sendDMNotification([receiverDetails?.fcmToken], nmessage);
    socket.emit('send-dm', { message: nmessage });
  };

  const handleAttachMedia = async () => {
    setShowDivider(false);
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

  const handleReply = (message: Message) => {
    setReplyTo(message.id);
    inputRef.current?.focus();
  };



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
          onPress: () => confirmDelete(messageId),
        },
      ],
      { cancelable: true }
    );

  };

  const confirmDelete = async (messageId: string): Promise<void> => {
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;
    if (isOffline) {
      setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
      await deleteMessage(messageId);
      await insertIntoDeletedMessages(messageId, chatId, receiver);
      return;
    }
    try {
      // Remove the message from the local state
      setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));

      await deleteMessage(messageId);
      socket.emit('message-deleted', { messageId: messageId, chatId: chatId, receiver: receiver });

      // Reference to the message in Firestore
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (messageDoc.exists) {
        const messageData = messageDoc.data();
        // console.log('Message data:', messageData);

        // Check if the message has media
        if (messageData?.media) {
          const userToken = await auth.currentUser?.getIdToken();

          try {
            await fetch("https://vicinity-backend.onrender.com/delete-media", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userToken}`, // Firebase ID token
              },
              body: JSON.stringify({
                media: messageData.media,
                messageId: messageId,
              }),
            });
          } catch (error) {
            console.error('Error deleting media:', error);
          }

        }

        // Delete the message from Firestore
        await deleteDoc(messageRef);
        console.log('Message deleted successfully from Firestore');
      } else {
        console.error('Message does not exist in Firestore');
      }
      setShowDivider(false);
      sendDeleteNotification([receiverDetails?.fcmToken], messageId);
    } catch (error) {
      console.error('Error deleting message or media:', error);
    }
  };

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (text: string) => {
    if (text.trim()) {
      socket.emit('typing', { chatId: chatId, receiver: receiver });

    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('StoppedTyping', { chatId: chatId, receiver: receiver });
    }, 2000);

  }


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


  const inputRef = useRef<TextInput>(null);
  const getTextfromId = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    return message ? message.text : '';
  };

  const MemoizedHeader = useCallback(() => {
    return (
      <DownloadHeader
        visible={modalVisible}
        onDownload={() =>
          downloadAndSaveToGallery(
            selectedMedia || '',
            getFileNameFromUrl(selectedMedia || '')
          )
        }
      />);
  }, [selectedMedia, downloadAndSaveToGallery, modalVisible]);



  const renderMessage = ({ item, index }: { item: DecoratedMessage, index: Number }) => {

    if (item.type === 'divider') {
      const label = moment(item.date).calendar(null, {
        sameDay: '[Today]',
        lastDay: '[Yesterday]',
        lastWeek: 'dddd',
        sameElse: 'MMMM D, YYYY',
      });
      return (
        <View className="flex-row justify-center items-center my-2">
          <View className="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm">
            <Text className="text-xs text-gray-800 dark:text-gray-200 font-large">{label}</Text>
          </View>
        </View>

      );
    }

    const isMine = item.sender === currentUserId;
    const isHighlighted = item.id === highlightedMessageId;
    const ToshowDivider = index === unreadIndex;

    const scrollToMessageById = (messageId: string) => {
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
      if (item.replyTo) {
        scrollToMessageById(item.replyTo);
      } else {
        console.error("could not find the message");
      }
    };

    const handleLongPress = () => {
      Clipboard.setString(item.text);
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    };



    return (
      <View>
        <View>
          {showDivider && ToshowDivider && (
            <View className="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm mb-2">
              <Text className="text-xs text-gray-800 dark:text-gray-200 font-large">New Messages</Text>
            </View>
          )}
        </View>

        <View
          className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
            } ${isHighlighted ? 'border-2 border-yellow-400' : ''}`}
        >

          {item.replyTo && (
            <TouchableOpacity onPress={handleScrollToReply}>
              <View className="mb-1 border-l-2 border-white pl-2">
                <Text className="text-white text-xs italic">Reply: {getTextfromId(item.replyTo)}</Text>
              </View>
            </TouchableOpacity>
          )}
          {item.media ? renderMedia(item.media as string, () => handleMediaPress(item.media as string)) : null}
          <Pressable onLongPress={handleLongPress}>
            <Text className="text-white">{item.text}</Text>
          </Pressable>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-300">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View className="flex-row gap-x-2">
              <TouchableOpacity onPress={() => handleReply(item)}>
                <Ionicons name="return-up-back-outline" size={16} color="white" />
              </TouchableOpacity>
              {isMine && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={16} color="white" />
                </TouchableOpacity>
              )}
              {isMine && item.delivered && !item.seen && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
              {isMine && item.seen && (
                <Ionicons name="checkmark-done" size={16} color="white" />
              )}
            </View>
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
      {isSearching ? (
  <View className="px-4 pt-3 bg-black">
    <View className="flex-row items-center bg-zinc-800 rounded-xl px-3 py-2">
      <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
      <TextInput
        placeholder="Search messages"
        placeholderTextColor="#ccc"
        value={searchText}
        onChangeText={setSearchText}
        className="flex-1 text-white"
        autoFocus
      />
      <TouchableOpacity onPress={() => {
        setSearchText('');
        // setSelectedDate(null);
        setIsSearching(false);
      }}>
        <Ionicons name="close" size={20} color="white" />
      </TouchableOpacity>
    </View>

    {/* <TouchableOpacity
      onPress={() => setShowDatePicker(true)}
      className="mt-2 p-2 rounded bg-zinc-700 flex-row items-center justify-center"
    >
      <Ionicons name="calendar" size={18} color="white" style={{ marginRight: 6 }} />
      <Text style={{ color: 'white' }}>
        {selectedDate ? selectedDate.toDateString() : 'Filter by Date'}
      </Text>
    </TouchableOpacity>

    {showDatePicker && (
      <DateTimePicker
        value={selectedDate || new Date()}
        mode="date"
        display="default"
        onChange={(event, date) => {
          setShowDatePicker(false);
          if (date) setSelectedDate(date);
        }}
      />
    )} */}
  </View>
) : (
  receiverDetails && (
    <TouchableOpacity
      onPress={() => {
        navigation.navigate('ChatUserProfile', {
          chatId: chatId,
          receiverDetails: receiverDetails,
        });
      }}
    >
      <View style={styles.statusBar}>
        <Image source={{ uri: receiverDetails.profilePic ?? '' }} style={styles.profilePic} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{receiverDetails.username}</Text>
          {typing && <Text style={styles.status}>Typing...</Text>}
          {receiverDetails.status && !typing && <Text style={styles.status}>{receiverDetails.status}</Text>}
          {receiverDetails.lastSeen && <Text style={styles.status}>Last seen: {receiverDetails.lastSeen}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setIsSearching(true)}
          style={{ position: 'absolute', right: 16 }}
        >
          <Ionicons name="search" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
)}
{/* {receiverDetails && (
<Animated.View style={[receiverStyle]}>
  <TouchableOpacity
    onPress={() => {
      navigation.navigate('ChatUserProfile', {
        chatId: chatId,
        receiverDetails: receiverDetails,
      });
    }}
  >
    <View style={styles.statusBar}>
      <Image source={{ uri: receiverDetails.profilePic }} style={styles.profilePic} />
      <View style={styles.userInfo}>
        <Text style={styles.username}>{receiverDetails.username}</Text>
        {typing && <Text style={styles.status}>Typing...</Text>}
        {receiverDetails.status && !typing && (
          <Text style={styles.status}>{receiverDetails.status}</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={toggleSearch}
        style={{ position: 'absolute', right: 16 }}
      >
        <Ionicons name="search" size={20} color="white" />
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Animated.View>)}

{showSearchBar.value && (

<Animated.View style={[searchBarStyle]}>
  <View className="px-4 pt-3 bg-black">
    <View className="flex-row items-center bg-zinc-800 rounded-xl px-3 py-2">
      <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
      <TextInput
        placeholder="Search messages"
        placeholderTextColor="#ccc"
        value={searchText}
        onChangeText={setSearchText}
        className="flex-1 text-white"
        autoFocus
      />
      <TouchableOpacity onPress={toggleSearch}>
        <Ionicons name="close" size={20} color="white" />
      </TouchableOpacity>
    </View>

    <TouchableOpacity
      onPress={() => setShowDatePicker(true)}
      className="mt-2 p-2 rounded bg-zinc-700 flex-row items-center justify-center"
    >
      <Ionicons name="calendar" size={18} color="white" style={{ marginRight: 6 }} />
      <Text style={{ color: 'white' }}>
        {selectedDate ? selectedDate.toDateString() : 'Filter by Date'}
      </Text>
    </TouchableOpacity>

    {showDatePicker && (
      <DateTimePicker
        value={selectedDate || new Date()}
        mode="date"
        display="default"
        onChange={(event, date) => {
          setShowDatePicker(false);
          if (date) setSelectedDate(date);
        }}
      />
    )}
  </View>
</Animated.View>)
} */}




      <FlatList
        ref={flatListRef}
        data={decoratedMessages}
        inverted={true}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        initialNumToRender={10} // Optimize for large lists
        onEndReached={onEndReached}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
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
      <View className="px-4 py-3 bg-zinc-900 border-t border-zinc-700">
        {replyTo && (
          <View className="bg-zinc-800 px-4 py-2 border-l-4 border-blue-500 mb-2 relative rounded">
            <Text className="text-white text-xs">Replying to: {getTextfromId(replyTo)}</Text>
            <TouchableOpacity
              onPress={() => {
                setReplyTo(null); // Close reply
                inputRef.current?.blur();
              }}
              className="absolute top-1 right-2"
            >
              <Ionicons name="close" size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Row */}
        <View className="flex-row items-end">
          <TouchableOpacity onPress={handleAttachMedia} className="mr-3 mb-1">
            <Ionicons name="attach" size={24} color="white" />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={(text) => { setInputText(text); handleTyping(text); }}
            placeholder="Type a message"
            placeholderTextColor="#aaa"
            className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-xl max-h-[100px]"
            editable
            multiline
          />
          <TouchableOpacity onPress={handleSend} className="ml-3">
            <Ionicons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
        {uploading && (
          <View className="mt-2">
            <Text style={{ color: 'white' }}>
              Uploading: {(uploadProgress * 100).toFixed(0)}%
            </Text>
            <View style={{ height: 6, backgroundColor: '#444', borderRadius: 6, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${uploadProgress * 100}%`,
                  height: 6,
                  backgroundColor: 'dodgerblue',
                }}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                uploadTaskRef.current?.cancel();
                setUploading(false);
                setAttachedMedia(null);
                setUploadProgress(0);
              }}
              disabled={!uploadTaskRef.current}
              className="mt-2"
            >
              <Text style={{ color: 'red' }}>Cancel Upload</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      <Modal visible={modalVisible && (pressedFileExt === 'mp4' || pressedFileExt === 'mov')} transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 1 }}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ position: 'absolute', top: 40, left: 20, zIndex: 1 }}
            onPress={() => {
              if (selectedMedia) {
                downloadAndSaveToGallery(selectedMedia, getFileNameFromUrl(selectedMedia));
              }
            }}
          >
            <Ionicons name="download" size={32} color="white" />
          </TouchableOpacity>

          <Video
            source={{ uri: selectedMedia || undefined }}
            style={{ width: '100%', height: '100%' }}
            controls={true}
            resizeMode="contain"
            paused={false}
            onError={(error) => console.error('Video error:', error)}
          />


        </View>
      </Modal>
      <ImageViewing
        images={[{ uri: selectedMedia || '' }]}
        imageIndex={0}
        visible={modalVisible && (pressedFileExt === 'jpg' || pressedFileExt === 'jpeg' || pressedFileExt === 'png' || pressedFileExt === 'gif')}
        onRequestClose={() => setModalVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        backgroundColor="black"
        animationType="fade"
        HeaderComponent={MemoizedHeader}
      />
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
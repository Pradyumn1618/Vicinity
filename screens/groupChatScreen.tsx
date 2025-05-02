import React, { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  PermissionsAndroid,
  ToastAndroid,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import Clipboard from '@react-native-clipboard/clipboard';

import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  setDoc,
  deleteDoc,
  endBefore,
  limit,
  getDocs,
  startAt,
  startAfter,
  endAt,
} from '@react-native-firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { v4 as uuidv4 } from 'uuid';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from '@react-native-firebase/storage';
import moment from 'moment';
import { nanoid } from 'nanoid';
import { CheckAndLoadGroupMessage, getGroupUnreadCount, getGroupUnreadTimestamp, insertIntoDeletedGroupMessages, insertIntoDeletedMessages, resetGroupUnreadCount, resetUnreadCount, setGroupUnreadTimestamp } from '../helper/databaseHelper';
import { useChatContext } from '../context/chatContext';
import { send } from 'process';
import { sendGroupNotification } from '../helper/sendNotification';
import { launchImageLibrary } from 'react-native-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { useSocket } from '../helper/socketProvider';
import Video from 'react-native-video';
import FastImage from 'react-native-fast-image';
import { DownloadHeader } from '../components/downLoad';
import RenderGroupMessage from '../components/renderGrpMessage';
import ImageViewing from 'react-native-image-viewing';

interface Message {
  id: string;
  text: string;
  sender: string;
  senderName: string;
  timestamp: number;
  media?: string | null;
  replyTo?: { senderName: string, text: string, id: string } | null;
}

const GroupChatScreen = ({ route, navigation }) => {
  const { groupId } = route.params;
  const [inputText, setInputText] = useState('');
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const [currentUserDetails, setCurrentUser] = useState<any>(null);
  const [pressedFileExt, setPressedFileExt] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { setCurrentChatId, groupMessages, setGroupMessages, setUnreadChats } = useChatContext();
  const [typingStatus, setTypingStatus] = useState('');
  const typerList = useRef<string[]>([]);
  const socket = useSocket();
  const [unreadTimestamp, setUnreadTimestamp] = useState<number>(0);
  const hasScrolledToUnread = useRef(false);
  const [endTimestamp, setEndTimestamp] = useState<number>(0);


  useEffect(() => {
    const handleGroupTyping = (data) => {
      if (data.groupId === groupId) {
        if (!typerList.current.includes(data.typer)) {
          typerList.current.push(data.typer);
        }
        if (typerList.current.length == 1) {
          setTypingStatus(`${typerList.current[0]} is typing...`);
        } else if (typerList.current.length == 2) {
          setTypingStatus(`${typerList.current[0]} and ${typerList.current[1]} are typing...`);
        }
        else {
          setTypingStatus(`${typerList.current[0]} and ${typerList.current.length - 1} others are typing...`);
        }
      }
    };

    socket.on('group-typing', handleGroupTyping);
    socket.on('group-typing-stopped', (data) => {
      if (data.groupId === groupId) {
        const index = typerList.current.indexOf(data.typer);
        if (index !== -1) {
          typerList.current.splice(index, 1);
        }
        if (typerList.current.length === 0) {
          setTypingStatus('');
        } else if (typerList.current.length == 1) {
          setTypingStatus(`${typerList.current[0]} is typing...`);
        } else if (typerList.current.length == 2) {
          setTypingStatus(`${typerList.current[0]} and ${typerList.current[1]} are typing...`);
        }
        else {
          setTypingStatus(`${typerList.current[0]} and ${typerList.current.length - 1} others are typing...`);
        }
      }
    });

    return () => {
      socket.off('group-typing', handleGroupTyping);
      socket.off('group-typing-stopped');
    };
  }, [socket, groupId]);

  useLayoutEffect(() => {
    const getUnreadTimestamp = async () => {
      const timestamp = await getGroupUnreadTimestamp(groupId);
      if (timestamp) {
        setUnreadTimestamp(timestamp);
      } else {
        setUnreadTimestamp(0);
      }
      setUnreadTimestamp(timestamp);
    };
    getUnreadTimestamp();
  }, [groupId]);



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
        return groupMessages;
      }
      const lowerCaseSearchText = searchText.toLowerCase();
      const result = groupMessages.filter((message) => {
        const messageText = message.text.toLowerCase();
        return messageText.includes(lowerCaseSearchText);
      });
      console.log('Filtered messages:', result);
      setFilteredMessages(result);
    }
    filterMessages();
  }, [groupMessages, searchText, setFilteredMessages]);


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
    const getUserDetails = async () => {
      if (!currentUserId) {
        console.error('currentUserId is undefined');
        return;
      }
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists) {
        const userData = userSnap.data();
        // console.log('User data:', userData);
        setCurrentUser({
          id: currentUserId,
          username: userData?.username,
          photoURL: userData?.profilePic,
        });
      }
    };
    getUserDetails();
  }, [currentUserId, db]);

  useEffect(() => {
    const groupRef = doc(db, 'groups', groupId);
    const unsubscribe = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists) {
        setGroupDetails(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [groupId, db]);

  useEffect(() => {
    if (!groupId || unreadTimestamp == null) return;
    console.log('here');

    const fetchMessagesAroundUnread = async () => {
      setLoadingMore(true);
      try {
        const messagesRef = collection(db, 'groups', groupId, 'messages');

        // Query 1: Fetch 20 messages BEFORE unreadTimestamp
        const beforeQ = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          startAfter(unreadTimestamp),
          limit(50)
        );
        const beforeSnap = await getDocs(beforeQ);
        const beforeMessages = beforeSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Message))

        setEndTimestamp(beforeMessages[beforeMessages.length - 1]?.timestamp);

        // Query 2: Fetch ALL messages AFTER (or from) unreadTimestamp
        const afterQ = query(
          messagesRef,
          orderBy('timestamp', 'desc'),
          endAt(unreadTimestamp)
        );
        const afterSnap = await getDocs(afterQ);
        const afterMessages = afterSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));

        // Combine and set
        const combined = [...afterMessages, ...beforeMessages];
        setGroupMessages(combined);

        // Optional: Update unread timestamp cache
        setGroupUnreadTimestamp(groupId, afterMessages[0]?.timestamp);
        console.log('messages', combined);

      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMore(false);
      }
    };

    fetchMessagesAroundUnread();
  }, [groupId, unreadTimestamp, db, setGroupMessages]);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const onEndReached = async () => {
    if (!decoratedMessages || decoratedMessages.length === 0) return;
    if (loadingMore || !hasMore) return;
    if (!endTimestamp) return;
    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(groupMessages[groupMessages.length - 1].timestamp),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      console.log('endTimestamp', endTimestamp);
      console.log('fetchedNewMessages', newMessages);
      if (newMessages.length > 0) {
        setEndTimestamp(newMessages[newMessages.length - 1]?.timestamp);
        setGroupMessages(prevMessages => [...prevMessages, ...newMessages]);
      }
      if (newMessages.length < 100) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }

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
    return searchText.trim() === '' ? formatMessagesWithDateDividers(groupMessages) : formatMessagesWithDateDividers(filteredMessages);
  }, [groupMessages, formatMessagesWithDateDividers, searchText, filteredMessages]);

  const initialUnreadIndex = useMemo(() => {
    if (hasScrolledToUnread.current) return 0;

    const index = decoratedMessages.findIndex(
      (msg) => msg.type === 'message' && msg.timestamp >= unreadTimestamp
    );

    if (index !== -1) {
      hasScrolledToUnread.current = true;
      return index;
    }

    return 0;
  }, [decoratedMessages, unreadTimestamp]);


  useLayoutEffect(() => {
    const handleUnread = async () => {
      const count = await getGroupUnreadCount(groupId); // Fetch from SQLite

      if (count > 0) {
        setUnreadChats(prev => Math.max(prev - 1, 0)); // Avoid negative
        await resetGroupUnreadCount(groupId);
      }

      setCurrentChatId(groupId);
    };

    handleUnread();
  }, [groupId, setCurrentChatId, setUnreadChats]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedMedia, setAttachedMedia] = useState<{ uri: string; filename: string; type: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ senderName: string, text: string, id: string } | null>(null);
  const uploadTaskRef = useRef<any>(null);

  const uploadMedia = async (attachedMedia: { uri: string; filename: string; type: string }) => {
    try {
      setUploading(true);
      const response = await fetch(attachedMedia.uri);
      const blob = await response.blob();

      const storageRef = ref(storage, `chats/${groupId}/${attachedMedia.filename}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTaskRef.current = uploadTask;

      return new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = snapshot.bytesTransferred / snapshot.totalBytes;
            setUploadProgress(progress);
          },
          (error) => {
            if (error.code === 'storage/cancelled') {
              console.log('Upload canceled');
              reject(new Error('Upload canceled'));
            } else {
              console.error('Upload failed:', error);
              reject(error);
            }
            setUploading(false);
            setUploadProgress(0);
            setAttachedMedia(null);
            uploadTaskRef.current = null;
          },
          async () => {
            const downloadURL = await getDownloadURL(storageRef);
            console.log('Upload complete, download URL:', downloadURL);
            setUploading(false);
            setUploadProgress(0);
            setAttachedMedia(null);
            uploadTaskRef.current = null;
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error('Error during upload:', error);
      setUploading(false);
      setUploadProgress(0);
      setAttachedMedia(null);
      uploadTaskRef.current = null;
      throw error;
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !attachedMedia) return; // Ensure either text or media is present
    if (!currentUserId) {
      console.log("No user found");
      return;
    }
    console.log('currentUserId:', currentUserId);
    let media = null;
    if (attachedMedia) {
      try {
        media = await uploadMedia(attachedMedia); // Wait for the upload to complete
      } catch (error) {
        if (error.message === 'Upload canceled') {
          console.log('Upload was canceled, not sending media.');
          ToastAndroid.show('Upload was canceled', ToastAndroid.SHORT);
          return; // Exit the function if the upload was canceled
        }
        console.error('Upload failed:', error);
        ToastAndroid.show('Upload failed', ToastAndroid.SHORT);
        return;
      }
    }
    const messageId = groupId + `${Date.now()}_${nanoid(6)}`;

    const messageToDisplay = {
      id: messageId,
      text: inputText,
      sender: currentUserId,
      senderName: currentUserDetails?.username,
      timestamp: Date.now(),
      media: media || null,
      groupId: groupId,
      replyTo: replyTo || null,
      delivered: false,
    };
    // setShowDivider(false);
    setGroupMessages(prevMessages => [messageToDisplay, ...prevMessages]);
    // insertMessage(messageToDisplay, chatId, receiver);
    const inptext = inputText;
    const reply = replyTo;
    setInputText('');
    setReplyTo(null);
    let nmessage = { ...messageToDisplay, chatId: groupId };
    let NotiMessage = nmessage;
    if (!messageToDisplay.text) {
      NotiMessage = { ...nmessage, text: 'media' };
    }
    socket.emit('group-message', { message: messageToDisplay });
    console.log('media:', media);


    try {

      // Add the message to Firestore
      const chatsRef = collection(db, 'groups', groupId, 'messages');
      const messageRef = doc(chatsRef, messageId);
      console.log('message', messageToDisplay);
      await setDoc(messageRef, { ...messageToDisplay, delivered: true });
      setGroupMessages((prevMessages) => {
        console.log('prevMessages', prevMessages);

        const updated = prevMessages.map((message) => {
          if (message.id === messageId) {
            console.log('Matched message:', message);
            return { ...message, delivered: true };
          }
          return message;
        })
        console.log('updated', updated);
        return updated;

      }
      );
      setReplyTo(null);
      // setMedia(null); // Clear media after sending
      setUploadProgress(0);
      flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
      // setShowDivider(false);
      try {
        if (reply) {
          sendGroupNotification(groupId, NotiMessage, currentUserId, reply.id);
        } else {
          console.log('NotiMessage:', NotiMessage);
          sendGroupNotification(groupId, NotiMessage, currentUserId);

        }
      } catch (error) {
        console.error('Error sending group notification:', error);
      }
    } catch (error) {
      console.error('Error sending message:', error.message);

    }

  };

  const handleAttachMedia = async () => {
    // setShowDivider(false);
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
    setReplyTo({ senderName: message.senderName, text: message.text, id: message.id });
    inputRef.current?.focus();
  };


  const handleDelete = (messageId: string): void => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
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

  function extractStoragePathFromUrl(url) {
    const match = decodeURIComponent(url).match(/\/o\/(.+?)\?/);
    return match ? match[1] : null;
  }

  const confirmDelete = async (messageId: string): Promise<void> => {
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;
    if (isOffline) {
      setGroupMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
      // await deleteMessage(messageId);
      await insertIntoDeletedGroupMessages(messageId, groupId);
      return;
    }
    try {
      // Remove the message from the local state
      setGroupMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));

      // await deleteMessage(messageId);
      socket.emit('group-message-deleted', { messageId: messageId, groupId: groupId });

      // Reference to the message in Firestore
      const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (messageDoc.exists) {
        const messageData = messageDoc.data();
        // console.log('Message data:', messageData);

        // Check if the message has media
        if (messageData?.media) {
          const path = extractStoragePathFromUrl(messageData.media);
          console.log('path:', path);
          const mediaRef = ref(storage, path);
          // Delete the media from Firebase Storage
          await deleteObject(mediaRef);
          console.log('Media deleted successfully from Firebase Storage');
        }

        // Delete the message from Firestore
        await deleteDoc(messageRef);
        console.log('Message deleted successfully from Firestore');
      } else {
        console.error('Message does not exist in Firestore');
      }
      // setShowDivider(false);
      // sendDeleteNotification([receiverDetails?.fcmToken], messageId);
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

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (text: string) => {
    if (text.trim()) {
      socket.emit('group-typing', { groupId: groupId, typer: currentUserDetails?.username });

    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('group-typing-stopped', { groupId: groupId, typer: currentUserDetails?.username });
    }, 2000);

  }


  const inputRef = useRef<TextInput>(null);

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

  const getIndex = (
    messageId: string,
    timeout = 2000,
    interval = 100
  ): Promise<number | null> => {
    return new Promise((resolve) => {
      const start = Date.now();

      const check = () => {
        const index = decoratedMessages.findIndex((msg) => msg.id === messageId);
        if (index !== undefined) {
          resolve(index);
        } else if (Date.now() - start >= timeout) {
          resolve(null); // fallback after timeout
        } else {
          setTimeout(check, interval);
        }
      };

      check();
    });
  };

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);


  const scrollToMessageById = async (messageId: string) => {
    const targetIndex = decoratedMessages.findIndex((msg) => msg.id === messageId);
    console.log('targetIndex:', targetIndex);
    if (targetIndex !== undefined) {
      if (flatListRef.current) {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5, // keeps it mid-screen, feels smoother
        });
        setHighlightedMessageId(messageId); // for highlight effect
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    } else {
      const newMessages = await CheckAndLoadGroupMessage(groupId, messageId, groupMessages[groupMessages.length - 1].timestamp);
      if (!newMessages) {
        ToastAndroid.show('Could not find the message', ToastAndroid.SHORT);
        return;
      }
      setGroupMessages((prevMessages) => {
        const combined = [...prevMessages, ...newMessages];
        return combined;
      }
      );
      const index = await getIndex(messageId);
      if (index !== null) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 2000);
      } else {
        ToastAndroid.show('Could not scroll to message', ToastAndroid.SHORT);
      }

    }
  };

  const handleScrollToReply = (item: string) => {
    if (item) {
      scrollToMessageById(item);
    } else {
      console.error("could not find the message");
    }
  };

  const handleLongPress = (text: string) => {
    Clipboard.setString(text);
    ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
  };


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: 'black' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        </View>
      ) : (
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('GroupDetailsScreen', {
              groupId: groupId,
            });
          }}
        >
          {groupDetails && (
            <View style={styles.statusBar}>
              <Image source={{ uri: groupDetails.photoURL ?? '' }} style={styles.profilePic} />
              <Text style={styles.username}>{groupDetails.name}</Text>
              {typingStatus !== '' && <Text style={styles.status}>{typingStatus}</Text>}
            </View>
          )}
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={decoratedMessages}
        renderItem={({ item, index }) => {
          return (
            <RenderGroupMessage
              item={item}
              index={index}
              currentUserId={currentUserId}
              highlightedMessageId={highlightedMessageId}
              handleScrollToReply={handleScrollToReply}
              renderMedia={renderMedia}
              handleMediaPress={handleMediaPress}
              handleLongPress={handleLongPress}
              handleReply={handleReply}
              handleDelete={handleDelete}
            />
          )
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        initialNumToRender={10} // Optimize for large lists
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
        initialScrollIndex={initialUnreadIndex}
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
        extraData={highlightedMessageId}
        inverted
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
            <Text className="text-white text-sm bold">Replying to:{replyTo.senderName}</Text>
            <Text className="text-white text-xs"> {replyTo.text}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'white' }}>
                Uploading: {(uploadProgress * 100).toFixed(0)}%
              </Text>
              {uploadTaskRef.current && (
                <TouchableOpacity
                  onPress={() => {
                    if (uploadTaskRef.current) {
                      uploadTaskRef.current.cancel();
                      console.log('Upload cancel requested');
                    }
                  }}
                  disabled={!uploadTaskRef.current}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: 'red' }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ marginTop: 6, height: 6, backgroundColor: '#444', borderRadius: 6, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${uploadProgress * 100}%`,
                  height: 6,
                  backgroundColor: 'dodgerblue',
                }}
              />
            </View>
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
};

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

export default GroupChatScreen;


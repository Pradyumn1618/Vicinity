import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import {v4 as uuidv4} from 'uuid';

interface Message {
    id: string;
    text: string;
    sender: string;
    senderName: string;
    timestamp: number;
    media?: string | null;
    replyTo?: string | null;
  }

const GroupChatScreen = ({ route,navigation }) => {
  const { groupId } = route.params; // currentUser: { id, username, photoURL }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [groupDetails,setGroupDetails] = useState<any>(null);
  const flatListRef = useRef();
  const currentUser = auth().currentUser?.uid;
  const [currentUserDetails, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const getUserDetails = async () => {
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser)
        .get();
      const userData = userDoc.data();
      if (userData) {
        setCurrentUser({
          id: currentUser,
          username: userData.username,
          photoURL: userData.profilePic,
        });
      }
    };
    getUserDetails();
  }, [currentUser]);
  

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('groups')
      .doc(groupId)
      .onSnapshot(doc => {
        setGroupDetails(doc.data());
      });

    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(fetched);
      });

    return () => unsubscribe();
  }, [groupId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
  
    const messageId = groupId + '_' + uuidv4();
  
    await firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .doc(messageId) // Set the document ID manually
      .set({
        id: messageId, // Optionally store the ID in the document
        text: input,
        sender: currentUser,
        senderName: currentUserDetails?.username,
        timestamp: Date.now(),
      });
  
    setInput('');
  };

  const renderItem = ({ item }) => {
    const isCurrentUser = item.sender === currentUser;

    return (
      <View
        style={{
          alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
          backgroundColor: isCurrentUser ? '#4F46E5' : '#333',
          marginVertical: 4,
          marginHorizontal: 10,
          padding: 10,
          borderRadius: 12,
          maxWidth: '75%',
        }}
      >
        {!isCurrentUser && (
          <Text style={{ color: '#ccc', fontWeight: 'bold', marginBottom: 4 }}>
            {item.senderName}
          </Text>
        )}
        <Text style={{ color: 'white' }}>{item.text}</Text>
        {item.timestamp && (
          <Text style={{ color: '#aaa', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: 'black' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
        <TouchableOpacity
              onPress={() => {
                navigation.navigate('GroupDetailsScreen', {
                  groupId: groupId,
                });
              }}
            >{groupDetails &&
              <View style={styles.statusBar}>
                <Image source={{ uri: groupDetails.photoURL ?? '' }} style={styles.profilePic} />
                <Text style={styles.username}>{groupDetails.name}</Text>
                {/* <TouchableOpacity
                  onPress={() => setIsSearching(true)}
                  style={{ position: 'absolute', right: 16 }}
                >
                  <Ionicons name="search" size={20} color="white" />
                </TouchableOpacity> */}
              </View>}
            </TouchableOpacity>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingVertical: 10 }}
        inverted = {true}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#1e1e1e',
          padding: 10,
        }}
      >
        <TextInput
          placeholder="Type a message"
          placeholderTextColor="#aaa"
          value={input}
          onChangeText={setInput}
          style={{
            flex: 1,
            color: 'white',
            backgroundColor: '#333',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginRight: 8,
          }}
        />
        <TouchableOpacity onPress={sendMessage}>
          <Ionicons name="send" size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>
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

export default GroupChatScreen;



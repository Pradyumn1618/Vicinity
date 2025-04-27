import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, FlatList, Alert } from 'react-native';
import { Asset } from 'react-native-image-picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
import {v4 as uuidv4} from 'uuid';
import { sendNotification } from '../functions/lib';
import { sendAddedToGroupNotification } from '../helper/sendNotification';


interface User {
    id: string;
    username: string;
    photoURL: string;
    fcmToken?: string;
    }

export default function CreateGroupScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState<Asset | null>(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [description,setDescription] = useState('');

  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  const handleImagePick = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      setGroupImage(result.assets[0]);
    }
  };

  const handleUserSearch = async (text:string) => {
    setSearchText(text);
    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const snapshot = await firestore()
      .collection('users')
      .where('username', '>=', text)
      .where('username', '<=', text + '\uf8ff')
      .limit(10)
      .get();

    const users = snapshot.docs.map(doc => ({ id: doc.id, photoURL:doc.data().profilePic, username:doc.data().username, fcmToken:doc.data().fcmToken }));
    setSearchResults(users);
  };

  const toggleUserSelection = (user:User) => {
    const exists = selectedUsers.find((u) => u.id === user.id);
    if (exists) {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      if(selectedUsers.length >= 200){
        Alert.alert('Limit Reached', 'You can only add up to 200 members to a group.');
        return;
      }
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const createGroup = async () => {
    let imageURL = null;
    try{
    if (groupImage) {
      const ref = storage().ref(`/groupImages/${Date.now()}.jpg`);
      if (groupImage?.uri) {
        await ref.putFile(groupImage.uri);
      } else {
        throw new Error('Group image URI is undefined');
      }
      imageURL = await ref.getDownloadURL();
    }

    const groupId = 'group_' + uuidv4();
    const groupDoc = await firestore().collection('groups').doc(groupId).set({
      id:groupId,
      name: groupName,
      photoURL: imageURL,
      members: [...selectedUsers.map((u) => u.id),userId],
      admins: [userId],
      createdAt: Date.now(),
      Description: description,
      joinTimes: {
        ...(userId ? { [userId]: Date.now() } : {}),
        ...selectedUsers.reduce((acc: Record<string, number>, user) => {
          acc[user.id] = Date.now();
          return acc;
        }, {} as Record<string, number>)
      }
    });


    // Add the group ID to the `groups` field for all users
    const allUsers = [...selectedUsers.map((u) => u.id), userId];
    const batch = firestore().batch();

    allUsers.forEach((userId) => {
      const userRef = firestore().collection('users').doc(userId);
      batch.update(userRef, {
        groups: firestore.FieldValue.arrayUnion(groupId),
      });
    });

    await batch.commit();

    sendAddedToGroupNotification(selectedUsers.map((u) => u.fcmToken).filter((token): token is string => token !== undefined), groupName, groupId, userId || '');

    navigation.replace('GroupChatScreen', { groupId: groupId });
}catch(error){
    console.error(error.message);
}
  };

  return (
    <View className="flex-1 bg-black px-4 py-6">
      <Text className="text-white text-xl font-bold mb-4">Create New Group</Text>

      <TouchableOpacity onPress={handleImagePick} className="items-center mb-4">
        {groupImage ? (
          <Image source={{ uri: groupImage.uri }} className="w-24 h-24 rounded-full" />
        ) : (
          <View className="w-24 h-24 rounded-full bg-zinc-700 justify-center items-center">
            <Ionicons name="camera" size={30} color="white" />
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        placeholder="Group Name"
        placeholderTextColor="#999"
        value={groupName}
        onChangeText={setGroupName}
        className="bg-zinc-800 text-white px-4 py-3 rounded-xl mb-4"
      />

      <TextInput
      placeholder="Description"
      placeholderTextColor="#999"
      value={description}
        onChangeText={setDescription}
        className="bg-zinc-800 text-white px-4 py-3 rounded-xl mb-4"

      />

      <TouchableOpacity
        onPress={() => setSearchModalVisible(true)}
        className="bg-zinc-700 rounded-xl px-4 py-3 mb-4"
      >
        <Text className="text-white text-center">Add Members ({selectedUsers.length})</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={createGroup}
        className="bg-indigo-600 rounded-xl px-4 py-3 mt-2"
      >
        <Text className="text-white text-center font-bold">Create Group</Text>
      </TouchableOpacity>

      <Modal isVisible={searchModalVisible} onBackdropPress={() => setSearchModalVisible(false)}>
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12 }}>
          <TextInput
            placeholder="Search users..."
            value={searchText}
            onChangeText={handleUserSearch}
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              padding: 8,
              marginBottom: 12,
            }}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const selected = selectedUsers.some((u) => u.id === item.id);
              return (
                <TouchableOpacity
                  onPress={() => toggleUserSelection(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#eee',
                  }}
                >
                  <Image
                    source={{ uri: item.photoURL }}
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                  />
                  <Text style={{ flex: 1 }}>{item.username}</Text>
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color="black" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

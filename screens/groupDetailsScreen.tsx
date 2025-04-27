import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';

import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  FieldPath,
  setDoc,
  limit,
} from '@react-native-firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { getAuth } from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';
import * as Progress from 'react-native-progress';
import ImageViewing from "react-native-image-viewing";
import { sendAddedToGroupNotification } from '../helper/sendNotification';

const Tab = createMaterialTopTabNavigator();
const documentId = firestore.FieldPath.documentId();
const storage = getStorage();

interface User {
  id: string;
  username: string;
  photoURL: string;
  fcmToken: string;
}

const GroupInfoTab = ({ groupId }) => {
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState(20);
  const firestore = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser?.uid;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState(null);


  const isAdmin = group?.admins?.includes(currentUser);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showDescPrompt, setShowDescPrompt] = useState(false);


  useEffect(() => {
    const unsubscribe = onSnapshot(doc(firestore, 'groups', groupId), (docSnap) => {
      setGroup(docSnap.data());
    });

    return unsubscribe;
  }, [groupId, firestore]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (group?.members?.length) {
        const userIds = group.members.slice(0, batch);
        const usersRef = collection(firestore, 'users');

        // You can only pass up to 10 IDs at a time with documentId()
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10));
        }

        let allDocs = [];
        for (const chunk of chunks) {
          const q = query(usersRef, where(documentId, 'in', chunk));
          const snapshot = await getDocs(q);
          allDocs = allDocs.concat(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        setMembers(allDocs);
      }
    };

    fetchMembers();
  }, [group, batch, firestore]);

  const handleUserSearch = async (text: string) => {
    setSearchText(text);
    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const usersRef = collection(firestore, 'users');
    const q = query(
      usersRef,
      where('username', '>=', text),
      where('username', '<=', text + '\uf8ff'),
      orderBy('username'),
      limit(10)
    );
    const snapshot = await getDocs(q);

    const users = snapshot.docs.map(doc => ({ id: doc.id, photoURL: doc.data().profilePic, username: doc.data().username, fcmToken: doc.data().fcmToken }));
    const FilteredUsers = users.filter(user => !group?.members.includes(user.id));
    setSearchResults(FilteredUsers);
  };

  const toggleUserSelection = (user: User) => {
    const exists = selectedUsers.find((u) => u.id === user.id);
    if (exists) {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      if (selectedUsers.length + group?.members.length >= 200) {
        Alert.alert('Limit Reached', 'You can only add up to 200 members to a group.');
        return;
      }
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const sendNotification = async (users: User[]) => {
    const fcmTokens = users.map(user => user.fcmToken).filter(token => token);
    if (fcmTokens.length === 0) return;

    try {
      sendAddedToGroupNotification(fcmTokens, group.name, groupId, currentUser || '');
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No users selected', 'Please select at least one user to add.');
      return;
    }

    try {
      const groupRef = doc(firestore, 'groups', groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(...selectedUsers.map(user => user.id)),
      });

      const allUsers = selectedUsers.map((u) => u.id);
      const b = firestore.batch();

      allUsers.forEach((userId) => {
        const userRef = doc(firestore, 'users', userId);
        b.update(userRef, {
          groups: arrayUnion(groupId),
        });
      });

      await b.commit();
      setSearchModalVisible(false);
      sendNotification(selectedUsers);
      setSearchText('');
      setSelectedUsers([]);
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Failed to add members. Please try again.');
    }
  }

  const handleRemove = (userId) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const groupRef = doc(firestore, 'groups', groupId);
          await updateDoc(groupRef, {
            members: arrayRemove(userId),
            admins: arrayRemove(userId),
          });
        },
      },
    ]);
  };

  const handleMakeAdmin = async (userId) => {
    const groupRef = doc(firestore, 'groups', groupId);
    await updateDoc(groupRef, {
      admins: arrayUnion(userId),
    });
  };

  function extractStoragePathFromUrl(url) {
    const match = decodeURIComponent(url).match(/\/o\/(.+?)\?/);
    return match ? match[1] : null;
  }

  const uploadGroupImage = async (uri, previous_url) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `/groupImages/${Date.now()}.jpg`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      setUploading(true);
      setUploadProgress(0);

      // Wait for the upload to complete
      await new Promise((resolve, reject) => {
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
            reject(error); // Reject the promise on error
          },
          async () => {
            console.log('Upload complete');
            const media = await getDownloadURL(storageRef); // Get the download URL
            console.log('File available at', media);
            setUploading(false);
            setUploadProgress(0);
            resolve(media); // Resolve the promise with the download URL
          }
        );
      });

      if (previous_url) {
        const path = extractStoragePathFromUrl(previous_url);
        if (!path) {
          console.error('Invalid URL format:', previous_url);
        }
        const previousRef = ref(storage, path);
        try {
          deleteObject(previousRef);
          console.log('Previous image deleted successfully');
        } catch (error) {
          console.error('Error deleting previous image:', error);
        }
      }

      // Return the download URL
      return await getDownloadURL(storageRef);
    } catch (error) {
      setUploading(false);
      setUploadProgress(0);
      console.error('Error uploading image:', error);
      return null; // Return null on error
    }

    // Delete the previous image if it exists

  };

  return (
    <View className="flex-1 bg-black p-4">
      {group && (
        <View className="items-center mb-4">
          <TouchableOpacity
            onPress={() => {
              setImageModalVisible(true);
              setImageUri(group.photoURL);
            }}
          >
            {/* <Image source={{ uri: group.photoURL }} className="w-24 h-24 rounded-full" /> */}
            <View style={{ position: 'relative', width: 120, height: 120 }}>
              <Image
                source={{ uri: group.photoURL }}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                }}
              />

              {uploading && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 100,
                    borderRadius: 60, // optional: to match image roundness
                  }}
                >
                  <Progress.Circle
                    size={60}
                    progress={uploadProgress}
                    showsText={true}
                    color="#4F46E5"
                    thickness={4}
                    textStyle={{ color: 'white', fontSize: 12 }}
                  />
                </View>
              )}
            </View>

          </TouchableOpacity>
          <TouchableOpacity
            disabled={!isAdmin}
            onPress={async () => {
              if (!isAdmin) return;
              const result = await launchImageLibrary({ mediaType: 'photo' });
              if (!result.didCancel && result.assets?.[0]?.uri) {
                const newPhotoURL = await uploadGroupImage(result.assets[0].uri, group.photoURL);
                console.log('New photo URL:', newPhotoURL);
                const groupRef = doc(firestore, 'groups', groupId);
                await setDoc(groupRef, { photoURL: newPhotoURL }, { merge: true });
              }
            }}
            className="relative"
          >
            {uploading && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  zIndex: 100,
                }}
              >
                <Progress.Circle
                  size={60}
                  progress={uploadProgress}
                  showsText={true}
                  color="#4F46E5"
                  thickness={4}
                  textStyle={{ color: 'white', fontSize: 12 }}
                />
              </View>
            )}
            <>
              <Ionicons
                name="camera"
                size={24}
                color="white"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: '#4F46E5',
                  borderRadius: 50,
                  padding: 6,
                }}
              />
              {/* {isAdmin && <Text className="text-blue-400 mt-1 text-xs">Change Group Photo</Text>} */}
            </>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => isAdmin && setShowNamePrompt(true)}>
            <Text className="text-white text-xl font-bold mt-2">
              {group.name}
              {isAdmin && <Ionicons name="pencil" size={16} color="#aaa" />}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => isAdmin && setShowDescPrompt(true)}>
            <Text className="text-gray-400 mt-1">
              {group.description || 'No description'}
              {isAdmin && <Ionicons name="pencil" size={14} color="#aaa" />}
            </Text>
          </TouchableOpacity>

          <EditPrompt
            visible={showNamePrompt}
            title="Edit Group Name"
            defaultValue={group.name}
            onClose={() => setShowNamePrompt(false)}
            onSubmit={async (text) => {
              if (text?.trim()) {
                await updateDoc(doc(firestore, 'groups', groupId), { name: text.trim() });
              }
            }}
          />

          <EditPrompt
            visible={showDescPrompt}
            title="Edit Description"
            defaultValue={group.description}
            onClose={() => setShowDescPrompt(false)}
            onSubmit={async (text) => {
              await updateDoc(doc(firestore, 'groups', groupId), { description: text.trim() });
            }}
          />

        </View>
      )}



      <TextInput
        placeholder="Search members"
        placeholderTextColor="#aaa"
        value={search}
        onChangeText={setSearch}
        className="bg-zinc-800 text-white rounded-xl px-4 py-2 mb-4"
      />

      <FlatList
        data={members && members.filter(m => m.username.toLowerCase().includes(search.toLowerCase()))}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between p-2 bg-zinc-900 mb-2 rounded-xl">
            <View className="flex-row items-center">
              <Image source={{ uri: item.profilePic }} className="w-10 h-10 rounded-full mr-3" />
              <View className="flex-row items-center">
                {item.id !== currentUser && <Text className="text-white font-semibold">{item.username}</Text>}
                {item.id === currentUser && <Text className="text-white font-semibold">You</Text>}

                {group?.admins?.includes(item.id) && (
                  <Text
                    className="text-gray-400 font-semibold ml-2 px-2 py-1 rounded-full bg-gray-800"
                    style={{
                      marginLeft: 8, // Add space between username and "Admin"
                      fontSize: 12, // Adjust font size for better appearance
                    }}
                  >
                    Admin
                  </Text>
                )}
              </View>
            </View>
            {isAdmin && item.id !== currentUser && (
              <View className="flex-row">
                <TouchableOpacity onPress={() => handleMakeAdmin(item.id)} className="mr-3">
                  <Ionicons name="person-add" size={20} color="#4F46E5" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemove(item.id)}>
                  <Ionicons name="remove-circle" size={20} color="red" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {group?.members?.length > members.length && (
        <TouchableOpacity onPress={() => setBatch(batch + 20)} className="mt-3">
          <Text className="text-blue-400 text-center">View more</Text>
        </TouchableOpacity>
      )}

      {isAdmin && (

        <TouchableOpacity
          onPress={() => {setSearchModalVisible(true);}}
          className="bg-zinc-700 rounded-xl px-4 py-3 mb-4 flex-row items-center justify-center"
        >
          <Ionicons name="person-add" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white text-center">Add Members</Text>
        </TouchableOpacity>
      )

      }

      <Modal isVisible={searchModalVisible} onBackdropPress={() => {setSearchModalVisible(false); setSelectedUsers([]); setSearchText('');setSearchResults([]);}}>
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
              color: 'black',
              backgroundColor: 'white',
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

        <TouchableOpacity
          onPress={handleAddMembers}
          className="bg-indigo-600 rounded-xl px-4 py-3 mt-2"
        >
          <Text className="text-white text-center font-bold">Add Selected Members ({selectedUsers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setSearchModalVisible(false); setSelectedUsers([]); setSearchText('');setSearchResults([]); }}

          className="bg-red-600 rounded-xl px-4 py-3 mt-2"
        >
          <Text className="text-white text-center font-bold">Cancel</Text>
        </TouchableOpacity>
      </Modal>

      <ImageViewing
        images={[{ uri: imageUri || '' }]}
        imageIndex={0}
        visible={imageModalVisible && !uploading}
        onRequestClose={() => { setImageModalVisible(false); setImageUri(null); }}
        animationType="fade"
        presentationStyle="overFullScreen"
        backgroundColor="rgba(0, 0, 0, 0.8)"
        swipeToCloseEnabled={true}
      />

      <TouchableOpacity
        onPress={() => {
          Alert.alert('Leave Group', 'Are you sure?', [
            { text: 'Cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                const groupRef = doc(firestore, 'groups', groupId);
                await updateDoc(groupRef, {
                  members: arrayRemove(currentUser),
                  admins: arrayRemove(currentUser),
                });
              },
            },
          ]);
        }}
        className="mt-6 py-3 rounded-xl bg-red-600"
      >
        <Text className="text-center text-white font-bold">Leave Group</Text>
      </TouchableOpacity>
    </View>
  );
};

const EditPrompt = ({ visible, onClose, onSubmit, defaultValue, title }) => {
  const [input, setInput] = useState(defaultValue || '');

  return (
    <Modal isVisible={visible} animationIn="fadeIn" animationOut="fadeOut" style={{ margin: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <View className="flex-1 justify-center items-center bg-black/50 px-4">
        <View className="bg-white w-full rounded-xl p-4">
          <Text className="text-lg font-bold mb-2">{title}</Text>
          <TextInput
            className="border rounded-md px-3 py-2 mb-4"
            placeholder="Enter text"
            value={input}
            onChangeText={setInput}
          />
          <View className="flex-row justify-end">
            <TouchableOpacity onPress={onClose}>
              <Text className="text-blue-500 mr-4">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onSubmit(input);
                onClose();
              }}
            >
              <Text className="text-blue-700 font-bold">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const GroupMediaTab = ({ groupId }) => {
  const [media, setMedia] = useState([]);
  const firestore = getFirestore();

  useEffect(() => {
    const q = query(
      collection(firestore, 'groups', groupId, 'messages'),
      where('media', '!=', null)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        url: doc.data().media,
        timestamp: doc.data().timestamp?.toMillis?.() || 0,
      }));
      setMedia(fetched.sort((a, b) => b.timestamp - a.timestamp));
    });

    return unsubscribe;
  }, [groupId, firestore]);

  const renderItem = ({ item }) => (
    <Image
      source={{ uri: item.url }}
      className="w-1/3 aspect-square m-1 rounded-lg border border-gray-700"
      resizeMode="cover"
    />
  );

  return (
    <View className="flex-1 bg-black">
      {media.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-400 text-base">No media found in this group</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => item.id}
          numColumns={3}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 4 }}
        />
      )}
    </View>
  );
};


const GroupDetailsScreen = ({ route }) => {
  const { groupId } = route.params;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#111' },
        tabBarActiveTintColor: 'white'
      }}
    >
      <Tab.Screen name="Group Info">
        {() => <GroupInfoTab groupId={groupId} />}
      </Tab.Screen>
      <Tab.Screen name="Media">
        {() => <GroupMediaTab groupId={groupId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default GroupDetailsScreen;

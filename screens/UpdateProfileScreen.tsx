import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, Button, ActivityIndicator, Alert } from 'react-native';
import { getFirestore, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { getStorage, ref } from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import * as ImagePicker from 'react-native-image-picker';
import { NavigationProp } from '@react-navigation/native';

interface UpdateProfileScreenProps {
    navigation: NavigationProp<any>;
    }

const db = getFirestore();
const storage = getStorage();




const UpdateProfileScreen = ({ navigation }:UpdateProfileScreenProps) => {
  const currentUser = auth().currentUser;
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const fetchProfileData = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists) {
          const data = userDoc.data();
          setUsername(data.username || '');
          setBio(data.bio || '');
          setProfilePic(data.profilePic || '');
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [currentUser]);

  const handleImagePick = async () => {
    ImagePicker.launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorMessage) {
          Alert.alert('Error', response.errorMessage);
          return;
        }
  
        const imageUri = response.assets?.[0]?.uri;
        if (imageUri) {
          setUploading(true);
          const fileName = `profile_${currentUser.uid}.jpg`;
          const imageRef = ref(storage, `profile_pictures/${fileName}`);
  
          try {
            // Upload file directly using putFile() instead of uploadBytes()
            const uploadTask = imageRef.putFile(imageUri);
  
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload is ${progress}% done`);
              },
              (error) => {
                Alert.alert('Upload Error', error.message);
                setUploading(false);
              },
              async () => {
                // Get download URL after upload is complete
                const downloadURL = await imageRef.getDownloadURL();
                setProfilePic(downloadURL);
                setUploading(false);
              }
            );
          } catch (error) {
            Alert.alert('Error', `Failed to upload image: ${error.message}`);
            setUploading(false);
          }
        }
      }
    );
  };
  
  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    setUploading(true);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        username,
        bio,
        profilePic: profilePic,
      });

      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#0000ff" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;

  return (
    <View className="flex-1 bg-white p-4">
      <View className="items-center mb-5">
        <Image
          source={profilePic ? { uri: profilePic } : { uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg' }}
          className="w-24 h-24 rounded-full"
        />
        <Button title="Change Profile Picture" onPress={handleImagePick} />
      </View>

      <Text className="text-lg font-bold">Username</Text>
      <TextInput
        className="border border-gray-300 rounded p-2 mb-4"
        value={username}
        onChangeText={setUsername}
      />

      <Text className="text-lg font-bold">Bio</Text>
      <TextInput
        className="border border-gray-300 rounded p-2 mb-4"
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <Button title="Save Changes" onPress={handleSave} disabled={uploading} />
    </View>
  );
};

export default UpdateProfileScreen;

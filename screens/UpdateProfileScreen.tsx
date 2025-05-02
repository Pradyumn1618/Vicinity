import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, Button, ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from 'react-native';
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

const UpdateProfileScreen = ({ navigation }: UpdateProfileScreenProps) => {
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f26e0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={
            profilePic
              ? { uri: profilePic }
              : { uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg' }
          }
          style={styles.profileImage}
        />
        <TouchableOpacity
          style={styles.changeImageButton}
          onPress={handleImagePick}
          disabled={uploading}
        >
          <Text style={styles.changeImageText}>Change Profile Picture</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter username"
        placeholderTextColor="#7A8290"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Enter bio"
        placeholderTextColor="#7A8290"
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton]}
          onPress={handleSave}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>{uploading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0B14', // Deep navy background
    padding: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0B14',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#4f26e0', // Purple border
    shadowColor: '#4f26e0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    marginBottom: 16,
  },
  changeImageButton: {
    backgroundColor: '#3B3D8A', // Deep indigo
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B3D8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  changeImageText: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F4F5F7',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1B1C2A', // Darker input background
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#F4F5F7',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 38, 224, 0.2)', // Subtle purple border
    shadowColor: '#4f26e0', // Purple shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  textArea: {
    height: 140,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#4f26e0', // Purple for save
    shadowColor: '#4f26e0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#FF6B6B', // Coral for cancel
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UpdateProfileScreen;
import React, { useState } from 'react';
import { View, TextInput, Button, Text, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import uuid from 'react-native-uuid';
import mmkv from '../storage';
import { useUser } from '../context/userContext';

const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB in bytes

interface CreatePostScreenProps {
  navigation: NavigationProp<any>;
}

const CreatePostScreen = ({ navigation }: CreatePostScreenProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useUser();

  const handleCreatePost = async () => {
    if (!title || !content) {
      Alert.alert('Missing Fields', 'Please enter both title and description');
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      // Upload each selected media file
      for (const uri of mediaUris) {
        const fileExtension = uri.split('.').pop();
        const filename = `${uuid.v4()}.${fileExtension}`;
        const reference = storage().ref(`posts/${filename}`);

        await reference.putFile(uri);
        const downloadUrl = await reference.getDownloadURL();
        uploadedUrls.push(downloadUrl);
      }

      // Generate uuid for the post
      const postId = "post_" + uuid.v4();

      // Store post data in Firestore
      const postRef = firestore().collection('posts').doc(postId);
      await postRef.set({
        id: postId,
        title,
        content,
        mediaUrls: uploadedUrls, // Save all media URLs
        createdAt: firestore.FieldValue.serverTimestamp(),
        geohash6: mmkv.getString("geohash"),
        geohash5: mmkv.getString("geohash").substring(0, 5),
        geohash4: mmkv.getString("geohash").substring(0, 4),
        userId: user.id,
        username: user.username,
        profilePic: user.profilePic,
      });

      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const handleMediaUpload = () => {
    launchImageLibrary(
      {
        mediaType: 'mixed',
        selectionLimit: 10,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          let totalSize = 0;
          const selectedAssets = response.assets.filter(asset => asset.uri && asset.fileSize);

          for (const asset of selectedAssets) {
            totalSize += asset.fileSize ?? 0;
          }

          if (totalSize > MAX_TOTAL_SIZE) {
            Alert.alert('File Size Limit', 'The total size of selected media must be less than 100MB.');
            return;
          }

          const selectedUris = selectedAssets.map(asset => asset.uri!) as string[];
          setMediaUris(selectedUris);
        } else if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Something went wrong.');
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Create New Post</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter post title"
          placeholderTextColor="#7A8290"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter post description"
          placeholderTextColor="#7A8290"
          value={content}
          onChangeText={setContent}
          multiline
        />

        <Text style={styles.label}>Image / Video (optional)</Text>
        <TouchableOpacity onPress={handleMediaUpload} style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>Upload Media</Text>
        </TouchableOpacity>

        {mediaUris.length > 0 && (
          <View style={styles.mediaContainer}>
            {mediaUris.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.createButton]}
            onPress={handleCreatePost}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>{uploading ? 'Creating...' : 'Create Post'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#4f26e0" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black', // Deep navy background
  },
  scrollContent: {
    padding: 28,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F4F5F7', // Soft white for text
    marginBottom: 28,
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(79, 38, 224, 0.3)', // Purple glow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
  uploadButton: {
    backgroundColor: '#3B3D8A', // Deep indigo for upload button
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3B3D8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  uploadButtonText: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaContainer: {
    marginBottom: 20,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 38, 224, 0.2)',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    backgroundColor: '#4f26e0', // Purple for create
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
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  uploadingText: {
    color: '#F4F5F7',
    fontSize: 16,
    marginTop: 10,
  },
});

export default CreatePostScreen;
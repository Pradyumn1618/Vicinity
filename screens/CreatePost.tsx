import React, { useState } from 'react';
import { View, TextInput, Button, Text, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import uuid from 'react-native-uuid';
import mmkv from '../storage';
import { useUser } from '../context/userContext';

interface CreatePostScreenProps {
  navigation: NavigationProp<any>;
}

const CreatePostScreen = ({ navigation }: CreatePostScreenProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const {user} = useUser();

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

      // Generare uuid for the post
      const postId = "post_"+uuid.v4();
      

      // Store post data in Firestore
      const postRef = firestore().collection('posts').doc(postId);
      await postRef.set({
        id: postId,
        title,
        content,
        mediaUrls: uploadedUrls, // Save all media URLs
        createdAt: firestore.FieldValue.serverTimestamp(),
        geohash6: mmkv.getString("geohash"),
        geohash5: mmkv.getString("geohash").substring(0,5),
        geohash4: mmkv.getString("geohash").substring(0,4),
        userId: user.id,
        username: user.username,
        profilePic: user.profilePic
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
          const selectedUris = response.assets.map(asset => asset.uri).filter(Boolean) as string[];
          setMediaUris(selectedUris);
        } else if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Something went wrong.');
        }
      }
    );
  };

  return (
    <View style={{ flex: 1 }}>
  <ScrollView className="flex-1 bg-zinc-900 p-6">
    <Text className="text-white text-2xl mb-4">Create New Post</Text>

    <Text className="text-white mb-1">Title</Text>
    <TextInput
      className="bg-white p-3 rounded-lg mb-4"
      placeholder="Enter post title"
      value={title}
      onChangeText={setTitle}
      style={{ fontSize: 16 }}
    />

    <Text className="text-white mb-1">Description</Text>
    <TextInput
      className="bg-white p-3 rounded-lg mb-4"
      placeholder="Enter post description"
      value={content}
      onChangeText={setContent}
      multiline
      style={{ fontSize: 16, height: 100, textAlignVertical: 'top' }}
    />

    <Text className="text-white mb-1">Image / Video (optional)</Text>
    <TouchableOpacity onPress={handleMediaUpload} className="bg-zinc-700 p-3 rounded-lg mb-4">
      <Text className="text-white text-center">Upload Media</Text>
    </TouchableOpacity>

    {mediaUris.length > 0 && (
      <View className="mb-4">
        {mediaUris.map((uri, index) => (
          <Image
            key={index}
            source={{ uri }}
            style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 10 }}
            resizeMode="cover"
          />
        ))}
      </View>
    )}

    <Button title={uploading ? 'Creating...' : 'Create Post'} onPress={handleCreatePost} disabled={uploading} />

    <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4">
      <Text className="text-white text-center">Cancel</Text>
    </TouchableOpacity>
  </ScrollView>

  {uploading && (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={{ color: 'white', marginTop: 10 }}>Uploading...</Text>
    </View>
  )}
</View>

  );
};

export default CreatePostScreen;

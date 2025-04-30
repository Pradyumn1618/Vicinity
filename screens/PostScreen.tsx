import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Platform, Alert } from 'react-native';
import { storage, loadCachedPosts, savePostsToCache, updatePostCacheAfterFetch } from './storage';
import NavigationBar from '../components/NavigationBar';
import { NavigationProp } from '@react-navigation/native';
import { requestLocationPermission, startLocationTracking } from '../helper/locationPermission';
import auth from '@react-native-firebase/auth';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';

interface PostScreenProps {
    navigation: NavigationProp<any>;
}

const PostScreen = ({ navigation }:PostScreenProps) => {

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      return;
    }
    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        if (Platform.OS === 'android') {
          try {
            const enableResult = await promptForEnableLocationIfNeeded();
            console.log('enableResult', enableResult);
            startLocationTracking(auth().currentUser?.uid || '');
          } catch (error: unknown) {
            if (error instanceof Error) {
              console.error(error.message);
            }
          }
        }
      } else {
        Alert.alert(
          "Permission Required for best experience",
          "Enable location in Settings > Apps > Vicinity > Permissions"
        );
      }
    };

    checkPermission();
  }, []);

  return (
    <View className='flex-1 bg-zinc-900 items-center justify-center'>
      <Text className='text-white'>Post Screen</Text>
      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default PostScreen;


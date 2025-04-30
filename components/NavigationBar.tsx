// filepath: /home/pradyumn/SWE/Vicinity/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Alert} from 'react-native';
import auth from '@react-native-firebase/auth';
import mmkv from '../storage';
// import {requestLocationPermission} from '../helper/locationPermission';
// import GetLocation from 'react-native-get-location';
// import * as geofire from 'geofire-common';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';



// const user = mmkv.getString('user');
// const userData = user ? JSON.parse(user) : null;;

const NavigationBar = () => {
    const navigation = useNavigation<NavigationProp<any>>();
  if (!navigation) {
    Alert.alert("Navigation prop is undefined. Ensure NavigationBar is used within a NavigationContainer.");
    return null;
  }
  
  const handleLogout = async () => {
    try {
      await auth().signOut();
      mmkv.delete('user');
      mmkv.delete('geohash');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }

  return (
    
      <View className="absolute bottom-5 left-5 right-5 flex-row justify-around bg-zinc-900 py-3 rounded-xl shadow-lg border border-zinc-800" >
        <TouchableOpacity onPress={() => navigation.navigate('Events')} className="items-center">
          <Ionicons name="newspaper-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Events</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Profile')} className="items-center">
          <Ionicons name="person-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Inbox')} className="items-center">
          <Ionicons name="chatbubble-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} className="items-center">
          <Ionicons name="log-out-outline" size={24} color="white" />
          <Text className="text-white text-xs mt-1">Logout</Text>
        </TouchableOpacity>
      </View>
  );
};

export default NavigationBar;
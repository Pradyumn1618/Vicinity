// /screens/FullProfileScreen.tsx

import React from 'react';
import { View, Image, Text } from 'react-native';
import { rootStackParamList } from '../helper/types';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';


type FullProfileScreenProps = {
    route: RouteProp<rootStackParamList, 'FullProfile'>;
    navigation: NativeStackNavigationProp<rootStackParamList, 'FullProfile'>;
};

const FullProfileScreen = ({ route }: FullProfileScreenProps) => {
  const { profilePic, username } = route.params || {};

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Image
        source={{ uri: profilePic }}
        className="w-80 h-80 rounded-full"
      />
      <Text className="text-white text-xl mt-4">{username}</Text>
    </View>
  );
};

export default FullProfileScreen;
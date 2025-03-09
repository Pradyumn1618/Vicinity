// filepath: /home/pradyumn/SWE/Vicinity/screens/DetailsScreen.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

interface DetailsScreenProps {
  navigation: NavigationProp<any>;
}

const DetailsScreen = ({ navigation }: DetailsScreenProps) => {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-black text-xl">Details Screen</Text>
      <Button
        title="Go back"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
};

export default DetailsScreen;
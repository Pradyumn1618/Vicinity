import React, { useEffect } from 'react';
import { View, Text, Button, Alert} from 'react-native';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';
import auth from '@react-native-firebase/auth';
import requestLocationPermission from '../helper/locationPermission';
import GetLocation from 'react-native-get-location';
import * as geofire from 'geofire-common';

interface DetailsScreenProps {
  navigation: NavigationProp<any>;
}

const DetailsScreen = ({ navigation }: DetailsScreenProps) => {
  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await requestLocationPermission(true);
      
      if (hasPermission) {
        // Get the current location
        const location = await GetLocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        const geohash = geofire.geohashForLocation([location.latitude, location.longitude]);
        if(mmkv.getString('geohash')?.substring(5) !== geohash.substring(5)) {
          mmkv.set('geohash', geohash);
        }
      } else {
        Alert.alert(
          "Permission Required",
          "Enable location in Settings > Apps > [Your App] > Permissions"
        );
      }
    };

    checkPermission();
  }, []);
  // Check authentication on initial mount
  const checkAuthentication = React.useCallback(() => {
    if (!mmkv.getString('user')) {
      // Use reset instead of navigate to remove the current screen from the stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [navigation]);
  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);
  
  // Check authentication every time the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      checkAuthentication();
      
    }, [checkAuthentication])
  );
  
  
  const handleLogout = async () => {
    try {
      await auth().signOut();
      mmkv.delete('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }
  
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-black text-xl">Details Screen</Text>
      <Button
        title='Go to Home'
        onPress={() => navigation.navigate('Home')}
      />
      <Button
        title="Logout"
        onPress={handleLogout}
      />
    </View>
  );
};

export default DetailsScreen;
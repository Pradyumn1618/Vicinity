// filepath: /home/pradyumn/SWE/Vicinity/Navigation.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen.tsx';
import DetailsScreen from './screens/DetailsScreen.tsx';
import LoginScreen from './screens/LoginScreen.tsx';
import SignupScreen from './screens/signup.tsx';
import OnboardingScreen from './screens/onBoardingScreen.tsx';
import ProfileScreen from './screens/ProfileScreen.tsx';
import UpdateProfileScreen from './screens/UpdateProfileScreen.tsx';

const Stack = createNativeStackNavigator();

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerBackVisible: false, headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
        {/* Add more screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
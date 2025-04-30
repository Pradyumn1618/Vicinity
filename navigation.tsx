// filepath: /home/pradyumn/SWE/Vicinity/Navigation.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen.tsx';
import EventsScreen from './screens/EventsScreen.tsx';
import LoginScreen from './screens/LoginScreen.tsx';
import SignupScreen from './screens/signup.tsx';
import OnboardingScreen from './screens/onBoardingScreen.tsx';
import ProfileScreen from './screens/ProfileScreen.tsx';
import UpdateProfileScreen from './screens/UpdateProfileScreen.tsx';
import ChatScreen from './screens/chatScreen.tsx';
import InboxScreen from './screens/chatMainScreen.tsx';
import { rootStackParamList } from './helper/types.tsx';
import MediaProfileScreen from './screens/receiverProfile.tsx';
import CreateGroupScreen from './screens/createGroup.tsx';
import GroupChatScreen from './screens/groupChatScreen.tsx';
import GroupDetailsScreen from './screens/groupDetailsScreen.tsx';
import PostScreen from './screens/PostScreen.tsx';

const Stack = createNativeStackNavigator<rootStackParamList>();

const Navigation = () => {
  return (
    // <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerBackVisible: false, headerShown: false }}>
        <Stack.Screen name="Home" component={PostScreen} />
        <Stack.Screen name="Events" component={EventsScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
        <Stack.Screen name="Inbox" component={InboxScreen} />
        <Stack.Screen name="ChatUserProfile" component={MediaProfileScreen} />
        <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen}/>
        <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} />
        <Stack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />
        {/* Add more screens here */}
      </Stack.Navigator>
    // </NavigationContainer>
  );
};

export default Navigation;
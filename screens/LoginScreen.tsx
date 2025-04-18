import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}


const LoginScreen = ({ navigation }:HomeScreenProps) => {
  const checkAuthentication = React.useCallback(() => {
    if (mmkv.getString('user')) {
      // Use reset instead of navigate to remove the current screen from the stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
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
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  GoogleSignin.configure({
    webClientId: '732981048166-ms933vk9p8u5pstc5cc5rf2jdmlps9h7.apps.googleusercontent.com',
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.signOut();
      await GoogleSignin.hasPlayServices();
      console.log('Google Sign-In has Play Services');
      const userInfo:any = await GoogleSignin.signIn();
      console.log('User Info:', userInfo);
      const idToken = userInfo.data?.idToken;
      console.log('ID Token:', idToken);
      if(!idToken) {
        throw new Error("Google Sign-In failed: No idToken received.");
      }
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      mmkv.set('user', JSON.stringify(auth().currentUser));
      Alert.alert('Login Successful');
      navigation.navigate('Onboarding');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      Alert.alert('Google Sign-In Failed', errorMessage);
    }
  };

  const signInWithEmail = async () => {
    try {
      const user = await auth().signInWithEmailAndPassword(email, password);
      if(!user.user.emailVerified) {
        throw new Error('Email not verified');
      }
      mmkv.set('user', JSON.stringify(auth().currentUser));
      Alert.alert('Login Successful');
      navigation.navigate('Onboarding');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      Alert.alert('Login Failed', errorMessage);
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20,backgroundColor:'black' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20,color:'white',textAlign:'center' }}>Login</Text>
      <TextInput
        style={{ padding: 10, borderColor: 'gray', borderWidth: 1, marginBottom: 10, color: 'white' }}
        placeholder='Email'
        placeholderTextColor={'gray'}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={{ padding: 10, borderColor: 'gray', borderWidth: 1, marginBottom: 10, color: 'white' }}
        placeholder='Password'
        placeholderTextColor={'gray'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={signInWithEmail} style={{ padding: 15, backgroundColor: 'blue', borderRadius: 5, marginBottom: 10 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Sign in with Email</Text>
      </TouchableOpacity>
      
      <Text style={{textAlign:'center',color:'white'}}>OR</Text>
      {/* <TouchableOpacity onPress={signInWithPhoneNumber} style={{ padding: 15, backgroundColor: 'blue', borderRadius: 5, marginBottom: 10 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Sign in with Phone</Text>
        </TouchableOpacity> */}
      <GoogleSigninButton
        style={{ width: '100%', height: 48 }}
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={signInWithGoogle}
      />
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
    <Text style={{ color: 'blue', textAlign: 'center', marginTop: 10 }}>
      Don't have an account? Register here
    </Text>
  </TouchableOpacity>
      
    </View>
  );
};

export default LoginScreen;

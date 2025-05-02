import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import mmkv from '../storage';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, getFirestore } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HomeScreenProps {
  navigation: NavigationProp<any>;
}

const db = getFirestore();

const LoginScreen = ({ navigation }: HomeScreenProps) => {
  const checkAuthentication = React.useCallback(() => {
    if (mmkv.getString('user')) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    }
  }, [navigation]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

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
      const userInfo: any = await GoogleSignin.signIn();
      console.log('User Info:', userInfo);
      const idToken = userInfo.data?.idToken;
      console.log('ID Token:', idToken);
      if (!idToken) {
        throw new Error("Google Sign-In failed: No idToken received.");
      }
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      mmkv.set('user', JSON.stringify(auth().currentUser));
      const sessionId = uuidv4();
      const userRef = doc(db, 'users', auth().currentUser.uid);
      await setDoc(userRef, {
        sessionId: sessionId,
      }, { merge: true });
      await AsyncStorage.setItem('sessionId', sessionId);
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
      if (!user.user.emailVerified) {
        throw new Error('Email not verified');
      }
      mmkv.set('user', JSON.stringify(auth().currentUser));
      const sessionId = uuidv4();
      const userRef = doc(db, 'users', auth().currentUser.uid);
      await setDoc(userRef, {
        sessionId: sessionId,
      }, { merge: true });
      await AsyncStorage.setItem('sessionId', sessionId);
      Alert.alert('Login Successful');
      navigation.navigate('Onboarding');
    } catch (error) {
      let errorMessage = 'An unknown error occurred';

      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is invalid.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
          default:
            errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert('Login Failed', errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter email"
        placeholderTextColor="#7A8290"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter password"
        placeholderTextColor="#7A8290"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.actionButton, styles.emailButton]}
        onPress={signInWithEmail}
      >
        <Text style={styles.buttonText}>Sign in with Email</Text>
      </TouchableOpacity>

      <Text style={styles.orText}>OR</Text>

      <GoogleSigninButton
        style={styles.googleButton}
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={signInWithGoogle}
      />

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.signupText}>
          Don't have an account? <Text style={styles.signupLink}>Register here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0B14', // Deep navy background
    padding: 28,
    justifyContent: 'center',
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
  actionButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emailButton: {
    backgroundColor: '#4f26e0', // Purple for email sign-in
    shadowColor: '#4f26e0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#F4F5F7',
    fontSize: 16,
    fontWeight: '700',
  },
  orText: {
    color: '#7A8290', // Gray for "OR"
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 12,
  },
  googleButton: {
    width: '100%',
    height: 48,
    marginBottom: 16,
  },
  signupText: {
    color: '#F4F5F7',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  signupLink: {
    color: '#4f26e0', // Purple for link
    fontWeight: '700',
  },
});

export default LoginScreen;
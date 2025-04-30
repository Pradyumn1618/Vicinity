import React, { useState,useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { NavigationProp, useFocusEffect } from '@react-navigation/native';

import auth from "@react-native-firebase/auth";
import mmkv from "../storage";
interface HomeScreenProps {
    navigation: NavigationProp<any>;
  }
  



const SignupScreen = ({ navigation }:HomeScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const checkAuthentication = React.useCallback(() => {
    if (mmkv.getString('user')) {
      // Use reset instead of navigate to remove the current screen from the stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
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

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "All fields are required!");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match!");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      await userCredential.user.sendEmailVerification(); // Send verification email
      Alert.alert("Success", "Account created! Check your email for verification.");
      navigation.navigate("Login"); // Redirect to Login screen
    } catch (error) {
      Alert.alert("Signup Error", error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-black px-6">
      <Text className="text-2xl font-bold mb-6 text-blue-600">Sign Up</Text>

      <TextInput
        placeholder="Email"
        className="w-full p-3 border border-gray-300 rounded-lg mb-3"
        placeholderTextColor={'gray'}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{color: 'white'}}
      />

      <TextInput
        placeholder="Password"
        className="w-full p-3 border border-gray-300 rounded-lg mb-3"
        placeholderTextColor={'gray'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{color: 'white'}}
      />

      <TextInput
        placeholder="Confirm Password"
        className="w-full p-3 border border-gray-300 rounded-lg mb-5"
        placeholderTextColor={'gray'}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={{color: 'white'}}
      />

      <TouchableOpacity 
        className="w-full bg-blue-600 p-3 rounded-lg items-center"
        onPress={handleSignup}
        disabled={loading}
      >
        <Text className="text-white font-bold text-lg">
          {loading ? "Signing Up..." : "Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignupScreen;
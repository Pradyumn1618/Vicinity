import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const SplashScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000, // 2 seconds fade in
      useNativeDriver: true,
    }).start();

    // Navigate after 3s (2s for animation + 1s to view the fully faded content)
    const timeout = setTimeout(() => {
      navigation.replace('Home');
    }, 3000);

    return () => clearTimeout(timeout);
  }, [fadeAnim, navigation]);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.text,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        Vicinity
      </Animated.Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#00ffff', // Static cyan color
  },
});
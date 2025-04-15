import React from 'react';
import { View, Text } from 'react-native';
import Video from 'react-native-video';
import FastImage from 'react-native-fast-image';

const MediaTest = () => {
  // Test with a simple public video URL
  const testVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
  // Test with a simple public image URL
  const testImageUrl = 'https://reactnative.dev/img/tiny_logo.png';
  
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ marginBottom: 10 }}>Video Test:</Text>
      <Video
        source={{ uri: testVideoUrl }}
        style={{ width: '100%', height: 160, borderRadius: 8, marginBottom: 20 }}
        controls
        resizeMode="contain"
        onError={(error) => console.error('Test video error:', error)}
        onLoad={() => console.log('Test video loaded')}
      />
      
      <Text style={{ marginBottom: 10 }}>Image Test:</Text>
      <FastImage
        source={{ uri: testImageUrl }}
        style={{ width: '100%', height: 160, borderRadius: 8 }}
        resizeMode={FastImage.resizeMode.contain}
        onError={() => console.error('Test image error')}
        onLoad={() => console.log('Test image loaded')}
      />
    </View>
  );
};

export default MediaTest;
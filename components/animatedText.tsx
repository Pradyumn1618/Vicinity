import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Text, View } from 'react-native';
import React from 'react';

const GradientText = () => {
  return (
    <MaskedView maskElement={
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'black' }}>
        Vicinity
      </Text>
    }>
      <LinearGradient
        colors={['#00FFFF', '#FF00FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 40 }}
      />
    </MaskedView>
  );
};
export default GradientText;
import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';



interface DownloadHeaderProps {
  visible: boolean;
  onDownload: () => void;
}

export const DownloadHeader: React.FC<DownloadHeaderProps> = ({ visible, onDownload }) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={{ position: 'absolute', top: 40, left: 20, zIndex: 1 }}
      onPress={onDownload}
    >
      <Ionicons name="download" size={32} color="white" />
    </TouchableOpacity>
  );
};



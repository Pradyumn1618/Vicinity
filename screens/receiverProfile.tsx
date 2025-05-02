import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, Modal, Dimensions
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { createThumbnail } from 'react-native-create-thumbnail';
import Video from 'react-native-video';
import { getMediaFromLocalDB } from '../helper/databaseHelper';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

interface MediaItem {
  media: string;
  timestamp: number;
  thumb: string;
  ext: string;
}

interface rawMediaItem {
  media: string;
  timestamp: number;
}

const groupByMonth = (items: MediaItem[]) => {
  const grouped: { [key: string]: MediaItem[] } = {};
  items.forEach(item => {
    const monthKey = format(new Date(item.timestamp), 'MMMM yyyy');
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(item);
  });
  return Object.entries(grouped).map(([title, data]) => ({ title, data }));
};

const MediaProfileScreen = ({ route,navigation }: { route: { params: { chatId: string; receiverDetails: { profilePic: string; username: string; status: string; id:string }; }; }; }) => {
  const { chatId, receiverDetails } = route.params;
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem>();
  const [modalVisible, setModalVisible] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchMedia = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const getFileExtension = (uri: string) => {
      const cleanUrl = uri.split('?')[0].toLowerCase();
      const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1);
      return ext;
    };

    const results = await getMediaFromLocalDB(chatId, offset, 15);

    const mediaWithThumbs = await Promise.all(results.map(async (item: rawMediaItem) => {
      const ext = getFileExtension(item.media);
      let thumb = item.media;
      if (ext === 'mp4' || ext === 'mov') {
        try {
          const thumbnail = await createThumbnail({ url: item.media, timeStamp: 1000 });
          thumb = thumbnail.path;
        } catch (error) {
          console.error('Error creating thumbnail:', error);
        }
      }
      return { ...item, thumb, ext };
    }));

    if (results.length < 15) setHasMore(false);
    setMediaList(prev => [...prev, ...mediaWithThumbs]);
    setOffset(prev => prev + results.length);
    setLoading(false);
  }, [chatId, offset, loading, hasMore]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const loadMore = () => {
    if (mediaList.length === 0) return;
    fetchMedia();
  };

  const openMedia = (item: MediaItem) => {
    setSelectedMedia(item);
    setModalVisible(true);
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#000' }}>
      <TouchableOpacity onPress={() => {navigation.navigate('UserProfile',{userId:receiverDetails.id});}} style={{ marginBottom: 20 }}>
      <FastImage source={{ uri: receiverDetails.profilePic }} style={{ width: 100, height: 100, borderRadius: 50, alignSelf: 'center' }} />
      <Text style={{ color: '#fff', fontSize: 20, textAlign: 'center', marginTop: 10 }}>{receiverDetails.username}</Text>
      </TouchableOpacity>
      <Text style={{ color: 'gray', textAlign: 'center', marginBottom: 20 }}>{receiverDetails.status}</Text>

      <Text style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>Media</Text>

      <SectionList
        sections={groupByMonth(mediaList)}
        keyExtractor={(_, idx) => idx.toString()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openMedia(item)}>
            <FastImage
              source={{ uri: item.thumb }}
              style={{ width: width / 3 - 10, height: width / 3 - 10, margin: 5, borderRadius: 8 }}
            />
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ color: '#fff', fontSize: 16, paddingVertical: 8 }}>{title}</Text>
        )}
      />

      <Modal visible={modalVisible} transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
          <TouchableOpacity onPress={() => setModalVisible(false)} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
            <Text style={{ color: 'white', fontSize: 18 }}>Close</Text>
          </TouchableOpacity>

          {selectedMedia?.ext === 'mp4' || selectedMedia?.ext === 'mov' ? (
            <Video
              source={{ uri: selectedMedia.media }}
              style={{ width: '100%', height: '70%' }}
              controls
              resizeMode="contain"
            />
          ) : (
            <FastImage
              source={{ uri: selectedMedia?.media }}
              style={{ width: '100%', height: '70%' }}
              resizeMode={FastImage.resizeMode.contain}
            />
          )}

          <Text style={{ color: 'white', textAlign: 'center', marginTop: 10 }}>
            {selectedMedia?.timestamp ? new Date(selectedMedia.timestamp).toLocaleString() : ''}
          </Text>
        </View>
      </Modal>
    </View>
  );
};

export default MediaProfileScreen;
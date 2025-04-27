import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { distanceBetween } from 'geofire-common';
import { getFirestore, collection, query, where, getDocs, onSnapshot } from '@react-native-firebase/firestore';
import Geohash from 'ngeohash';
import GetLocation from 'react-native-get-location';
import EventCard from '../components/EventCard';
import CreateEventModal from '../components/CreateEventModal'; // Import the new component
import auth from '@react-native-firebase/auth';

interface Event {
  id: string;
  title: string;
  description: string;
  dateTime: Date;
  venue: string;
  geohash: string;
  location: { _latitude: number; _longitude: number };
  public: boolean;
  createdBy: string;
  allowedUsers?: string[];
}

const EventsScreen = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null); // Track expanded card
  const [distanceFilter, setDistanceFilter] = useState<'nearby' | 'far' | 'farther'>('nearby');
  const db = getFirestore();

  const fetchNearbyEvents = React.useCallback((center: [number, number]) => {
    setLoading(true);

    const currentUser = auth().currentUser;
    const userId = currentUser?.uid;

    if (!userId) {
      console.error('User not authenticated');
      setLoading(false);
      return;
    }

    let geohashPrecision: number;
    let radius: number;

    switch (distanceFilter) {
      case 'nearby':
        geohashPrecision = 5; // Higher precision for smaller areas
        radius = 10; // 5 km
        break;
      case 'far':
        geohashPrecision = 4; // Medium precision
        radius = 100; // 20 km
        break;
      case 'farther':
        geohashPrecision = 3; // Lower precision for larger areas
        radius = 1000; // 50 km
        break;
      default:
        geohashPrecision = 5;
        radius = 10;
    }

    const currentGeohash = Geohash.encode(center[0], center[1]).substring(0, geohashPrecision);
    const neighbors = Geohash.neighbors(currentGeohash).map(g => g.substring(0, geohashPrecision));
    const geohashesToQuery = [currentGeohash, ...neighbors];

    // 🔹 Query 1: Public nearby events
    const publicQuery = query(
      collection(db, 'Events'),
      where('geohash', 'in', geohashesToQuery),
      where('public', '==', true)
    );

    // 🔹 Query 2: Private events user is allowed to see (no geohash filter)
    const privateQuery = query(
      collection(db, 'Events'),
      where('allowedUsers', 'array-contains', userId),
      where('public', '==', false)
    );

    // Temporary buffer to combine events
    let allEvents: Event[] = [];

    const processSnapshot = (snapshot: any, isPublic: boolean) => {
      const now = new Date();
      const result: Event[] = [];

      snapshot.forEach((doc: any) => {
        const data = doc.data();
        const event: Event = {
          id: doc.id,
          title: data.title,
          description: data.description,
          dateTime: data.dateTime.toDate(),
          venue: data.venue,
          geohash: data.geohash,
          location: data.location,
          public: data.public,
          createdBy: data.createdBy,
          allowedUsers: data.allowedUsers || [],
        };

        if (event.dateTime > now) {
          if (isPublic) {
            const distance = distanceBetween(
              [event.location._latitude, event.location._longitude],
              center
            );
            if (distance <= radius) result.push(event);
          } else {
            result.push(event); // No distance filter for private
          }
        }
      });

      // Merge and sort only after both queries return (debounced update)
      allEvents = [...allEvents.filter(e => e.public !== isPublic), ...result];

      const sorted = allEvents.sort((a, b) => {
        const d1 = distanceBetween([a.location._latitude, a.location._longitude], center);
        const d2 = distanceBetween([b.location._latitude, b.location._longitude], center);
        return d1 - d2;
      });

      setEvents(sorted.slice(0, 10));
      setLoading(false);
    };

    const unsubscribePublic = onSnapshot(publicQuery, snapshot => {
      processSnapshot(snapshot, true);
    });

    const unsubscribePrivate = onSnapshot(privateQuery, snapshot => {
      processSnapshot(snapshot, false);
    });

    return () => {
      unsubscribePublic();
      unsubscribePrivate();
    };
  }, [db, distanceFilter]);

  useEffect(() => {
    if (currentLocation) {
      fetchNearbyEvents([currentLocation.lat, currentLocation.lng]);
    }
  }, [distanceFilter, currentLocation, fetchNearbyEvents]);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const location = await GetLocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        console.log('Current Location:', location);
        setCurrentLocation({ lat: location.latitude, lng: location.longitude });
        fetchNearbyEvents([location.latitude, location.longitude]);
      } catch (error) {
        Alert.alert('Location Error', 'Failed to fetch current location');
      }
    };
    getLocation();
  }, [fetchNearbyEvents]);

  const toggleExpand = (id: string) => {
    setExpandedEventId(prevId => (prevId === id ? null : id)); // Toggle expand/collapse
  };
  const renderEventCard = ({ item }: { item: Event }) => {
    const isExpanded = expandedEventId === item.id;

    return (
      <EventCard
        event={item}
        isExpanded={isExpanded}
        onPress={() => toggleExpand(item.id)}
      />
    );
  };

  return (
    <View style={{ backgroundColor: '#121212', flex: 1, padding: 16 }}>
      <Text style={styles.headerText}>Nearby Events</Text>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            distanceFilter === 'nearby' && styles.activeFilterButton,
          ]}
          onPress={() => setDistanceFilter('nearby')}
        >
          <Text style={styles.filterText}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            distanceFilter === 'far' && styles.activeFilterButton,
          ]}
          onPress={() => setDistanceFilter('far')}
        >
          <Text style={styles.filterText}>Far</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            distanceFilter === 'farther' && styles.activeFilterButton,
          ]}
          onPress={() => setDistanceFilter('farther')}
        >
          <Text style={styles.filterText}>Farther</Text>
        </TouchableOpacity>
      </View>

      {/* Create Event Button */}
      <TouchableOpacity
        style={styles.createEventButton}
        onPress={() => setShowCreateModal(!showCreateModal)}
      >
        <Text style={styles.createEventButtonText}>
          {showCreateModal ? 'Cancel' : 'Create Event'}
        </Text>
      </TouchableOpacity>

      <CreateEventModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={() => {
          if (currentLocation) {
            fetchNearbyEvents([currentLocation.lat, currentLocation.lng]);
          }
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          renderItem={renderEventCard}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 16, color: 'white' }}>
              No events found in your area
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 16,
      textAlign: 'center',
  },
  filterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
  },
  filterButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#444',
      alignItems: 'center',
      marginHorizontal: 4,
  },
  activeFilterButton: {
      backgroundColor: '#4caf50',
  },
  filterText: {
      color: 'white',
      fontWeight: 'bold',
  },
  createEventButton: {
      backgroundColor: '#4caf50',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 16,
  },
  createEventButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
  },
});

export default EventsScreen;


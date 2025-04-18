import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { distanceBetween } from 'geofire-common';
import { getFirestore, collection, query, where, getDocs, onSnapshot } from '@react-native-firebase/firestore';
import Geohash from 'ngeohash';
import GetLocation from 'react-native-get-location';
import EventCard from '../components/EventCard';
import CreateEventModal from '../components/CreateEventModal'; // Import the new component

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
}

const EventsScreen = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null); // Track expanded card
  const db = getFirestore();

  const fetchNearbyEvents = React.useCallback((center: [number, number], radius = 5) => {
    setLoading(true);

    // Generate the geohash for the user's current location
    const currentGeohash = Geohash.encode(center[0], center[1]).substring(0, 5);
    const neighbors = Geohash.neighbors(currentGeohash).map(geohash => geohash.substring(0, 5));
    const geohashesToQuery = [currentGeohash, ...neighbors];

    // console.log('Geohashes to query:', geohashesToQuery);

    // Query Firestore for events in the current geohash and its neighbors
    const q = query(
      collection(db, 'Events'),
      where('geohash', 'in', geohashesToQuery), // Use 'in' to query multiple geohashes
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const matchingDocs: Event[] = [];
      snapshot.forEach(doc => {
        const eventData = doc.data();
        const event: Event = {
          id: doc.id,
          title: eventData.title,
          description: eventData.description,
          dateTime: eventData.dateTime.toDate(),
          venue: eventData.venue,
          geohash: eventData.geohash,
          location: eventData.location,
          public: eventData.public,
          createdBy: eventData.createdBy,
        };
        matchingDocs.push(event);
      });

      // Filter by actual distance
      const filteredEvents = matchingDocs.filter(event => {
        const distance = distanceBetween([event.location._latitude, event.location._longitude], center);
        return distance * 10000 <= radius * 10000;
      });

      // console.log('Filtered Events:', filteredEvents);

      // Sort events by distance (optional)
      const sortedEvents = filteredEvents.sort((a, b) => {
        const distanceA = distanceBetween([a.location._latitude, a.location._longitude], center);
        const distanceB = distanceBetween([b.location._latitude, b.location._longitude], center);
        return distanceA - distanceB;
      });

      // Update the state with the sorted events
      setEvents(sortedEvents.slice(0, 10)); // Limit to 10 events
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>Nearby Events</Text>
        <Button
          title={showCreateModal ? 'Cancel' : 'Create Event'}
          onPress={() => setShowCreateModal(!showCreateModal)}
        />
      </View>

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
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  expandedCard: {
    backgroundColor: '#2c2c2c',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  venue: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  dateTime: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: 'white',
    marginTop: 8,
  },
  createdBy: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
  },
});

export default EventsScreen;


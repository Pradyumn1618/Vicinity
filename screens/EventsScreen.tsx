import React, { useEffect, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, Button, Alert, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { distanceBetween } from 'geofire-common';
import { getFirestore, collection, query, where, getDocs, onSnapshot } from '@react-native-firebase/firestore';
import Geohash from 'ngeohash';
import GetLocation from 'react-native-get-location';
import EventCard from '../components/EventCard';
import CreateEventModal from '../components/CreateEventModal'; // Import the new component
import auth from '@react-native-firebase/auth';
import { ToastAndroid } from 'react-native';
import { Event } from '../helper/types';
import NavigationBar from '../components/NavigationBar';


const EventsScreen = ({ navigation }: { navigation: NavigationProp<any> }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null); // Track expanded card
  const [distanceFilter, setDistanceFilter] = useState<'nearby' | 'far' | 'farther'>('nearby');
  const [notificationStatus, setNotificationStatus] = useState<{ [key: string]: boolean }>({});
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
      where('geohashes', 'array-contains-any', geohashesToQuery),
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
          notifierUsers: data.notifierUsers || [],
        };

        const oneHourBeforeNow = new Date(now.getTime() - 60 * 60 * 1000); // Subtract 1 hour
        if (event.dateTime > oneHourBeforeNow) {
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

      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;
      if (userId) {
        const notificationState = sorted.reduce<{ [key: string]: boolean }>((acc, event) => {
          acc[event.id] = event.notifierUsers.includes(userId);
          return acc;
        }, {});
        setNotificationStatus(notificationState);
      }

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
    let isRequestActive = false; // Track if a location request is active

    const getLocation = async () => {
      if (isRequestActive) return; // Prevent overlapping requests
      isRequestActive = true;

      try {
        const location = await GetLocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        console.log('Current Location:', location);
        setCurrentLocation({ lat: location.latitude, lng: location.longitude });
        fetchNearbyEvents([location.latitude, location.longitude]);
      } catch (error) {
        if ((error as { code: string }).code === 'CANCELLED') {
          console.warn('Location request was cancelled.');
        } else {
          Alert.alert('Location Error', (error as any).message);
        }
      } finally {
        isRequestActive = false; // Reset the state after the request completes
      }
    };

    getLocation();
  }, [fetchNearbyEvents]);

  const toggleExpand = (id: string) => {
    setExpandedEventId(prevId => (prevId === id ? null : id)); // Toggle expand/collapse
  };
  const renderEventCard = ({ item }: { item: Event }) => {
    const isExpanded = expandedEventId === item.id;

    const now = new Date();
    const eventTime = new Date(item.dateTime);
    const isNotificationDisabled = eventTime.getTime() - now.getTime() <= 30 * 60 * 1000; // 30 minutes

    const isNotificationEnabled = notificationStatus[item.id] || false;

    const handleNotificationPress = async (eventId: string, eventTitle: string) => {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid;

      if (!userId) {
        ToastAndroid.show('You must be logged in to manage notifications.', ToastAndroid.SHORT);
        return;
      }

      const eventRef = collection(db, 'Events').doc(eventId);
      const eventDoc = await eventRef.get();

      if (!eventDoc.exists) {
        ToastAndroid.show('Event not found.', ToastAndroid.SHORT);
        return;
      }

      const eventData = eventDoc.data();
      const notifierUsers = eventData?.notifierUsers || [];
      const isEnabled = notifierUsers.includes(userId);

      if (isEnabled) {
        // Remove user from notifierUsers
        await eventRef.update({
          notifierUsers: notifierUsers.filter((id: string) => id !== userId),
        });
        ToastAndroid.show(`Notifications for "${eventTitle}" have been turned off.`, ToastAndroid.SHORT);
      } else {
        // Add user to notifierUsers
        await eventRef.update({
          notifierUsers: [...notifierUsers, userId],
        });
        ToastAndroid.show(`You will be notified for the event: "${eventTitle}".`, ToastAndroid.SHORT);
      }

      // Update local state
      setNotificationStatus((prev) => ({
        ...prev,
        [eventId]: !isEnabled,
      }));
    };

    return (
      <EventCard
        event={item}
        isExpanded={isExpanded}
        onPress={() => toggleExpand(item.id)}
        renderRightAction={() => (
          <TouchableOpacity
            onPress={() => handleNotificationPress(item.id, item.title)}
            disabled={isNotificationDisabled}
            style={{
              opacity: isNotificationDisabled ? 0.5 : 1, // Dim the icon if disabled
              marginLeft: 8,
            }}
          >
            <Ionicons
              name={isNotificationEnabled ? 'notifications' : 'notifications-off'}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        )}
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

      <NavigationBar navigation={navigation} />

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


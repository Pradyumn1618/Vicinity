import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet, Modal, TextInput, Button, GestureResponderEvent } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Event } from '../helper/types';
import { TouchableOpacity } from 'react-native';

interface EventListProps {
  initialEvents: Event[];
  lastE: FirebaseFirestoreTypes.DocumentSnapshot;
  userId: string;
}

const EventList = ({ initialEvents,lastE,userId }: EventListProps) => {
//   const currentUser = auth().currentUser;
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [lastEvent, setLastEvent] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(lastE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMoreEvents, setNoMoreEvents] = useState(initialEvents.length < 10);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [eventBeingEdited, setEventBeingEdited] = useState<Event | null>(null);

  const openEditModal = (event: Event) => {
    setEventBeingEdited(event);
    setEditModalVisible(true);
  };
  

  const fetchEvents = async () => {
    console.log('Fetching events...');
    console.log(lastEvent);
    if (!userId || loadingMore || noMoreEvents) {
      console.log('Conditions not met to fetch events');
      return;
    }
  
    setLoadingMore(true);
  
    try {
      let query = firestore()
        .collection('Events')
        .where('userId', '==', userId)
        .orderBy('dateTime', 'desc')
        .limit(5);
  
      if (lastEvent) {
        console.log('Using lastEvent:', lastEvent.id);
        query = firestore()
        .collection('Events')
        .where('userId', '==', userId)
        .orderBy('dateTime', 'desc').startAfter(lastEvent)
        .limit(5)
      }
  
      const snapshot = await query.get();
  
      if (!snapshot.empty) {
        const newEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        console.log(lastE);
        console.log('Fetched new events:', newEvents);
        setEvents(prev => [...prev, ...newEvents] as Event[]);
        setLastEvent(snapshot.docs[snapshot.docs.length - 1]);
        if(snapshot.docs.length < 5){
            console.log('Less than 5 events returned; setting noMoreEvents to true.');
            setNoMoreEvents(true);
        }
      } else {
        console.log('No more events to fetch');
        setNoMoreEvents(true);
      }
    } catch (err) {
      console.error('Error fetching more events:', err);
    } finally {
      setLoadingMore(false);
    }
  };
  
      

  const renderItem = ({ item }: { item: Event }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={{ color: '#555', marginTop: 4 }}>{item.description}</Text>
      <Text style={{ marginTop: 4 }}>📍 {item.venue} </Text>
      <Text style={{ marginTop: 4, color: 'gray' }}>
      {item.dateTime?.toDate().toLocaleString()}
        </Text>
    </View>
  );

  const saveChanges = async () => {
    if (!eventBeingEdited) return;
  
    try {
      const eventRef = firestore().collection('Events').doc(eventBeingEdited.id);
      await eventRef.update({
        title: eventBeingEdited.title,
        description: eventBeingEdited.description,
        venue: eventBeingEdited.venue,
        dateTime: eventBeingEdited.dateTime, // make sure this is a Timestamp
      });
  
      // Update local state
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventBeingEdited.id ? { ...event, ...eventBeingEdited } : event
        )
      );
  
      setEditModalVisible(false);
      setEventBeingEdited(null);
    } catch (error) {
      console.error("Failed to save event changes:", error);
    }
  };

  return (
    <>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        onEndReached={fetchEvents}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* ✅ Insert Modal JSX here */}
      {eventBeingEdited && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <TextInput
                style={styles.input}
                value={eventBeingEdited.title}
                onChangeText={(text) =>
                  setEventBeingEdited({ ...eventBeingEdited, title: text })
                }
                placeholder="Title"
              />
              {/* more fields... */}
              <Button title="Save" onPress={saveChanges} />
              <Button title="Cancel" onPress={() => setEditModalVisible(false)} color="gray" />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
    opacity: 50,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statText: {
    color: 'gray',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '90%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },  
});

export default EventList;

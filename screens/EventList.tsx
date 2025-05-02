import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Event } from '../helper/types';

interface EventListProps {
  initialEvents: Event[];
  lastE: FirebaseFirestoreTypes.DocumentSnapshot;
}

const EventList = ({ initialEvents,lastE }: EventListProps) => {
  const currentUser = auth().currentUser;
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [lastEvent, setLastEvent] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(lastE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMoreEvents, setNoMoreEvents] = useState(initialEvents.length < 10);

  const fetchEvents = async () => {
    console.log('Fetching events...');
    console.log(lastEvent);
    if (!currentUser || loadingMore || noMoreEvents) {
      console.log('Conditions not met to fetch events');
      return;
    }
  
    setLoadingMore(true);
  
    try {
      let query = firestore()
        .collection('Events')
        .where('userId', '==', currentUser.uid)
        .orderBy('dateTime', 'desc')
        .limit(5);
  
      if (lastEvent) {
        console.log('Using lastEvent:', lastEvent.id);
        query = firestore()
        .collection('Events')
        .where('userId', '==', currentUser.uid)
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
        {item.dateTime.toLocaleString()}
      </Text>
    </View>
  );
  

  return (
    <FlatList
      data={events}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      onEndReached={fetchEvents}
      onEndReachedThreshold={0.2}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      contentContainerStyle={{ paddingBottom: 20}}
    />
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
});

export default EventList;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    dateTime: Date;
    venue: string;
    createdBy: string;
  };
  isExpanded: boolean;
  onPress: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, isExpanded, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.card, isExpanded && styles.expandedCard]}
      onPress={onPress}
    >
      <Text style={styles.title}>🎉 {event.title}</Text>
      <Text style={styles.venue}>📍 {event.venue}</Text>
      <Text style={styles.dateTime}>
        🕒 {event.dateTime.toLocaleDateString()} {event.dateTime.toLocaleTimeString()}
      </Text>
      {isExpanded && (
        <>
          <View style={styles.divider} />
          <Text style={styles.description}>📝 {event.description}</Text>
          <Text style={styles.createdBy}>👤 Created By: {event.createdBy}</Text>
        </>
      )}
    </TouchableOpacity>
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
    marginBottom: 8,
  },
  venue: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  dateTime: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 8,
  },
  description: {
    fontSize: 14,
    color: 'white',
    marginBottom: 8,
  },
  createdBy: {
    fontSize: 12,
    color: '#ccc',
  },
});

export default EventCard;
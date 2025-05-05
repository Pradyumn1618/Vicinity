import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFirestore, collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { geohashForLocation } from 'geofire-common';
import VenueAutocomplete from './VenueAutoComplete';
import AddMemberModal from './AddMemberModal';

const db = getFirestore();

interface CreateEventModalProps {
    visible: boolean;
    onClose: () => void;
    onEventCreated: () => void;
}

const GOOGLE_API_KEY = 'AIzaSyDnZC4J2uKlWfFV-KDghvHn-BnWfzFo1YI';

const CreateEventModal: React.FC<CreateEventModalProps> = ({ visible, onClose, onEventCreated }) => {
    const [form, setForm] = useState({
        title: '',
        description: '',
        dateTime: new Date(),
        venue: '',
        location: { lat: 0, lng: 0 },
        public: true,
        allowedUsers: [] as string[],
    });
    const [userInputs, setUserInputs] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);

    const handleAddUserInput = (username: string) => {
        if (username.trim() !== '') {
            setUserInputs([...userInputs, username]);
        }
    };

    const handleCancel = () => {
        setUserInputs(['']);
        setForm({
            title: '',
            description: '',
            dateTime: new Date(),
            venue: '',
            location: { lat: 0, lng: 0 },
            public: true,
            allowedUsers: [],
        });
        onClose();
    };

    const handleCreateEvent = async () => {
        try {
            setLoading(true);

            // Validate form fields
            if (!form.title.trim()) {
                Alert.alert('Validation Error', 'Event title is required.');
                return;
            }
            if (!form.description.trim()) {
                Alert.alert('Validation Error', 'Event description is required.');
                return;
            }
            if (!form.dateTime || isNaN(new Date(form.dateTime).getTime())) {
                Alert.alert('Validation Error', 'A valid event date and time is required.');
                return;
            }
            if (!form.venue.trim()) {
                Alert.alert('Validation Error', 'Event venue is required.');
                return;
            }

            // Generate geohash for the venue location
            const geohash5 = geohashForLocation([form.location.lat, form.location.lng]).substring(0, 5);
            const geohash4 = geohash5.substring(0, 4);
            const geohash3 = geohash5.substring(0, 3);

            // Fetch the username from Firestore
            const user = auth().currentUser;
            if (!user) {
                Alert.alert('Error', 'User not authenticated');
                return;
            }
            const userDoc = await getFirestore().collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const username = userData?.username || 'Unknown User'; // Default to 'Unknown User' if username is not found

            // Convert usernames to user IDs in the backend
            const allowedUsers: string[] = [];
            for (const username of userInputs.filter(input => input.trim() !== '')) {
                const querySnapshot = await getFirestore()
                    .collection('users')
                    .where('username', '==', username.trim())
                    .get();
                if (!querySnapshot.empty) {
                    querySnapshot.forEach(doc => allowedUsers.push(doc.id)); // Add user ID
                } else {
                    Alert.alert('Warning', `User "${username}" not found.`);
                }
            }

            const eventData = {
                ...form,
                location: new (require('@react-native-firebase/firestore')).GeoPoint(
                    form.location.lat,
                    form.location.lng
                ),
                geohashes: [geohash5, geohash4, geohash3],
                createdBy: username,
                createdAt: serverTimestamp(),
                userId: user.uid,
                allowedUsers: form.public ? [] : allowedUsers,
            };

            // Add the event to Firestore
            await addDoc(collection(db, 'Events'), eventData);
            onEventCreated(); // Notify parent component

            // Reset the form to its initial state
            setForm({
                title: '',
                description: '',
                dateTime: new Date(),
                venue: '',
                location: { lat: 0, lng: 0 },
                public: true,
                allowedUsers: [],
            });
            setUserInputs(['']); // Reset user inputs
            onClose(); // Close the modal
        } catch (error) {
            Alert.alert('Error', 'Failed to create event. Please check the venue and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    <Text style={styles.title}>Create New Event</Text>

                    <TextInput
                        placeholder="Event Title"
                        placeholderTextColor="#7A8290"
                        value={form.title}
                        onChangeText={text => setForm({ ...form, title: text })}
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="Description"
                        placeholderTextColor="#7A8290"
                        value={form.description}
                        onChangeText={text => setForm({ ...form, description: text })}
                        multiline
                        style={[styles.input, styles.textArea]}
                    />

                    <View style={styles.dateTimeContainer}>
                        <View style={styles.dateTimeWrapper}>
                            <Text style={styles.dateTimeText}>
                                {form.dateTime.toLocaleDateString()}
                            </Text>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.iconText}>📅</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dateTimeWrapper}>
                            <Text style={styles.dateTimeText}>
                                {form.dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Text style={styles.iconText}>🕒</Text>
                            </TouchableOpacity>
                        </View>
                        {showDatePicker && (
                            <DateTimePicker
                                value={form.dateTime}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        setForm({ ...form, dateTime: selectedDate });
                                    }
                                }}
                            />
                        )}
                        {showTimePicker && (
                            <DateTimePicker
                                value={form.dateTime}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                onChange={(event, selectedTime) => {
                                    setShowTimePicker(false);
                                    if (selectedTime) {
                                        const updatedDateTime = new Date(form.dateTime);
                                        updatedDateTime.setHours(selectedTime.getHours());
                                        updatedDateTime.setMinutes(selectedTime.getMinutes());
                                        setForm({ ...form, dateTime: updatedDateTime });
                                    }
                                }}
                            />
                        )}
                    </View>

                    <VenueAutocomplete
                        apiKey={GOOGLE_API_KEY}
                        onPlaceSelected={(venue, location) => setForm({ ...form, venue, location })}
                    />

                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                form.public ? styles.publicActive : styles.inactive,
                            ]}
                            onPress={() => setForm({ ...form, public: true })}
                        >
                            <Text style={styles.toggleText}>Public</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                !form.public ? styles.privateActive : styles.inactive,
                            ]}
                            onPress={() => setForm({ ...form, public: false })}
                        >
                            <Text style={styles.toggleText}>Private</Text>
                        </TouchableOpacity>
                    </View>

                    {!form.public && (
                        <View>
                            {userInputs.filter(input => input.trim() !== '').length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Allowed Users</Text>
                                    {userInputs
                                        .filter(input => input.trim() !== '')
                                        .map((input, index) => (
                                            <View key={index} style={styles.memberCard}>
                                                <Text style={styles.memberText}>{input}</Text>
                                            </View>
                                        ))}
                                </>
                            )}
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => setShowAddMemberModal(true)}
                            >
                                <Text style={styles.addButtonText}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.createButton]}
                            onPress={handleCreateEvent}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>Create Event</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={handleCancel}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && <ActivityIndicator size="large" color="#4f26e0" style={styles.loader} />}
                </View>
            </KeyboardAvoidingView>

            <AddMemberModal
                visible={showAddMemberModal}
                onClose={() => setShowAddMemberModal(false)}
                onAddMember={handleAddUserInput}
                fetchSuggestions={async (query) => {
                    try {
                        const usersCollection = db.collection('users');
                        const querySnapshot = await usersCollection.get();

                        return querySnapshot.docs
                            .map(doc => doc.data().username)
                            .filter(username => username.toLowerCase().startsWith(query.toLowerCase()));
                    } catch (error) {
                        console.error('Error fetching suggestions:', error);
                        return [];
                    }
                }}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 28,
        backgroundColor: 'black', // Deep navy background
        borderTopLeftRadius: 1,
        borderTopRightRadius: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#F4F5F7', // Soft white for text
        marginBottom: 28,
        letterSpacing: 0.8,
        textAlign: 'center',
        textShadowColor: 'rgba(79, 38, 224, 0.3)', // Purple glow
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F4F5F7',
        marginBottom: 12,
        marginTop: 20,
    },
    input: {
        backgroundColor: '#1B1C2A', // Darker input background
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontSize: 16,
        color: '#F4F5F7',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(79, 38, 224, 0.2)', // Subtle purple border
        shadowColor: '#4f26e0', // Purple shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    textArea: {
        height: 140,
        textAlignVertical: 'top',
        paddingTop: 16,
    },
    dateTimeContainer: {
        marginBottom: 20,
        backgroundColor: '#1B1C2A',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(79, 38, 224, 0.2)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateTimeWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    dateTimeText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '600',
    },
    iconButton: {
        backgroundColor: 'black', // Purple for icon buttons
        borderRadius: 8,
        padding: 8,
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    iconText: {
        fontSize: 20,
        color: '#F4F5F7',
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#1B1C2A',
        borderRadius: 24,
        padding: 6,
        marginVertical: 24,
        borderWidth: 1,
        borderColor: 'rgba(79, 38, 224, 0.2)',
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    publicActive: {
        backgroundColor: '#4f26e0', // Purple for public
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    privateActive: {
        backgroundColor: '#FF6B6B', // Soft coral for private
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    inactive: {
        backgroundColor: 'transparent',
    },
    toggleText: {
        color: '#F4F5F7',
        fontWeight: '700',
        fontSize: 16,
    },
    memberCard: {
        backgroundColor: '#1B1C2A',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#4f26e0', // Purple accent
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    memberText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '600',
    },
    addButton: {
        backgroundColor: '#3B3D8A', // Deep indigo for add button
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#3B3D8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    addButtonText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '700',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 28,
        gap: 16,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createButton: {
        backgroundColor: '#4f26e0', // Purple for create
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    cancelButton: {
        backgroundColor: '#FF6B6B', // Coral for cancel
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    buttonText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '700',
    },
    loader: {
        marginTop: 24,
    },
});

export default CreateEventModal;
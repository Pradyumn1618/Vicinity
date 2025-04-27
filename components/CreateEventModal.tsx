import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Modal, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
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
    const db = getFirestore();

    const handleAddUserInput = (username: string) => {
        if (username.trim() !== '') {
            setUserInputs([...userInputs, username]);
        }
    };

    // const handleUserInputChange = (index: number, value: string) => {
    //     const updatedInputs = [...userInputs];
    //     updatedInputs[index] = value;
    //     setUserInputs(updatedInputs);
    // };

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

    // const handlePlaceSelected = (venue: string, location: { lat: number; lng: number }) => {
    //     setForm({ ...form, venue, location });
    // };

    const handleCreateEvent = async () => {
        try {
            setLoading(true);

            // Generate geohash for the venue location
            const geohash = geohashForLocation([form.location.lat, form.location.lng]).substring(0, 5);

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
                geohash,
                createdBy: username,
                createdAt: serverTimestamp(),
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

    // const handleDateChange = (event: any, selectedDate?: Date) => {
    //     setShowDatePicker(false);
    //     if (selectedDate) {
    //         setForm({ ...form, dateTime: selectedDate });
    //     }
    // };

    // const handleTimeChange = (event: any, selectedTime?: Date) => {
    //     setShowTimePicker(false);
    //     if (selectedTime) {
    //         const updatedDateTime = new Date(form.dateTime);
    //         updatedDateTime.setHours(selectedTime.getHours());
    //         updatedDateTime.setMinutes(selectedTime.getMinutes());
    //         setForm({ ...form, dateTime: updatedDateTime });
    //     }
    // };

    // const togglePublicPrivate = () => {
    //     setForm({ ...form, public: !form.public });
    // };

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
                        value={form.title}
                        onChangeText={text => setForm({ ...form, title: text })}
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="Description"
                        value={form.description}
                        onChangeText={text => setForm({ ...form, description: text })}
                        multiline
                        style={[styles.input, { height: 100 }]}
                    />

                    <View style={{ marginBottom: 16 }}>
                        <Button
                            title={`Select Date: ${form.dateTime.toLocaleDateString()}`}
                            onPress={() => setShowDatePicker(true)}
                        />
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
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Button
                            title={`Select Time: ${form.dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            onPress={() => setShowTimePicker(true)}
                        />
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
                        // onPlaceSelected={handlePlaceSelected}
                        onPlaceSelected={(venue, location) => setForm({ ...form, venue, location })}
                    />

                    {/* Fancy Toggle */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                form.public ? styles.publicActive : styles.inactive,
                            ]}
                            // onPress={togglePublicPrivate}
                            onPress={() => setForm({ ...form, public: true })}
                        >
                            <Text style={styles.toggleText}>Public</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                !form.public ? styles.privateActive : styles.inactive,
                            ]}
                            // onPress={togglePublicPrivate}
                            onPress={() => setForm({ ...form, public: false })}
                        >
                            <Text style={styles.toggleText}>Private</Text>
                        </TouchableOpacity>
                    </View>

                    {!form.public && (
                        <View>
                            {userInputs.filter(input => input.trim() !== '').length > 0 && (
                                <>
                                    <Text style={styles.title}>Allowed Users</Text>
                                    {userInputs
                                        .filter(input => input.trim() !== '') // Filter out empty strings
                                        .map((input, index) => (
                                            <View key={index} style={styles.memberCard}>
                                                <Text style={styles.memberText}>{input}</Text>
                                            </View>
                                        ))}
                                </>
                            )}
                            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddMemberModal(true)}>
                                <Text style={styles.addButtonText}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    )}


                    <Button title="Create Event" onPress={handleCreateEvent} disabled={loading} />

                    {loading && <ActivityIndicator size="large" style={{ marginTop: 16 }} />}
                    <Button title="Cancel" onPress={handleCancel} color="red" />
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
    scrollContainer: {
        flexGrow: 1,
    },
    container: {
        padding: 16,
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: 'white',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
        color: 'white',
        backgroundColor: '#1e1e1e',
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 16,
    },
    toggleButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    publicActive: {
        backgroundColor: '#4caf50',
    },
    privateActive: {
        backgroundColor: '#f44336',
    },
    inactive: {
        backgroundColor: '#555',
    },
    toggleText: {
        color: 'white',
        fontWeight: 'bold',
    },
    addButton: {
        backgroundColor: '#4caf50', // Green background for the "Add Member" button
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 16,
    },
    addButtonText: {
        color: '#ffffff', // White text for the button
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberCard: {
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    memberText: {
        color: '#ffffff',
        fontSize: 16,
    },
});

export default CreateEventModal;
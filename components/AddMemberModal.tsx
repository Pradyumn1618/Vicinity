import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TextStyle, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { getFirestore } from '@react-native-firebase/firestore';

const db = getFirestore();

interface AddMemberModalProps {
    visible: boolean;
    onClose: () => void;
    onAddMember: (username: string) => void;
    fetchSuggestions: (query: string) => Promise<string[]>;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ visible, onClose, onAddMember, fetchSuggestions }) => {
    const [username, setUsername] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const handleInputChange = async (text: string) => {
        setUsername(text);
        if (text.trim() === '') {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const results = await fetchSuggestions(text.trim());
            setSuggestions(results);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (selectedUsername?: string) => {
        const finalUsername = selectedUsername || username.trim();
        if (finalUsername !== '') {
            onAddMember(finalUsername);
            setUsername(''); // Clear the input field
            setSuggestions([]); // Clear suggestions
            onClose(); // Close the modal
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.title}>Add Member</Text>
                    <TextInput
                        placeholder="Enter username"
                        placeholderTextColor="#888"
                        value={username}
                        onChangeText={handleInputChange}
                        style={styles.input}
                    />
                    {suggestions.length > 0 && (
                        <FlatList
                            data={suggestions}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            style={styles.suggestionList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleAdd(item)}
                                >
                                    <Text style={styles.suggestionText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.addButton} onPress={() => handleAdd()}>
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#1e1e1e', // Dark gray background
        borderRadius: 8,
        padding: 16,
        width: '80%',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
        color: '#ffffff',
        backgroundColor: '#2a2a2a',
        width: '100%',
    },
    suggestionList: {
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        maxHeight: 150, // Limit the height of the suggestion list
        width: '100%',
        marginBottom: 8,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    suggestionText: {
        color: '#ffffff',
        fontSize: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    addButton: {
        backgroundColor: '#4caf50',
        padding: 12,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
        marginRight: 8,
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: '#f44336',
        padding: 12,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
        marginLeft: 8,
    },
    cancelButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddMemberModal;
import React from 'react';
import { StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface VenueAutocompleteProps {
    onPlaceSelected: (venue: string, location: { lat: number; lng: number }) => void;
    apiKey: 'AIzaSyDnZC4J2uKlWfFV-KDghvHn-BnWfzFo1YI';
}

const VenueAutocomplete: React.FC<VenueAutocompleteProps> = ({ onPlaceSelected, apiKey }) => {
    return (
        <GooglePlacesAutocomplete
            placeholder="Search Venue"
            fetchDetails={true}
            onPress={(data, details = null) => {
                console.log('Selected Place:', data, details);
                if (details) {
                    const { lat, lng } = details.geometry.location;
                    onPlaceSelected(data.description, { lat, lng });
                }
            }}
            query={{
                key: apiKey,
                language: 'en',
            }}
            styles={{
                textInput: styles.textInput,
                container: styles.container,
                listView: styles.listView,
                row: styles.row,
                separator: styles.separator,
                description: styles.description,
            }}
            onFail={(error) => console.error('Autocomplete Error:', error)} // Log errors
            onNotFound={() => console.warn('No results found')} // Log when no results are found
        />
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 0,
        marginBottom: 16,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        color: 'white',
        backgroundColor: '#1e1e1e',
    },
    listView: {
        backgroundColor: '#1e1e1e', // Dark gray background for the suggestion list
        borderRadius: 8, // Rounded corners for the list
        marginHorizontal: 8, // Space between the list and the screen edges
        elevation: 5, // For Android shadow
        shadowColor: '#000', // For iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        maxHeight: 200, // Limit the height of the list
    },
    row: {
        padding: 12,
        backgroundColor: '#1e1e1e', // Slightly lighter gray for individual items
        borderBottomWidth: 1,
        borderBottomColor: '#444', // Subtle border between items
        borderRadius: 4, // Rounded corners for individual items
        marginHorizontal: 4, // Space between items and the list edges
    },
    separator: {
        height: 1,
        backgroundColor: '#444', // Subtle separator color
    },
    description: {
        color: '#ffffff', // White text for better contrast
        fontSize: 16,
    },
});

export default VenueAutocomplete;
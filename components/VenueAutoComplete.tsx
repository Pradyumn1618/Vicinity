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
        backgroundColor: 'white',
        borderRadius: 8,
        marginHorizontal: 8,
        elevation: 5, // For Android shadow
        shadowColor: '#000', // For iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    row: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    separator: {
        height: 1,
        backgroundColor: '#444',
    },
    description: {
        // backgroundColor: '#1e1e1e',
        color: 'black',
    },
});

export default VenueAutocomplete;
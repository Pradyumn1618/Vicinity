// import { check, PERMISSIONS, RESULTS } from "react-native-permissions";
// import { Alert, Linking } from "react-native";
import { PermissionsAndroid, Platform } from "react-native";
import Geolocation from '@react-native-community/geolocation';
import Geohash from 'ngeohash';
import mmkv from '../storage';
import { collection, GeoPoint, getFirestore } from "@react-native-firebase/firestore";
import { useSocket } from "./socketProvider";

const firestore = getFirestore();

export const requestLocationPermission = async (needsBackground = false) => {
    if (Platform.OS === 'android') {
        try {
            // Request foreground permissions first
            const foregroundGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "Location Access Required",
                    message: "This app needs location access to show nearby posts",
                    buttonNeutral: "Ask Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK",
                }
            );

            if (foregroundGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return false;
            }

            // For Android 10+ background location
            if (needsBackground && Platform.Version >= 29) {
                const backgroundGranted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                    {
                        title: "Background Location Required",
                        message: "Enable 'Allow all the time' for post updates in background",
                        buttonNeutral: "Ask Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK",
                    }
                );
                
                return backgroundGranted === PermissionsAndroid.RESULTS.GRANTED;
            }

            return true;
            
        } catch (err) {
            console.warn("Location permission error:", err);
            return false;
        }
    }
    return true; // iOS handling
};


export const startLocationTracking = (userId: string) => {
    Geolocation.watchPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        const currentGeoHash = Geohash.encode(latitude, longitude, 7); // Adjust precision as needed
  
        const oldHash = mmkv.getString('geohash');
  
        if (currentGeoHash !== oldHash) {
          mmkv.set('geohash', currentGeoHash);
          console.log('Geohash updated:', currentGeoHash);
          const socket = useSocket();
          socket.emit('update_location', {
            userId,
            geohash: currentGeoHash,
            oldHash,
          });

          // Firestore update
          if (userId !== '') {
            const userRef = collection(firestore, 'users').doc(userId);
            await userRef.update({
              geohash: currentGeoHash,
              location: new GeoPoint(latitude, longitude),
            })
            .then(() => {
              console.log('Location updated successfully');
            })
            .catch((error) => {
              console.error('Error updating location:', error);
            });
          }
  
          // Notify page/component
        }
      },
      error => {
        console.log('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 20, // Update only if user moves 20+ meters
        interval: 10000, // Every 10 seconds
        fastestInterval: 5000,
      }
    );
  };

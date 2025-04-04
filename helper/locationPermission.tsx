// import { check, PERMISSIONS, RESULTS } from "react-native-permissions";
// import { Alert, Linking } from "react-native";
import { PermissionsAndroid, Platform } from "react-native";

// const requestLocationPermission = async () => {
//     const permissionStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

//     if (permissionStatus === RESULTS.GRANTED) {
//         console.log("Permission already granted");
//         return true;
//     } else if (permissionStatus === RESULTS.DENIED) {
//         try {
//             const granted = await PermissionsAndroid.request(
//                 PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//                 {
//                     title: "Location Permission",
//                     message: "This app needs access to your location to show nearby posts.",
//                     buttonNeutral: "Ask Me Later",
//                     buttonNegative: "Deny",
//                     buttonPositive: "Allow",
//                 }
//             );
//             return granted === PermissionsAndroid.RESULTS.GRANTED;
//         } catch (err) {
//             console.warn(err);
//             return false;
//         }
//     } else if (permissionStatus === RESULTS.BLOCKED) {
//         console.log("Permission permanently denied. Ask user to enable manually.");
//         Alert.alert(
//             "Permission Required",
//             "Location permission is required. Please enable it from settings.",
//             [
//                 { text: "Cancel", style: "cancel" },
//                 { text: "Open Settings", onPress: () => Linking.openSettings() }
//             ]
//         );
//         return false;
//     }
// };


const requestLocationPermission = async (needsBackground = false) => {
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

export default requestLocationPermission;


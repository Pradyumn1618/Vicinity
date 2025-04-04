import React, { useEffect, useState } from "react";
import { View, TextInput, Button, Text, Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, GeoPoint } from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";
import GetLocation from "react-native-get-location";
import { NavigationProp, useFocusEffect } from "@react-navigation/native";
import { PermissionsAndroid } from "react-native";
import * as geofire from 'geofire-common';
import mmkv from "../storage";

// 🔒 Type for the navigation prop

const db = getFirestore();

interface OnboardingScreenProps {
    navigation: NavigationProp<any>;
}


export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
    const checkAuthentication = React.useCallback(() => {
        if (!mmkv.getString('user')) {
            // Use reset instead of navigate to remove the current screen from the stack
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        }
    }, [navigation]);
    useEffect(() => {
        checkAuthentication();
    }, [checkAuthentication]);
    useFocusEffect(
        React.useCallback(() => {
            checkAuthentication();

        }, [checkAuthentication])
    );

    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const user = auth().currentUser;

    useEffect(() => {
        const checkUserProfile = async () => {
            if (!user) return;

            // Reference to the user document
            const userRef = doc(db, "users", user.uid);
            // Get the document data
            const docSnap = await getDoc(userRef);

            // Access document data
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data?.username) {
                    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
                }
            } else {
                console.log("No such document!");
            }
            // else stay on the current screen to collect username/permissions
        };

        checkUserProfile();
    }, [navigation, user]);

    if (!user) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <Text className="text-black text-xl">Loading...</Text>
            </View>
        );
    }

    // ✅ Check if username is taken
    const isUsernameUnique = async (name: string) => {
        const usersRef = collection(db, "users");
        const snapshot = await getDoc(doc(usersRef, name));
        if (snapshot.exists) {
            console.log("Username already taken");
            setError("Username already taken.");
            return false;
        }
        return true;
    };

    // 📨 Request Notification Permission + Get FCM Token
    const getFCMToken = async () => {
        await messaging().requestPermission();
        return await messaging().getToken();
    };

    // const requestLocationPermission = async () => {
    //     try {
    //         const granted = await PermissionsAndroid.request(
    //             PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    //             {
    //                 title: "Location Permission",
    //                 message: "This app needs access to your location to show nearby posts.",
    //                 buttonNeutral: "Ask Me Later",
    //                 buttonNegative: "Deny",
    //                 buttonPositive: "Allow",
    //             }
    //         );
    //         return granted === PermissionsAndroid.RESULTS.GRANTED;
    //     } catch (err) {
    //         console.warn(err);
    //         return false;
    //     }
    // };

    const requestLocationPermission = async () => {
        if (Platform.OS === 'android') {
            const fineLocation = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,{
                    title: "Location Permission",
                    message: "This app needs access to your location to show nearby posts.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Deny",
                    buttonPositive: "Allow",
                }
            );
    
            const coarseLocation = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,{
                    title: "Location Permission",
                    message: "This app needs access to your location to show nearby posts.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Deny",
                    buttonPositive: "Allow",
                }
            );
    
            if (fineLocation === PermissionsAndroid.RESULTS.GRANTED || coarseLocation === PermissionsAndroid.RESULTS.GRANTED) {
                console.log("✅ Location permission granted");
                return true;
            } else {
                console.log("❌ Location permission denied");
                return false;
            }
        } else {
            return true; // iOS handles permissions differently
        }
    };
    const getLocation = async () => {
        const hasPermission = await requestLocationPermission();

        if (!hasPermission) {
            console.log("Location permission denied. Continuing without location.");
            return null; // Allow user to continue without location
        }

        return new Promise<{ coords: { latitude: number; longitude: number } } | null>((resolve) => {
            GetLocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
            })
                .then((position) => {
                    resolve({ coords: { latitude: position.latitude, longitude: position.longitude } });
                })
                .catch((err) => {
                    console.warn(err.code, err.message);
                    resolve(null); // Allow user to continue without location
                });
        });
    };



    const saveUserDataWithGeohash = async (userId: string, username: string, fcmToken: string) => {
        const position = await getLocation();
        let userData: any = { username, fcmToken }; // Start with required fields

        if (position) {
            const { latitude, longitude } = position.coords;
            userData.geohash = geofire.geohashForLocation([latitude, longitude]);
            userData.location = new GeoPoint(latitude, longitude); // Optional
            console.log("Location:", position.coords);
        }

        const userRef = doc(db, "users", userId);
        await setDoc(userRef, userData, { merge: true });
        console.log("User data saved with geohash:", userData);

        mmkv.set("geohash", userData.geohash);
    }




    // 💾 Submit Info
    const handleSubmit = async () => {
        setLoading(true);
        setError("");

        if (username.trim().length < 3) {
            setError("Username too short.");
            setLoading(false);
            return;
        }

        try {
            const unique = await isUsernameUnique(username.trim());
            if (!unique) {
                setError("Username already taken.");
                setLoading(false);
                return;
            }

            await saveUserDataWithGeohash(user.uid, username, await getFCMToken());

            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        } catch (err) {
            console.error(err);
            setError("Something went wrong.");
        }

        setLoading(false);
    };

    return (
        <View className="flex-1 p-6 justify-center bg-white">
            <Text className="text-2xl font-bold mb-4">Choose a Username</Text>

            <TextInput
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                className="border border-gray-300 rounded-xl p-3 mb-2"
            />

            {error !== "" && <Text className="text-red-500 mb-2">{error}</Text>}

            <Button
                title={loading ? "Saving..." : "Continue"}
                onPress={handleSubmit}
                disabled={loading}
            />
        </View>
    );
}

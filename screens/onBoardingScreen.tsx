import React, { useEffect, useState } from "react";
import { View, TextInput, Button, Text, TouchableOpacity, Image, ActivityIndicator, Alert, StyleSheet } from "react-native";
import auth from "@react-native-firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where } from "@react-native-firebase/firestore";
import { getStorage, ref } from "@react-native-firebase/storage";
import messaging from "@react-native-firebase/messaging";
import * as ImagePicker from 'react-native-image-picker';
import { NavigationProp, useFocusEffect } from "@react-navigation/native";
import mmkv from "../storage";
import { syncMessages } from "../helper/databaseHelper";

const db = getFirestore();
const storage = getStorage();

interface OnboardingScreenProps {
    navigation: NavigationProp<any>;
}

export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    const [profilePic, setProfilePic] = useState("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const user = auth().currentUser;

    const checkAuthentication = React.useCallback(() => {
        if (!mmkv.getString('user')) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        }
        setLoading(false);
    }, [navigation]);

    useEffect(() => {
        checkAuthentication();
    }, [checkAuthentication]);

    useFocusEffect(
        React.useCallback(() => {
            checkAuthentication();
        }, [checkAuthentication])
    );

    useEffect(() => {
        const checkUserProfile = async () => {
            if (!user) return;

            setLoading(true);
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists) {
                const data = docSnap.data();
                if (data?.username) {
                    const token = await auth().currentUser?.getIdToken();
                    if (token) {
                        syncMessages(token);
                    } else {
                        console.error("Failed to retrieve token.");
                    }
                    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
                }
            } else {
                console.log("No such document!");
            }
            setLoading(false);
        };

        checkUserProfile();
    }, [navigation, user]);

    if (!user) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    const isUsernameUnique = async (name: string) => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", name));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            setError("Username already taken.");
            return false;
        }
        return true;
    };

    const getFCMToken = async () => {
        await messaging().requestPermission();
        return await messaging().getToken();
    };

    const handleImagePick = async () => {
        ImagePicker.launchImageLibrary(
            { mediaType: 'photo', quality: 0.8 },
            async (response) => {
                if (response.didCancel) return;
                if (response.errorMessage) {
                    Alert.alert('Error', response.errorMessage);
                    return;
                }

                const imageUri = response.assets?.[0]?.uri;
                if (imageUri) {
                    setUploading(true);
                    const fileName = `profile_${user.uid}.jpg`;
                    const imageRef = ref(storage, `profile_pictures/${fileName}`);

                    try {
                        const uploadTask = imageRef.putFile(imageUri);
                        uploadTask.on(
                            'state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                console.log(`Upload is ${progress}% done`);
                            },
                            (error) => {
                                Alert.alert('Upload Error', error.message);
                                setUploading(false);
                            },
                            async () => {
                                const downloadURL = await imageRef.getDownloadURL();
                                setProfilePic(downloadURL);
                                setUploading(false);
                            }
                        );
                    } catch (error) {
                        Alert.alert('Error', `Failed to upload image: ${error.message}`);
                        setUploading(false);
                    }
                }
            }
        );
    };

    const saveUserDataWithGeohash = async (userId: string, username: string, bio: string, profilePic: string, fcmToken: string) => {
        let userData: any = { username, bio, profilePic, fcmToken };
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, userData, { merge: true });
        console.log("User data saved:", userData);
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");

        if (username.trim().length < 3) {
            setError("Username must be at least 3 characters.");
            setLoading(false);
            return;
        }

        try {
            const unique = await isUsernameUnique(username.trim());
            if (!unique) {
                setLoading(false);
                return;
            }

            await saveUserDataWithGeohash(user.uid, username, bio, profilePic, await getFCMToken());
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        } catch (err) {
            console.error(err);
            setError("Something went wrong.");
        }

        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set Up Your Profile</Text>

            <View style={styles.imageContainer}>
                <Image
                    source={
                        profilePic
                            ? { uri: profilePic }
                            : { uri: 'https://img.freepik.com/premium-vector/profile-picture-placeholder-avatar-silhouette-gray-tones-icon-colored-shapes-gradient_1076610-40164.jpg' }
                    }
                    style={styles.profileImage}
                />
                <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleImagePick}
                    disabled={uploading}
                >
                    <Text style={styles.uploadButtonText}>
                        {uploading ? 'Uploading...' : 'Upload Profile Picture'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.label}>Username</Text>
            <TextInput
                style={styles.input}
                placeholder="Enter username"
                placeholderTextColor="#7A8290"
                value={username}
                onChangeText={setUsername}
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about yourself"
                placeholderTextColor="#7A8290"
                value={bio}
                onChangeText={setBio}
                multiline
            />

            {error !== "" && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.submitButton]}
                    onPress={handleSubmit}
                    disabled={loading || uploading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Continue'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0B14', // Deep navy background
        padding: 28,
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A0B14',
    },
    loadingText: {
        color: '#F4F5F7',
        fontSize: 20,
        fontWeight: '600',
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
    imageContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#4f26e0', // Purple border
        shadowColor: '#4f26e0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        marginBottom: 16,
    },
    uploadButton: {
        backgroundColor: '#3B3D8A', // Deep indigo
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#3B3D8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    uploadButtonText: {
        color: '#F4F5F7',
        fontSize: 16,
        fontWeight: '700',
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        color: '#F4F5F7',
        marginBottom: 8,
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
    errorText: {
        color: '#FF6B6B', // Coral for error
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 16,
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 20,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButton: {
        backgroundColor: '#4f26e0', // Purple for submit
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
});
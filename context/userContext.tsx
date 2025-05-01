import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import auth from  '@react-native-firebase/auth';
import { getFirestore,doc, getDoc } from '@react-native-firebase/firestore';

interface UserData {
  id: string;
  username: string;
  profilePic: string;
  geohash: string;
  // add more fields as needed
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
}


const UserContext = createContext<UserContextType>({ user: null, loading: true });
const db = getFirestore();

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists) {
            const data = docSnap.data();
            setUser({
              id: firebaseUser.uid,
              username: data.username,
              profilePic: data.profilePic,
              geohash: data.geohash,
            });
            console.log('User data:', data);
          } else {
            console.warn('No user document found');
            setUser(null);
          }
        } catch (err) {
          console.error('Error fetching user:', err);
          setUser(null);
        }
      } else {
        setUser(null);
        console.log('No user is signed in');
      }
      console.log('User state changed:', firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

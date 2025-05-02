import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text } from 'react-native';
import { getFirestore, collection, query, where, orderBy, startAt, endAt, getDocs } from '@react-native-firebase/firestore';
import { useUser } from '../context/userContext';
import { Image } from 'react-native';
import NavigationBar from '../components/NavigationBar';

const SearchPage = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
    const { user } = useUser();

  const db = getFirestore();

  useEffect(() => {
    if (searchQuery.length === 0) {
      setFilteredUsers([]);
      return;
    }

    const fetchUsers = async () => {
      const usersRef = collection(db, 'users');

      const q = query(
        usersRef,
        orderBy('username'),
        startAt(searchQuery),
        endAt(searchQuery + '\uf8ff')
      );

      const querySnapshot = await getDocs(q);
    const currentUserId = user.id; // Replace with the actual current user ID
    const users = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(u => u.id !== currentUserId);

      setFilteredUsers(users);
    };

    fetchUsers();
  }, [searchQuery,db,user]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#1a1a1a' }}>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search users by username..."
        placeholderTextColor="#ccc"
        style={{
          padding: 10,
          backgroundColor: '#333',
          color: 'white',
          borderRadius: 8,
          marginBottom: 20,
        }}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={()=> {navigation.navigate('UserProfile', {userId:item.id})}}
          style={{ padding: 15, backgroundColor: '#2e2e2e', marginBottom: 10, borderRadius: 8 }}>
            <Image style={{ width: 50, height: 50, borderRadius: 25 }} source={{ uri: item.profilePic }} />
            <Text style={{ color: '#bbb', fontSize: 14 }}>{item.username}</Text>
          </TouchableOpacity>
        )}
      />
      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default SearchPage;

import { getFirestore } from "@react-native-firebase/firestore";
import { getDBConnection } from "../config/database";
// import { useChatContext } from "../context/chatContext";

interface Message {
    id: string;
    sender: string;
    text: string;
    media?: string | null;
    replyTo?: string | null;
    timestamp: number;
    delivered?: boolean;
    seen?: boolean;
}

export const insertMessage = async (message: Message, chatId: string, receiver: string): Promise<void> => {
    const db = await getDBConnection();
    await db.executeSql(
        'INSERT OR REPLACE INTO messages (id, chatId, sender, receiver, text, media,replyTo,timestamp,delivered,seen) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [message.id, chatId, message.sender, receiver, message.text, message.media, message.replyTo, message.timestamp, message.delivered, message.seen]
    );
};

export const getReceiver = async (chatId: string) => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql(
            'SELECT username,photoURL FROM chats WHERE id = ?', [chatId]
        );
        const rows = results[0].rows;
        return rows.item(0);
    } catch (error) {
        console.log(error.message)
    }
    return null;

}

export const getMessages = async (chatId: string, limit: number, offset: number = 0) => {
    const db = await getDBConnection();
    const results = await db.executeSql(
        'SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [chatId, limit, offset]
    );
    const rows = results[0].rows;
    const messages = [];
    for (let i = 0; i < rows.length; i++) {
        messages.push(rows.item(i));
    }
    return messages;
};


export const incrementUnreadCount = async (chatId: string) => {
    const db = await getDBConnection();
    console.log('Incrementing unread count for chatId (db function):', chatId);

    // Check if entry exists
    await db.executeSql(
        'UPDATE unread_counts SET count = count + 1 WHERE chatId = ?',
        [chatId]
    );

    // If no row was updated, insert new one
    await db.executeSql(
        'INSERT INTO unread_counts (chatId, count) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM unread_counts WHERE chatId = ?)',
        [chatId, chatId]
    );
};

export const decrementUnreadCount = async (chatId: string) => {
    const db = await getDBConnection();
    console.log('Decrementing unread count for chatId:', chatId);
    await db.executeSql(
        'UPDATE unread_counts SET count = count - 1 WHERE chatId = ? AND count > 0',
        [chatId]
    );
}

export const resetUnreadCount = async (chatId: string) => {
    const db = await getDBConnection();
    console.log('Resetting unread count for chatId:', chatId);
    await db.executeSql(
        'INSERT OR REPLACE INTO unread_counts (chatId, count) VALUES (?, ?)',
        [chatId, 0]
    );
    console.log('Reset unread count for chatId:', chatId);
}

export const deleteMessage = async (messageId: string) => {
    const db = await getDBConnection();
    await db.executeSql(
        'DELETE FROM messages WHERE id = ?',
        [messageId]
    );
};

export const getUnreadCount = async (chatId: string) => {
    const db = await getDBConnection();
    const results = await db.executeSql(
        'SELECT count FROM unread_counts WHERE chatId = ?',
        [chatId]
    );
    const rows = results[0].rows;
    if (rows.length > 0) {
        return rows.item(0).count;
    }
    return 0;
}

export const getAllChatsFromSQLite = async (userId: string) => {
    const db = await getDBConnection();
    const results = await db.executeSql(
        'SELECT * FROM chats WHERE participants LIKE ?', [`%${userId}%`]
    );
    const chats = [];
    for (let i = 0; i < results[0].rows.length; i++) {
        chats.push(results[0].rows.item(i));
    }
    for (let i = 0; i < chats.length; i++) {
        const unreadCount = await getUnreadCount(chats[i].id);
        chats[i].unreadCount = unreadCount;
        chats[i].participants = JSON.parse(chats[i].participants);
    }
    return chats;
};

export const insertOrUpdateChatInSQLite = async (chat: {
    id: string;
    participants: string[];
    photoURL: string | null;
    username: string | null;
}) => {
    const db = await getDBConnection();
    await db.executeSql(
        `INSERT OR REPLACE INTO chats (id, participants, photoURL, username)
       VALUES (?, ?, ?, ?)`,
        [
            chat.id,
            JSON.stringify(chat.participants),
            chat.photoURL,
            chat.username,
        ]
    );
};

export const resetUnreadTimestamp = async (chatId: string) => {
    const db = await getDBConnection();
    console.log('Resetting unread timestamp for chatId:', chatId);
    const timestamp = Date.now(); // Get the current timestamp in milliseconds
    console.log('timestamp_new:', timestamp);

    await db.executeSql(
        'INSERT OR REPLACE INTO unread_counts (chatId, UnreadTimestamp) VALUES (?, ?)',
        [chatId, timestamp]
    );
    console.log('Reset unread timestamp for chatId:', chatId);
}
export const getUnreadTimestamp = async (chatId: string) => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql(
            'SELECT UnreadTimestamp FROM unread_counts WHERE chatId = ?',
            [chatId]
        );
        const rows = results[0].rows;
        if (rows.length > 0) {
            console.log('UnreadTimestamp:', rows.item(0).UnreadTimestamp);
            return Number(rows.item(0).UnreadTimestamp);
        }
    } catch (error) {
        console.log('Error fetching unread timestamp:', error);
        return 0;
    }
    return 0;
}

export const setSeenMessages = async (chatId: string, userId: string, timestamp: number) => {
    const db = await getDBConnection();
    console.log('Setting seen messages for chatId:', chatId);
    console.log('timestamp:', timestamp);
    try {
        await db.executeSql(
            'UPDATE messages SET seen = 1 WHERE chatId = ? AND sender != ? AND seen = 0',
            [chatId, userId]
        );
    } catch (error) {
        console.log(error.message);
    }
    console.log('Set seen messages for chatId:', chatId);

    try {

        const fdb = getFirestore();
        const chatRef = fdb.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        if (chatSnap.exists) {
            const messagesRef = chatRef.collection('messages');
            const querySnapshot = await messagesRef
                .where('timestamp', '>=', timestamp - 10000)
                .get();

            const batch = fdb.batch();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.sender !== userId && data.seen === false) {
                    batch.set(doc.ref, { seen: true }, { merge: true });
                }
            });
            await batch.commit();
            console.log('set seen in firestore');

        }
    } catch (error) {
        console.log(error.message);
    }


}

export const getLocalMessages = async (chatId: string, beforeTimestamp: number, limit: number) => {
    const db = await getDBConnection(); // assuming you have a method for DB connection
    try {
        const result = await db.executeSql(
            `SELECT * FROM messages 
       WHERE chatId = ? AND timestamp < ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [chatId, beforeTimestamp, limit]
        );

        const rows = result[0].rows;
        const messages = [];
        for (let i = 0; i < rows.length; i++) {
            messages.push(rows.item(i));
        }
        return messages;
    } catch (error) {
        console.log('Error fetching local messages:', error);
        return [];
    }
};

export const insertIntoDeletedMessages = async (messageId: string, chatId: string, receiver: string) => {
    const db = await getDBConnection();
    try {
        await db.executeSql(
            'INSERT OR IGNORE INTO deletedMessages (id, chatId, receiver) VALUES (?, ?, ?)',
            [messageId, chatId, receiver]
        );
    } catch (error) {
        console.log('Error inserting into deletedMessages:', error);
    }
};

export const getDeletedMessages = async (): Promise<{ id: string; chatId: string; receiver: string }[] | null> => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql('SELECT * FROM deletedMessages', []);
        const rows = results[0].rows;
        const deletedMessages: { id: string; chatId: string; receiver: string }[] = [];
        for (let i = 0; i < rows.length; i++) {
            deletedMessages.push(rows.item(i));
        }
        return deletedMessages;
    } catch (error) {
        console.log('Error fetching deleted messages:', error);
        return null;
    }
};

export const deleteFromDeletedMessages = async (messageId: string) => {
    const db = await getDBConnection();
    try {
        await db.executeSql(
            'DELETE FROM deletedMessages WHERE id = ?',
            [messageId]
        );
    } catch (error) {
        console.log('Error deleting message from deletedMessages:', error);
    }
};

import { getStorage, ref, deleteObject } from "@react-native-firebase/storage";
import { doc, getDoc, deleteDoc } from "@react-native-firebase/firestore";
import socket from "../config/socket";

const fdb = getFirestore();
const storage = getStorage();

export const syncOfflineDeletions = async () => {
    try {
        const db = await getDBConnection();
        const deletedMessages = await getDeletedMessages();
        if (deletedMessages) {
            if (!deletedMessages || !Array.isArray(deletedMessages)) {
                console.log('No deleted messages to sync.');
                return;
            }
            for (const message of deletedMessages) {
                const { id, chatId, receiver } = message;

                socket.emit('message-deleted', { messageId: id, chatId: chatId, receiver: receiver });

                // Reference to the message in Firestore

                const messageRef = doc(fdb, 'chats', chatId, 'messages', id);
                const messageDoc = await getDoc(messageRef);

                if (messageDoc.exists) {
                    const messageData = messageDoc.data();

                    // Check if the message has media
                    if (messageData?.media) {
                        const mediaUrl = messageData.media;

                        // Extract the file path from the media URL
                        const filePath = decodeURIComponent(mediaUrl.split('/o/')[1].split('?')[0]);

                        // Reference to the file in Firebase Storage
                        const storageRef = ref(storage, filePath);

                        // Delete the file from Firebase Storage
                        await deleteObject(storageRef);
                        console.log('Media deleted successfully from storage');
                    }

                    // Delete the message from Firestore
                    await deleteDoc(messageRef);
                }
            }
        }
        console.log('Deleted messages synced successfully');
        await db.executeSql('DELETE FROM deletedMessages', []);
    } catch (error) {
        console.log('Error syncing deleted messages:', error);
        throw error;
    }
}

export const getMediaFromLocalDB = async (chatId:string,offset: number=0, limit: number) => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql(
            'SELECT media, timestamp FROM messages WHERE chatId = ? AND media IS NOT NULL ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            [chatId, limit, offset]
        );
        const rows = results[0].rows;
        const mediaList = [];
        for (let i = 0; i < rows.length; i++) {
            mediaList.push(rows.item(i));
        }
        return mediaList;
    } catch (error) {
        console.log('Error fetching media from local DB:', error);
        return [];
    }
}

export const filterMessagesDB = async (searchText:string='',chatId:string) => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql(
            'SELECT * FROM messages WHERE chatId = ? AND text LIKE ? ORDER BY timestamp DESC',
            [chatId, `%${searchText}%`]
        );
        const rows = results[0].rows;
        const messages = [];
        for (let i = 0; i < rows.length; i++) {
            messages.push(rows.item(i));
        }
        return messages;
    } catch (error) {
        console.log('Error filtering messages:', error);
        return [];
    }
}

export const getMessagesBetweenTimeRange = async (chatId:string,timestampHigh:number,timestampLow:number) => {
    const db = await getDBConnection();
    try {
        const results = await db.executeSql(
            'SELECT * FROM messages WHERE chatId = ? AND timestamp < ? AND timestamp >= ? ORDER BY timestamp DESC',
            [chatId, timestampHigh,timestampLow ]
        );
        const rows = results[0].rows;
        const messages = [];
        for (let i = 0; i < rows.length; i++) {
            messages.push(rows.item(i));
        }
        return messages;
    } catch (error) {
        console.log('Error fetching messages:', error);
        return [];
    }
}

export const CheckAndLoadMessage = async (chatId:string,messageId:string,timestamp:number) => {
    const messageRef = fdb.collection('chats').doc(chatId).collection('messages').doc(messageId);   
    const messageSnap = await messageRef.get();
    if (messageSnap.exists) {
        const messages = await getMessagesBetweenTimeRange(chatId,timestamp,messageSnap.data()?.timestamp);
        if (messages.length > 0) {
            console.log('Messages loaded successfully from SQLite');
            return messages;
        } else {
            console.log('No messages found in SQLite');
            return null;
        }
    } else {
        console.log('Message does not exist in Firestore');
        return null;
    }
}

export const syncMessages = async (token:string) => {    
    try {
        const messages = await fetch('https://vicinity-backend.onrender.com/all-messages',{
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
        }});
        const messagesData = await messages.json();
        if (messagesData && messagesData.length > 0) {
            for (const message of messagesData) {
                await insertMessage(message, message.chatId, message.receiver);
            }
            console.log('Messages synced successfully');
        } else {
            console.log('No messages to sync');
        }
    } catch (error) {
        console.log('Error fetching messages:', error);
        return [];
    }
}



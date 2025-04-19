import { getDBConnection } from "../config/database";
// import { useChatContext } from "../context/chatContext";

interface Message {
    id: string;
    sender: string;
    text: string;
    media?: string | null;
    replyTo?: { text: string; id: string } | null;
    timestamp: number;
    delivered?: boolean;
    seen?: boolean;
}

export const insertMessage = async (message: Message, chatId: string, receiver: string): Promise<void> => {
    const db = await getDBConnection();
    await db.executeSql(
        'INSERT OR REPLACE INTO messages (id, chatId, sender, receiver, text, media, replyToText,replyToId,timestamp,delivered,seen) VALUES (?,?,?,?,?,?,?,?,?,?,?,)',
        [message.id, chatId, message.sender, receiver, message.text, message.media, message.replyTo?.text, message.replyTo?.id, message.timestamp, message.delivered, message.seen]
    );
};

export const getMessages = async (chatId: string,limit:number,offset:number=0) => {
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
    await db.executeSql(
        'INSERT OR REPLACE INTO unread_counts (chatId, UnreadTimestamp) VALUES (?, DateTime("now"))',
        [chatId]
    );
    console.log('Reset unread timestamp for chatId:', chatId);
}
export const getUnreadTimestamp = async (chatId: string) => {
    const db = await getDBConnection();
    const results = await db.executeSql(
        'SELECT UnreadTimestamp FROM unread_counts WHERE chatId = ?',
        [chatId]
    );
    const rows = results[0].rows;
    if (rows.length > 0) {
        return rows.item(0).UnreadTimestamp;
    }
    return null;
}

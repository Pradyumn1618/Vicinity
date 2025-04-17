import { getDBConnection } from "../config/database";

interface Message {
    id: string;
    chatId: string;
    sender: string;
    receiver: string;
    content: string;
    type: string;
    timestamp: number;
}

export const insertMessage = async (message: Message): Promise<void> => {
    const db = await getDBConnection();
    await db.executeSql(
        'INSERT OR REPLACE INTO messages (id, chatId, sender, receiver, content, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [message.id, message.chatId, message.sender, message.receiver, message.content, message.type, message.timestamp]
    );
};

export const getMessages = async (chatId: string) => {
    const db = await getDBConnection();
    const results = await db.executeSql(
        'SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC',
        [chatId]
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
  
    // Check if entry exists
    const result = await db.executeSql(
      'SELECT count FROM unread_counts WHERE chatId = ?',
      [chatId]
    );
  
    const existingCount = result[0].rows.length > 0 ? result[0].rows.item(0).count : 0;
    const newCount = existingCount + 1;
  
    // Insert or replace with new count
    await db.executeSql(
      'INSERT OR REPLACE INTO unread_counts (chatId, count) VALUES (?, ?)',
      [chatId, newCount]
    );
  };

export const resetUnreadCount = async (chatId: string) => {
    const db = await getDBConnection();
    await db.executeSql(
        'INSERT OR REPLACE INTO unread_counts (chatId, count) VALUES (?, ?)',
        [chatId, 0]
    );
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

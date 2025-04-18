// database.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export const getDBConnection = async () => {
    return await SQLite.openDatabase({ name: 'vicinity.db', location: 'default' });
};

export const createTables = async (db: SQLite.SQLiteDatabase) => {
    // Messages Table
    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      sender TEXT,
      receiver TEXT,
      text TEXT,
      media TEXT,
      replyToText TEXT,
      replyToId TEXT,
      timestamp INTEGER,
      delivered INTEGER DEFAULT 0,
      seen INTEGER DEFAULT 0
    );
  `);

    // Unread Count Table
    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS unread_counts (
      chatId TEXT PRIMARY KEY,
      count INTEGER
    );
  `);

    await db.executeSql(`CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  participants TEXT, -- Stored as JSON string
  photoURL TEXT,
  username TEXT
);
    `);


};

export const closeDB = async (db: SQLite.SQLiteDatabase) => {
    if (db) {
        await db.close();
    }
};

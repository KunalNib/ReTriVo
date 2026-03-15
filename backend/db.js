import { createClient } from '@libsql/client';
import "dotenv/config";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize tables
export async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      filename TEXT NOT NULL,
      url TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      role TEXT NOT NULL,  -- 'user' or 'assistant'
      content TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE
    );`
  ], "write");

  // Migration for existing databases
  try {
    await db.execute("ALTER TABLE documents ADD COLUMN url TEXT;");
  } catch (err) {
    // column already exists
  }
}

export default db;

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initDB() {
  db = await open({
    filename: './data.sqlite',
    driver: sqlite3.Database
  });
  
  await db.run(`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      discordId TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
}

export async function getTokens(discordId: string) {
  if (!db) await initDB();
  return db!.get('SELECT * FROM spotify_tokens WHERE discordId = ?', discordId);
}

export async function setTokens(discordId: string, access_token: string, refresh_token: string, expires_at: number) {
  if (!db) await initDB();
  await db!.run(
    'INSERT OR REPLACE INTO spotify_tokens (discordId, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
    discordId,
    access_token,
    refresh_token,
    expires_at
  );
}

export async function updateAccessToken(discordId: string, access_token: string, expires_at: number) {
  if (!db) await initDB();
  await db!.run(
    'UPDATE spotify_tokens SET access_token = ?, expires_at = ? WHERE discordId = ?',
    access_token,
    expires_at,
    discordId
  );
}

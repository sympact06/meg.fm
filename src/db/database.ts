import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { migrateUp } from './migrations/migrationManager';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

let db: Database | null = null;

export const initDB = getDB;

export async function getDB(): Promise<Database> {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './data.sqlite';
    const dbDir = path.dirname(dbPath);

    // Ensure the database directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    try {
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      // Enable foreign keys and WAL mode for better performance and data integrity
      await db.exec('PRAGMA foreign_keys = ON');
      await db.exec('PRAGMA journal_mode = WAL');

      // Run migrations
      await migrateUp(db);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Database initialization failed');
    }
  }
  return db;
}

export async function getTokens(discordId: string) {
  const db = await getDB();
  return db.get('SELECT * FROM spotify_tokens WHERE discordId = ?', discordId);
}

export async function setTokens(
  discordId: string,
  access_token: string,
  refresh_token: string,
  expires_at: number
) {
  const db = await getDB();
  await db.run(
    'INSERT OR REPLACE INTO spotify_tokens (discordId, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
    discordId,
    access_token,
    refresh_token,
    expires_at
  );
}

export async function updateAccessToken(
  discordId: string,
  access_token: string,
  expires_at: number
) {
  const db = await getDB();
  await db.run(
    'UPDATE spotify_tokens SET access_token = ?, expires_at = ? WHERE discordId = ?',
    access_token,
    expires_at,
    discordId
  );
}

export async function getLastTrackedSong(discordId: string) {
  const db = await getDB();
  return db.get(
    `SELECT trackId, timestamp FROM listening_history 
     WHERE discordId = ? 
     ORDER BY timestamp DESC LIMIT 1`,
    discordId
  );
}

export async function recordListening(discordId: string, track: any) {
  const db = await getDB();

  const timestamp = Math.floor(Date.now() / 1000);

  try {
    const lastTrack = await getLastTrackedSong(discordId);

    if (lastTrack && lastTrack.trackId === track.id) {
      const timeSinceLastTrack = timestamp - lastTrack.timestamp;
      if (timeSinceLastTrack < Math.ceil(track.duration_ms / 1000)) {
        console.log(
          `[Tracking] Skipping duplicate track ${track.name} - still playing (${timeSinceLastTrack}s since last record)`
        );
        return false;
      }
    }

    await db.run(
      `INSERT INTO listening_history 
       (discordId, trackId, trackName, artistName, albumName, timestamp, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      discordId,
      track.id,
      track.name,
      track.artists[0].name,
      track.album.name,
      timestamp,
      track.duration_ms
    );

    await updateUserStats(discordId, track);
    return true;
  } catch (error) {
    console.error('Error recording listening history:', error);
    return false;
  }
}

async function updateUserStats(discordId: string, track: any) {
  const db = await getDB();
  const playCount = await db.get(
    `SELECT COUNT(*) as count FROM listening_history 
     WHERE discordId = ? AND trackId = ?`,
    discordId,
    track.id
  );

  if (playCount.count === 1) {
    await db.run(
      `
      INSERT OR REPLACE INTO user_statistics (
        discordId,
        total_tracks_played,
        total_listening_time_ms,
        last_checked,
        favorite_artist,
        favorite_track
      )
      VALUES (?, 
        COALESCE((SELECT total_tracks_played + 1 FROM user_statistics WHERE discordId = ?), 1),
        COALESCE((SELECT total_listening_time_ms + ? FROM user_statistics WHERE discordId = ?), ?),
        ?,
        (SELECT artist FROM (
          SELECT artistName as artist, COUNT(*) as plays 
          FROM listening_history 
          WHERE discordId = ? 
          GROUP BY artistName 
          ORDER BY plays DESC LIMIT 1
        )),
        (SELECT track FROM (
          SELECT trackName as track, COUNT(*) as plays 
          FROM listening_history 
          WHERE discordId = ? 
          GROUP BY trackName 
          ORDER BY plays DESC LIMIT 1
        ))
      )`,
      discordId,
      discordId,
      track.duration_ms,
      discordId,
      track.duration_ms,
      Math.floor(Date.now() / 1000),
      discordId,
      discordId
    );
  }
}

export async function getAllAuthorizedUsers() {
  const db = await getDB();
  return db.all('SELECT discordId FROM spotify_tokens');
}

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initDB() {
  db = await open({
    filename: './data.sqlite',
    driver: sqlite3.Database
  });
  
  // Existing tables
  await db.run(`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      discordId TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // New tables for tracking
  await db.run(`
    CREATE TABLE IF NOT EXISTS listening_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discordId TEXT NOT NULL,
      trackId TEXT NOT NULL,
      trackName TEXT NOT NULL,
      artistName TEXT NOT NULL,
      albumName TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      UNIQUE(discordId, trackId, timestamp)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS user_statistics (
      discordId TEXT PRIMARY KEY,
      total_tracks_played INTEGER DEFAULT 0,
      total_listening_time_ms INTEGER DEFAULT 0,
      last_checked INTEGER DEFAULT 0,
      favorite_artist TEXT,
      favorite_track TEXT
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

// Add new functions for tracking
export async function getLastTrackedSong(discordId: string) {
  if (!db) await initDB();
  return db!.get(
    `SELECT trackId, timestamp FROM listening_history 
     WHERE discordId = ? 
     ORDER BY timestamp DESC LIMIT 1`,
    discordId
  );
}

export async function recordListening(discordId: string, track: any) {
  if (!db) await initDB();
  
  const timestamp = Math.floor(Date.now() / 1000);
  
  try {
    // Get the last tracked song for this user
    const lastTrack = await getLastTrackedSong(discordId);
    
    // Skip if it's the same song and within its duration
    if (lastTrack && lastTrack.trackId === track.id) {
      const timeSinceLastTrack = timestamp - lastTrack.timestamp;
      if (timeSinceLastTrack < Math.ceil(track.duration_ms / 1000)) {
        console.log(`[Tracking] Skipping duplicate track ${track.name} - still playing (${timeSinceLastTrack}s since last record)`);
        return false;
      }
    }

    // If it's a different song or enough time has passed, record it
    await db!.run(
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
  // Get current play count for this track
  const playCount = await db!.get(
    `SELECT COUNT(*) as count FROM listening_history 
     WHERE discordId = ? AND trackId = ?`,
    discordId,
    track.id
  );

  // Update stats only if this is the first play of the track
  if (playCount.count === 1) {
    await db!.run(`
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
  if (!db) await initDB();
  return db!.all('SELECT discordId FROM spotify_tokens');
}

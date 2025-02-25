import { Database } from 'sqlite';

export async function up(db: Database): Promise<void> {
  // Users tokens table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      discordId TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // Listening history table with indexes
  await db.exec(`
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

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_listening_history_discord_id ON listening_history(discordId)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_listening_history_timestamp ON listening_history(timestamp)
  `);

  // User statistics table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_statistics (
      discordId TEXT PRIMARY KEY,
      total_tracks_played INTEGER DEFAULT 0,
      total_listening_time_ms INTEGER DEFAULT 0,
      last_checked INTEGER DEFAULT 0,
      favorite_artist TEXT,
      favorite_track TEXT
    )
  `);

  // Achievements table with indexes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      discordId TEXT,
      achievement_id TEXT,
      unlocked_at INTEGER,
      progress INTEGER DEFAULT 0,
      PRIMARY KEY (discordId, achievement_id)
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_achievements_discord_id ON user_achievements(discordId)
  `);

  // Friends system table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT,
      friend_id TEXT,
      status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')) NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    )
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`DROP TABLE IF EXISTS spotify_tokens`);
  await db.exec(`DROP TABLE IF EXISTS listening_history`);
  await db.exec(`DROP TABLE IF EXISTS user_statistics`);
  await db.exec(`DROP TABLE IF EXISTS user_achievements`);
  await db.exec(`DROP TABLE IF EXISTS friends`);
}

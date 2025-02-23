import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

async function initDB() {
  if (!db) {
    db = await open({
      filename: './data.sqlite',
      driver: sqlite3.Database
    });
    await db.run(`
      CREATE TABLE IF NOT EXISTS track_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        discordId TEXT NOT NULL,
        vote TEXT NOT NULL,
        voted_at INTEGER NOT NULL,
        UNIQUE(track_id, discordId)
      )
    `);
  }
}

export async function recordVote(trackId: string, discordId: string, vote: string) {
  await initDB();
  try {
    await db!.run(
      'INSERT INTO track_votes (track_id, discordId, vote, voted_at) VALUES (?, ?, ?, ?) ON CONFLICT(track_id, discordId) DO UPDATE SET vote = ?, voted_at = ?',
      trackId,
      discordId,
      vote,
      Date.now(),
      vote,
      Date.now()
    );
    console.log(`Vote recorded/updated for user ${discordId} on track ${trackId}: ${vote}`);
    return true;
  } catch (error) {
    console.error('Error recording vote:', error);
    return false;
  }
}

export async function getTotalVotes(trackId: string) {
  await initDB();
  const rows = await db!.all(
    'SELECT vote, COUNT(*) as count FROM track_votes WHERE track_id = ? GROUP BY vote',
    trackId
  );
  let likes = 0, dislikes = 0;
  rows.forEach(row => {
    if (row.vote === 'like') likes = row.count;
    if (row.vote === 'dislike') dislikes = row.count;
  });
  return { likes, dislikes };
}

export async function getUserVote(trackId: string, discordId: string) {
  await initDB();
  const vote = await db!.get(
    'SELECT vote FROM track_votes WHERE track_id = ? AND discordId = ?',
    trackId,
    discordId
  );
  return vote?.vote || null;
}

// Additional helper functions for fetching stats can be added here.

import { Database } from 'sqlite';
import { getDB } from './database';

export interface UserStats {
  total_tracks_played: number;
  total_listening_time_ms: number;
  favorite_artist: string;
  favorite_track: string;
  last_checked: number;
}

export interface ArtistStats {
  artistName: string;
  playCount: number;
  totalTime: number;
  lastPlayed: number;
}

export async function getUserStats(discordId: string): Promise<UserStats | null> {
  const db = await getDB();
  return db.get('SELECT * FROM user_statistics WHERE discordId = ?', discordId);
}

export async function getUserMostPlayedArtists(
  discordId: string,
  limit: number = 3
): Promise<ArtistStats[]> {
  const db = await getDB();
  return db.all(
    `
    SELECT 
      artistName,
      COUNT(*) as plays
    FROM listening_history 
    WHERE discordId = ?
    GROUP BY artistName
    ORDER BY plays DESC
    LIMIT ?
  `,
    discordId,
    limit
  );
}

export async function getTopTracks(discordId: string, limit: number = 3) {
  const db = await getDB();
  return db.all(
    `
    SELECT 
      trackName,
      artistName,
      COUNT(*) as plays
    FROM listening_history 
    WHERE discordId = ?
    GROUP BY trackId
    ORDER BY plays DESC
    LIMIT ?
  `,
    discordId,
    limit
  );
}

export async function getDetailedArtistStats(discordId: string): Promise<ArtistStats[]> {
  const db = await getDB();
  return db.all(
    `
    SELECT 
      artistName,
      COUNT(*) as playCount,
      SUM(duration_ms) as totalTime,
      MAX(timestamp) as lastPlayed
    FROM listening_history
    WHERE discordId = ?
    GROUP BY artistName
    ORDER BY playCount DESC
    LIMIT 10
  `,
    discordId
  );
}

export async function getGenreStats(discordId: string) {
  // wip
  return [];
}

export async function getListeningTrends(discordId: string) {
  const db = await getDB();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return db.all(
    `
    SELECT 
      date(datetime(timestamp, 'unixepoch')) as day,
      COUNT(*) as plays,
      COUNT(DISTINCT artistName) as unique_artists
    FROM listening_history
    WHERE discordId = ? AND timestamp > ?
    GROUP BY day
    ORDER BY day DESC
  `,
    discordId,
    Math.floor(thirtyDaysAgo / 1000)
  );
}

export async function compareListeningStats(user1: string, user2: string) {
  const db = await getDB();
  const [stats1, stats2] = await Promise.all([getUserStats(user1), getUserStats(user2)]);

  const commonArtists = await db.all(
    `
    SELECT h1.artistName, 
           COUNT(DISTINCT h1.trackId) as user1_tracks,
           COUNT(DISTINCT h2.trackId) as user2_tracks
    FROM listening_history h1
    INNER JOIN listening_history h2 
      ON h1.artistName = h2.artistName
    WHERE h1.discordId = ? AND h2.discordId = ?
    GROUP BY h1.artistName
    ORDER BY user1_tracks + user2_tracks DESC
    LIMIT 5
  `,
    user1,
    user2
  );

  return {
    stats1,
    stats2,
    commonArtists,
    matchScore: calculateMatchScore(stats1, stats2, commonArtists),
  };
}

function calculateMatchScore(
  stats1: UserStats | null,
  stats2: UserStats | null,
  commonArtists: any[]
): number {
  if (!stats1 || !stats2) return 0;

  const artistScore = commonArtists.length * 10;
  const timeScore =
    (Math.min(stats1.total_listening_time_ms, stats2.total_listening_time_ms) /
      Math.max(stats1.total_listening_time_ms, stats2.total_listening_time_ms)) *
    50;

  return Math.round(artistScore + timeScore);
}

export async function findCommonArtists(user1: string, user2: string): Promise<any[]> {
  const db = await getDB();
  return db.all(
    `
    SELECT 
      h1.artistName,
      COUNT(DISTINCT h1.trackId) as user1_tracks,
      COUNT(DISTINCT h2.trackId) as user2_tracks,
      h1.discordId as user1_id,
      h2.discordId as user2_id
    FROM listening_history h1
    INNER JOIN listening_history h2 
      ON h1.artistName = h2.artistName
    WHERE h1.discordId = ? AND h2.discordId = ?
    GROUP BY h1.artistName
    HAVING user1_tracks >= 2 AND user2_tracks >= 2
    ORDER BY (user1_tracks + user2_tracks) DESC
    LIMIT 10
  `,
    user1,
    user2
  );
}

export async function getListeningBattle(user1: string, user2: string) {
  const db = await getDB();

  const [user1Stats, user2Stats] = await Promise.all([getUserStats(user1), getUserStats(user2)]);

  const recentActivity = await db.all(
    `
    SELECT 
      discordId,
      COUNT(*) as tracks_today,
      COUNT(DISTINCT artistName) as artists_today
    FROM listening_history
    WHERE discordId IN (?, ?)
    AND timestamp > ?
    GROUP BY discordId
  `,
    user1,
    user2,
    Math.floor(Date.now() / 1000) - 86400
  );

  return {
    overall: {
      user1: user1Stats,
      user2: user2Stats,
    },
    today: recentActivity,
    battleScore: calculateBattleScore(user1Stats, user2Stats, recentActivity),
  };
}

function calculateBattleScore(
  stats1: UserStats | null,
  stats2: UserStats | null,
  recentActivity: any[]
): any {
  if (!stats1 || !stats2) return { user1: 0, user2: 0 };

  const today1 = recentActivity.find((a) => a.discordId === stats1.discordId) || {
    tracks_today: 0,
    artists_today: 0,
  };
  const today2 = recentActivity.find((a) => a.discordId === stats2.discordId) || {
    tracks_today: 0,
    artists_today: 0,
  };

  return {
    user1: calculateIndividualScore(stats1, today1),
    user2: calculateIndividualScore(stats2, today2),
  };
}

function calculateIndividualScore(stats: UserStats, today: any): number {
  const baseScore = Math.log10(stats.total_tracks_played) * 10;
  const activityScore = today.tracks_today * 2 + today.artists_today * 5;
  return Math.round(baseScore + activityScore);
}

export async function getRecentHighlights(discordId: string) {
  const db = await getDB();
  const lastWeek = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  return db.all(
    `
    SELECT 
      artistName,
      COUNT(*) as play_count,
      GROUP_CONCAT(DISTINCT trackName) as tracks
    FROM listening_history
    WHERE discordId = ? AND timestamp > ?
    GROUP BY artistName
    HAVING play_count >= 3
    ORDER BY play_count DESC
    LIMIT 5
  `,
    discordId,
    lastWeek
  );
}

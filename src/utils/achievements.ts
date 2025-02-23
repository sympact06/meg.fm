import { getDB } from '../db/database';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export async function getAchievements(discordId: string): Promise<Achievement[]> {
  const db = await getDB();
  const stats = await db.get('SELECT * FROM user_statistics WHERE discordId = ?', discordId);
  const achievements: Achievement[] = [];

  if (stats.total_tracks_played >= 100) {
    achievements.push({
      id: 'tracks_100',
      name: 'Music Explorer',
      emoji: '🎵',
      description: 'Listened to 100 tracks',
      rarity: 'common'
    });
  }
  if (stats.total_tracks_played >= 1000) {
    achievements.push({
      id: 'tracks_1000',
      name: 'Music Enthusiast',
      emoji: '🎼',
      description: 'Listened to 1,000 tracks',
      rarity: 'rare'
    });
  }

  const hoursListened = Math.floor(stats.total_listening_time_ms / 3600000);
  if (hoursListened >= 24) {
    achievements.push({
      id: 'time_24',
      name: 'Day Tripper',
      emoji: '🌞',
      description: 'Listened for 24 hours total',
      rarity: 'common'
    });
  }
  if (hoursListened >= 168) {
    achievements.push({
      id: 'time_week',
      name: 'Weekly Wonder',
      emoji: '📅',
      description: 'Listened for a full week',
      rarity: 'epic'
    });
  }

  const coldplayPlays = await db.get(`
    SELECT COUNT(*) as count
    FROM listening_history
    WHERE discordId = ? AND artistName = 'Coldplay'
  `, discordId);

  if (coldplayPlays.count >= 50) {
    const coldplayRank = await db.get(`
      SELECT COUNT(*) as betterListeners
      FROM (
        SELECT discordId, COUNT(*) as plays
        FROM listening_history
        WHERE artistName = 'Coldplay'
        GROUP BY discordId
        HAVING plays > ?
      )
    `, coldplayPlays.count);

    if (coldplayRank.betterListeners < 10) {
      achievements.push({
        id: 'coldplay_fan',
        name: 'Paradise Found',
        emoji: '🌟',
        description: 'One of top 10 Coldplay listeners!',
        rarity: 'legendary'
      });
    }
  }

  const totalUsers = await db.get(`
    SELECT COUNT(DISTINCT discordId) as count
    FROM listening_history
  `);

  if (totalUsers.count >= 4) { // At least 4 users for competition
    const userRank = await db.get(`
      WITH UserPlays AS (
        SELECT discordId, COUNT(*) as plays
        FROM listening_history
        GROUP BY discordId
      )
      SELECT COUNT(*) as betterListeners
      FROM UserPlays
      WHERE plays > (SELECT plays FROM UserPlays WHERE discordId = ?)
    `, discordId);

    if (userRank.betterListeners === 0) {
      achievements.push({
        id: 'top_listener',
        name: 'Music Maven',
        emoji: '👑',
        description: 'The #1 listener on meg.fm!',
        rarity: 'legendary'
      });
    }
  }

  const uniqueArtists = await db.get(`
    SELECT COUNT(DISTINCT artistName) as count
    FROM listening_history
    WHERE discordId = ?
  `, discordId);

  if (uniqueArtists.count >= 50) {
    achievements.push({
      id: 'variety_50',
      name: 'Genre Jumper',
      emoji: '🎪',
      description: 'Listened to 50 different artists',
      rarity: 'rare'
    });
  }

  const consecutiveDays = await db.get(`
    WITH RECURSIVE dates AS (
      SELECT date(datetime(timestamp, 'unixepoch')) as day
      FROM listening_history
      WHERE discordId = ?
      GROUP BY day
    )
    SELECT COUNT(*) as streak
    FROM (
      SELECT day, 
             julianday(day) - julianday(LAG(day) OVER (ORDER BY day)) as diff
      FROM dates
    )
    WHERE diff = 1
  `, discordId);

  if (consecutiveDays.streak >= 7) {
    achievements.push({
      id: 'streak_7',
      name: 'Rhythm Keeper',
      emoji: '🎧',
      description: 'Listened every day for a week',
      rarity: 'epic'
    });
  }

  return achievements;
}

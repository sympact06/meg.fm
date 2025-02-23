import { getDB } from '../db/database';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  progress?: {
    current: number;
    target: number;
    display: string;
  };
  unlockedAt?: number;
  secret?: boolean;
  completed?: boolean;
}

export type AchievementCategory = 'dedication' | 'explorer' | 'artist' | 'social' | 'special';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

interface UserLevel {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  title: string;
}

const LEVEL_TITLES = [
  'Newbie Listener',
  'Music Explorer',
  'Rhythm Enthusiast',
  'Melody Master',
  'Sound Sage',
  'Harmony Expert',
  'Beat Legend',
  'Music Virtuoso',
  'Sound God',
  'Ultimate Maestro'
];

export const ACHIEVEMENTS = {
  // Dedication Achievements (Time-based)
  TIME_MILESTONES: [
    { id: 'time_24h', name: 'Day Tripper', target: 24, emoji: '🌅', rarity: 'common' },
    { id: 'time_week', name: 'Weekly Wonder', target: 168, emoji: '📅', rarity: 'rare' },
    { id: 'time_month', name: 'Monthly Maven', target: 720, emoji: '📆', rarity: 'epic' },
    { id: 'time_year', name: 'Yearly Sage', target: 8760, emoji: '🎭', rarity: 'legendary' }
  ],

  // Track Count Achievements
  TRACK_MILESTONES: [
    { id: 'tracks_100', name: 'Novice Listener', target: 100, emoji: '🎵', rarity: 'common' },
    { id: 'tracks_1000', name: 'Music Enthusiast', target: 1000, emoji: '🎼', rarity: 'rare' },
    { id: 'tracks_5000', name: 'Sound Sage', target: 5000, emoji: '🎹', rarity: 'epic' },
    { id: 'tracks_10000', name: 'Music God', target: 10000, emoji: '👑', rarity: 'legendary' }
  ],

  // Artist Variety Achievements
  ARTIST_VARIETY: [
    { id: 'artists_10', name: 'Genre Taster', target: 10, emoji: '🎤', rarity: 'common' },
    { id: 'artists_50', name: 'Genre Explorer', target: 50, emoji: '🗺️', rarity: 'rare' },
    { id: 'artists_100', name: 'Music Wanderer', target: 100, emoji: '🧭', rarity: 'epic' },
    { id: 'artists_200', name: 'Sound Pioneer', target: 200, emoji: '🏆', rarity: 'legendary' }
  ],

  // Streak Achievements
  STREAKS: [
    { id: 'streak_3', name: 'Rhythm Keeper', target: 3, emoji: '🎧', rarity: 'common' },
    { id: 'streak_7', name: 'Music Regular', target: 7, emoji: '🎶', rarity: 'rare' },
    { id: 'streak_30', name: 'Melody Master', target: 30, emoji: '🌟', rarity: 'epic' },
    { id: 'streak_100', name: 'Harmony Legend', target: 100, emoji: '💫', rarity: 'legendary' }
  ],

  // Special Artist Achievements
  ARTIST_DEDICATION: [
    {
      id: 'coldplay_fan',
      name: 'Paradise Found',
      description: 'Top 10 Coldplay listener',
      emoji: '🌠',
      rarity: 'legendary',
      target: 50
    },
    {
      id: 'taylor_swift_fan',
      name: 'Swiftie Supreme',
      description: 'Top 10 Taylor Swift listener',
      emoji: '✨',
      rarity: 'legendary',
      target: 50
    }
  ],

  // Secret Achievements
  SECRETS: [
    {
      id: 'midnight_listener',
      name: 'Night Owl',
      description: 'Listen to music at midnight for 7 different days',
      emoji: '🦉',
      rarity: 'epic',
      secret: true
    },
    {
      id: 'genre_master',
      name: 'Genre Master',
      description: 'Listen to 10 different genres in one day',
      emoji: '🎪',
      rarity: 'legendary',
      secret: true
    }
  ],

  // New Achievement Categories
  DAILY_MILESTONES: [
    { id: 'daily_3', name: 'Daily Mix', target: 3, emoji: '📻', rarity: 'common' },
    { id: 'daily_10', name: 'Music Marathon', target: 10, emoji: '🎧', rarity: 'rare' },
    { id: 'daily_24', name: 'All Day Groove', target: 24, emoji: '🌟', rarity: 'epic' }
  ],
  
  GENRE_EXPLORER: [
    { id: 'genres_5', name: 'Genre Curious', target: 5, emoji: '🎵', rarity: 'common' },
    { id: 'genres_10', name: 'Genre Adventurer', target: 10, emoji: '🎶', rarity: 'rare' },
    { id: 'genres_20', name: 'Genre Master', target: 20, emoji: '🎼', rarity: 'epic' }
  ],

  SOCIAL_ACHIEVEMENTS: [
    { id: 'friends_5', name: 'Music Circle', target: 5, emoji: '👥', rarity: 'common' },
    { id: 'mutual_tastes', name: 'Musical Soulmate', target: 90, emoji: '💖', rarity: 'epic' },
    { id: 'party_host', name: 'Party Master', target: 20, emoji: '🎉', rarity: 'legendary' }
  ],

  // Add new categories
  TIME_OF_DAY: [
    { id: 'early_bird', name: 'Early Bird', description: 'Listen to music before 7 AM', target: 5, emoji: '🌅', rarity: 'rare' },
    { id: 'night_rider', name: 'Night Rider', description: 'Listen between 1-4 AM', target: 10, emoji: '🌙', rarity: 'epic' },
    { id: 'lunch_beats', name: 'Lunch Beats', description: 'Listen during lunch hours', target: 15, emoji: '🍽️', rarity: 'common' }
  ],

  DIVERSE_LISTENING: [
    { id: 'album_explorer', name: 'Album Explorer', description: 'Listen to a full album', target: 5, emoji: '💿', rarity: 'common' },
    { id: 'playlist_master', name: 'Playlist Master', description: 'Create and listen to 5 playlists', target: 5, emoji: '📜', rarity: 'rare' },
    { id: 'decade_hopper', name: 'Decade Hopper', description: 'Listen to songs from 5 different decades', target: 5, emoji: '⏰', rarity: 'epic' }
  ],

  SEASONAL: [
    { id: 'summer_vibes', name: 'Summer Vibes', description: 'Listen to 100 tracks during summer', target: 100, emoji: '☀️', rarity: 'rare' },
    { id: 'winter_warmth', name: 'Winter Warmth', description: 'Listen to 100 tracks during winter', target: 100, emoji: '❄️', rarity: 'rare' }
  ]
} as const;

function createAchievement(
  base: { id: string; name: string; target: number; emoji: string; rarity: AchievementRarity },
  extra: Partial<Achievement>
): Achievement {
  return {
    ...base,
    ...extra,
  } as Achievement;
}

export async function processTimeAchievements(stats: any, userAchievements: any[], achievements: Achievement[]) {
  const hoursListened = Math.floor(stats.total_listening_time_ms / 3600000);
  
  for (const milestone of ACHIEVEMENTS.TIME_MILESTONES) {
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to music for ${milestone.target} hours`,
      progress: {
        current: hoursListened,
        target: milestone.target,
        display: `${hoursListened}/${milestone.target}h`
      }
    });

    if (hoursListened >= milestone.target) {
      const existing = userAchievements.find(a => a.achievement_id === milestone.id);
      achievement.unlockedAt = existing?.unlocked_at || stats.last_checked;
      achievements.push(achievement);
    }
  }
}

export async function processTrackAchievements(stats: any, userAchievements: any[], achievements: Achievement[]) {
  const totalTracks = stats.total_tracks_played;

  for (const milestone of ACHIEVEMENTS.TRACK_MILESTONES) {
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to ${milestone.target} different tracks`,
      progress: {
        current: totalTracks,
        target: milestone.target,
        display: `${totalTracks}/${milestone.target}`
      }
    });

    if (totalTracks >= milestone.target) {
      const existing = userAchievements.find(a => a.achievement_id === milestone.id);
      achievement.unlockedAt = existing?.unlocked_at || stats.last_checked;
      achievements.push(achievement);
    }
  }
}

export async function processArtistAchievements(discordId: string, userAchievements: any[], achievements: Achievement[]) {
  const db = await getDB();
  const uniqueArtists = await db.get(`
    SELECT COUNT(DISTINCT artistName) as count
    FROM listening_history
    WHERE discordId = ?
  `, discordId);

  for (const milestone of ACHIEVEMENTS.ARTIST_VARIETY) {
    const achievement = createAchievement(milestone as any, {
      category: 'explorer',
      description: `Listen to ${milestone.target} different artists`,
      progress: {
        current: uniqueArtists.count,
        target: milestone.target,
        display: `${uniqueArtists.count}/${milestone.target}`
      }
    });

    if (uniqueArtists.count >= milestone.target) {
      const existing = userAchievements.find(a => a.achievement_id === milestone.id);
      achievement.unlockedAt = existing?.unlocked_at || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processStreakAchievements(discordId: string, userAchievements: any[], achievements: Achievement[]) {
  const db = await getDB();
  const streak = await db.get(`
    WITH RECURSIVE dates AS (
      SELECT date(datetime(timestamp, 'unixepoch')) as day
      FROM listening_history
      WHERE discordId = ?
      GROUP BY day
    ), streaks AS (
      SELECT day, 
             julianday(day) - julianday(LAG(day) OVER (ORDER BY day)) as diff
      FROM dates
    )
    SELECT COUNT(*) as streak
    FROM streaks
    WHERE diff = 1
  `, discordId);

  for (const milestone of ACHIEVEMENTS.STREAKS) {
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to music for ${milestone.target} consecutive days`,
      progress: {
        current: streak.streak,
        target: milestone.target,
        display: `${streak.streak}/${milestone.target} days`
      }
    });

    if (streak.streak >= milestone.target) {
      const existing = userAchievements.find(a => a.achievement_id === milestone.id);
      achievement.unlockedAt = existing?.unlocked_at || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processSpecialAchievements(discordId: string, userAchievements: any[], achievements: Achievement[]) {
  const db = await getDB();
  
  for (const special of ACHIEVEMENTS.ARTIST_DEDICATION) {
    const artistName = special.id.includes('coldplay') ? 'Coldplay' : 'Taylor Swift';
    const plays = await db.get(`
      SELECT COUNT(*) as count
      FROM listening_history
      WHERE discordId = ? AND artistName = ?
    `, discordId, artistName);

    if (plays.count >= special.target) {
      const rank = await db.get(`
        SELECT COUNT(*) as better_listeners
        FROM (
          SELECT discordId, COUNT(*) as plays
          FROM listening_history
          WHERE artistName = ?
          GROUP BY discordId
          HAVING plays > ?
        )
      `, artistName, plays.count);

      if (rank.better_listeners < 10) {
        const achievement = createAchievement(special as any, {
          category: 'special',
          progress: {
            current: plays.count,
            target: special.target,
            display: `${plays.count}/${special.target} plays`
          }
        });
        const existing = userAchievements.find(a => a.achievement_id === special.id);
        achievement.unlockedAt = existing?.unlocked_at || Date.now();
        achievements.push(achievement);
      }
    }
  }
}

export async function processSecretAchievements(discordId: string, userAchievements: any[], achievements: Achievement[]) {
  const db = await getDB();
  
  // Night Owl achievement
  const midnightPlays = await db.get(`
    SELECT COUNT(DISTINCT date(datetime(timestamp, 'unixepoch'))) as days
    FROM listening_history
    WHERE discordId = ? 
    AND strftime('%H', datetime(timestamp, 'unixepoch')) = '00'
  `, discordId);

  if (midnightPlays.days >= 7) {
    const nightOwl = ACHIEVEMENTS.SECRETS[0];
    achievements.push(createAchievement(nightOwl as any, {
      category: 'special',
      progress: {
        current: midnightPlays.days,
        target: 7,
        display: `${midnightPlays.days}/7 days`
      },
      unlockedAt: userAchievements.find(a => a.achievement_id === nightOwl.id)?.unlocked_at || Date.now()
    }));
  }
}

export async function getAchievements(discordId: string): Promise<Achievement[]> {
  const db = await getDB();
  const stats = await db.get('SELECT * FROM user_statistics WHERE discordId = ?', discordId);
  
  // Get unlocked achievements and progress
  const userAchievements = await db.all(
    'SELECT * FROM user_achievements WHERE discordId = ?',
    discordId
  );

  // Process achievements for each category
  const achievements: Achievement[] = [];
  await processTimeAchievements(stats, userAchievements, achievements);
  await processTrackAchievements(stats, userAchievements, achievements);
  await processArtistAchievements(discordId, userAchievements, achievements);
  await processStreakAchievements(discordId, userAchievements, achievements);
  await processSpecialAchievements(discordId, userAchievements, achievements);
  await processSecretAchievements(discordId, userAchievements, achievements);

  return achievements.sort((a, b) => {
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
  });
}

function calculateLevel(stats: any): UserLevel {
  const baseXP = stats.total_tracks_played * 10 + Math.floor(stats.total_listening_time_ms / 3600000) * 50;
  const level = Math.floor(Math.sqrt(baseXP / 100));
  const currentXP = baseXP - (level * level * 100);
  const nextLevelXP = ((level + 1) * (level + 1) * 100) - (level * level * 100);
  
  return {
    level: Math.min(level, LEVEL_TITLES.length - 1),
    currentXP,
    nextLevelXP,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)]
  };
}

function createProgressBar(current: number, max: number, length: number = 15): string {
  const progress = Math.min(Math.floor((current / max) * length), length);
  const filled = '▰'.repeat(progress);
  const empty = '▱'.repeat(length - progress);
  return filled + empty;
}

export function formatAchievements(achievements: Achievement[], stats: any): { 
  categories: Record<string, Achievement[]>, 
  stats: any,
  level: UserLevel,
  inProgress: Achievement[]  // Add this
} {
  const categories: Record<string, Achievement[]> = {
    dedication: [],
    explorer: [],
    artist: [],
    social: [],
    special: []
  };

  const statsSummary = {
    total: achievements.length,
    legendary: 0,
    epic: 0,
    rare: 0,
    common: 0
  };

  achievements.forEach(achievement => {
    categories[achievement.category].push(achievement);
    statsSummary[achievement.rarity]++;
  });

  const level = calculateLevel(stats);

  // Filter achievements that are >50% complete but not completed
  const inProgress = achievements.filter(a => 
    a.progress && 
    (a.progress.current / a.progress.target) > 0.5 && 
    (a.progress.current / a.progress.target) < 1
  );

  return { 
    categories, 
    stats: statsSummary,
    level,
    inProgress
  };
}

export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    dedication: '⏰ Dedication',
    explorer: '🗺️ Explorer',
    artist: '🎤 Artist',
    social: '👥 Social',
    special: '✨ Special'
  };
  return emojis[category] || '🎵';
}

export function formatAchievement(achievement: Achievement): string {
  const rarityEmojis = {
    legendary: '👑',
    epic: '💫',
    rare: '✨',
    common: '⭐'
  };

  const progress = achievement.progress;
  const isCompleted = progress && progress.current >= progress.target;
  
  let text = `${achievement.emoji} **${achievement.name}** ${rarityEmojis[achievement.rarity]}`;
  if (isCompleted) {
    text += ' ✅';
  }
  
  if (achievement.description) {
    text += `\n┗ ${achievement.description}`;
  }
  
  if (progress && !isCompleted) {
    const progressBar = createProgressBar(progress.current, progress.target);
    text += `\n┗ ${progressBar} ${progress.display}`;
  }

  if (achievement.unlockedAt) {
    text += `\n┗ Completed: ${new Date(achievement.unlockedAt).toLocaleDateString()}`;
  }

  return text;
}
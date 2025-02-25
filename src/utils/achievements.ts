import { prisma } from '../lib/prisma';

type Achievement = {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  rarity: AchievementRarity;
  target: number;
  progress?: {
    current: number;
    target: number;
    display: string;
  };
  unlockedAt?: number;
};

type AchievementRarity = 'legendary' | 'epic' | 'rare' | 'common';
type UserLevel = { level: number; title: string; currentXP: number; nextLevelXP: number };

export const ACHIEVEMENTS = {
  TIME: [
    {
      id: 'first_steps',
      name: 'First Steps',
      target: 60,
      emoji: '👶',
      rarity: 'common',
    },
    // ... other achievement definitions
  ],
  ARTIST_VARIETY: [
    {
      id: 'explorer_1',
      name: 'Music Explorer I',
      target: 10,
      emoji: '🗺️',
      rarity: 'common',
    },
    // ... other achievement definitions
  ],
  // ... other achievement categories
} as const;

function createAchievement(
  base: { id: string; name: string; target: number; emoji: string; rarity: AchievementRarity },
  extra: Partial<Achievement>
): Achievement {
  return {
    ...base,
    description: extra.description || '',
    category: extra.category || 'unknown',
    progress: extra.progress,
    unlockedAt: extra.unlockedAt,
  };
}

export async function getAchievements(discordId: string): Promise<Achievement[]> {
  const stats = await prisma.userStatistic.findUnique({ where: { discordId } });
  const userAchievements = await prisma.userAchievement.findMany({ where: { discordId } });
  const achievements: Achievement[] = [];

  // Process time-based achievements
  await processTimeAchievements(stats, userAchievements, achievements);
  await processTrackAchievements(stats, userAchievements, achievements);
  await processArtistAchievements(discordId, userAchievements, achievements);
  await processStreakAchievements(discordId, userAchievements, achievements);
  await processSpecialAchievements(discordId, userAchievements, achievements);
  await processSecretAchievements(discordId, userAchievements, achievements);

  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return achievements.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
}

export async function processTimeAchievements(
  stats: any,
  userAchievements: any[],
  achievements: Achievement[]
) {
  if (!stats) return;

  for (const milestone of ACHIEVEMENTS.TIME) {
    const timeInHours = stats.totalListeningTimeMs / (1000 * 60 * 60);
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to music for ${milestone.target} hours`,
      progress: {
        current: Math.floor(timeInHours),
        target: milestone.target,
        display: `${Math.floor(timeInHours)}/${milestone.target} hours`,
      },
    });

    if (timeInHours >= milestone.target) {
      const existing = userAchievements.find((a) => a.achievementId === milestone.id);
      achievement.unlockedAt = existing?.unlockedAt || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processTrackAchievements(
  stats: any,
  userAchievements: any[],
  achievements: Achievement[]
) {
  if (!stats) return;

  for (const milestone of ACHIEVEMENTS.TRACKS) {
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to ${milestone.target} tracks`,
      progress: {
        current: stats.totalTracksPlayed,
        target: milestone.target,
        display: `${stats.totalTracksPlayed}/${milestone.target} tracks`,
      },
    });

    if (stats.totalTracksPlayed >= milestone.target) {
      const existing = userAchievements.find((a) => a.achievementId === milestone.id);
      achievement.unlockedAt = existing?.unlockedAt || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processArtistAchievements(
  discordId: string,
  userAchievements: any[],
  achievements: Achievement[]
) {
  const uniqueArtists = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: { discordId },
    _count: { _all: true },
  });

  const artistCount = uniqueArtists.length;

  for (const milestone of ACHIEVEMENTS.ARTIST_VARIETY) {
    const achievement = createAchievement(milestone as any, {
      category: 'explorer',
      description: `Listen to ${milestone.target} different artists`,
      progress: {
        current: artistCount,
        target: milestone.target,
        display: `${artistCount}/${milestone.target}`,
      },
    });

    if (artistCount >= milestone.target) {
      const existing = userAchievements.find((a) => a.achievementId === milestone.id);
      achievement.unlockedAt = existing?.unlockedAt || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processStreakAchievements(
  discordId: string,
  userAchievements: any[],
  achievements: Achievement[]
) {
  const streakData = await prisma.$queryRaw`
    WITH RECURSIVE dates AS (
      SELECT date(datetime(timestamp, 'unixepoch')) as day
      FROM listening_history
      WHERE discordId = ${discordId}
      GROUP BY day
    ), streaks AS (
      SELECT day, 
             julianday(day) - julianday(LAG(day) OVER (ORDER BY day)) as diff
      FROM dates
    )
    SELECT COUNT(*) as streak
    FROM streaks
    WHERE diff = 1
  `;

  const streak = (streakData as any)[0]?.streak || 0;

  for (const milestone of ACHIEVEMENTS.STREAKS) {
    const achievement = createAchievement(milestone as any, {
      category: 'dedication',
      description: `Listen to music for ${milestone.target} consecutive days`,
      progress: {
        current: streak,
        target: milestone.target,
        display: `${streak}/${milestone.target} days`,
      },
    });

    if (streak >= milestone.target) {
      const existing = userAchievements.find((a) => a.achievementId === milestone.id);
      achievement.unlockedAt = existing?.unlockedAt || Date.now();
      achievements.push(achievement);
    }
  }
}

export async function processSpecialAchievements(
  discordId: string,
  userAchievements: any[],
  achievements: Achievement[]
) {
  for (const special of ACHIEVEMENTS.ARTIST_DEDICATION) {
    const artistName = special.id.includes('coldplay') ? 'Coldplay' : 'Taylor Swift';
    const plays = await prisma.listeningHistory.count({
      where: {
        discordId,
        artistName,
      },
    });

    if (plays >= special.target) {
      const betterListeners = await prisma.listeningHistory.groupBy({
        by: ['discordId'],
        where: {
          artistName,
        },
        _count: {
          _all: true,
        },
        having: {
          _count: {
            _all: {
              gt: plays,
            },
          },
        },
      });

      if (betterListeners.length < 10) {
        const achievement = createAchievement(special as any, {
          category: 'special',
          progress: {
            current: plays,
            target: special.target,
            display: `${plays}/${special.target} plays`,
          },
        });
        const existing = userAchievements.find((a) => a.achievementId === special.id);
        achievement.unlockedAt = existing?.unlockedAt || Date.now();
        achievements.push(achievement);
      }
    }
  }
}

export async function processSecretAchievements(
  discordId: string,
  userAchievements: any[],
  achievements: Achievement[]
) {
  // Night Owl achievement
  const midnightPlays = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT date(datetime(timestamp, 'unixepoch'))) as days
    FROM listening_history
    WHERE discordId = ${discordId} 
    AND strftime('%H', datetime(timestamp, 'unixepoch')) = '00'
  `;

  const daysCount = (midnightPlays as any)[0]?.days || 0;

  if (daysCount >= 7) {
    const nightOwl = ACHIEVEMENTS.SECRETS[0];
    achievements.push(
      createAchievement(nightOwl as any, {
        category: 'special',
        progress: {
          current: daysCount,
          target: 7,
          display: `${daysCount}/7 days`,
        },
        unlockedAt:
          userAchievements.find((a) => a.achievementId === nightOwl.id)?.unlockedAt || Date.now(),
      })
    );
  }
}

function calculateLevel(stats: any): UserLevel {
  if (!stats) return { level: 0, title: 'Newbie', currentXP: 0, nextLevelXP: 100 };

  const xp = Math.floor(stats.totalListeningTimeMs / (1000 * 60)); // 1 XP per minute
  const level = Math.floor(Math.log2(xp / 100 + 1));
  const currentLevelXP = 100 * (Math.pow(2, level) - 1);
  const nextLevelXP = 100 * (Math.pow(2, level + 1) - 1);

  const titles = [
    'Newbie',
    'Music Fan',
    'Music Enthusiast',
    'Music Lover',
    'Music Addict',
    'Music Expert',
    'Music Master',
    'Music Legend',
  ];

  return {
    level,
    title: titles[Math.min(level, titles.length - 1)],
    currentXP: xp,
    nextLevelXP,
  };
}

function createProgressBar(current: number, max: number, length: number = 15): string {
  const filled = Math.floor((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function formatAchievements(
  achievements: Achievement[],
  stats: any
): {
  categories: Record<string, Achievement[]>;
  stats: any;
  level: UserLevel;
  inProgress: Achievement[];
} {
  const categories: Record<string, Achievement[]> = {};
  const inProgress: Achievement[] = [];

  achievements.forEach((achievement) => {
    if (!categories[achievement.category]) {
      categories[achievement.category] = [];
    }

    if (achievement.progress && achievement.progress.current < achievement.progress.target) {
      inProgress.push(achievement);
    } else {
      categories[achievement.category].push(achievement);
    }
  });

  const level = calculateLevel(stats);

  return {
    categories,
    stats,
    level,
    inProgress: inProgress.sort(
      (a, b) =>
        (b.progress?.current / b.progress?.target || 0) -
        (a.progress?.current / a.progress?.target || 0)
    ),
  };
}

export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    dedication: '⏰',
    explorer: '🗺️',
    artist: '🎤',
    social: '👥',
    special: '✨',
  };
  return emojis[category] || '❓';
}

export function formatAchievement(achievement: Achievement): string {
  const { emoji, name, rarity, progress } = achievement;
  const display = progress
    ? `${progress.display}\n${createProgressBar(progress.current, progress.target)}`
    : '';
  return `${emoji} **${name}** (${rarity})\n${display}`;
}

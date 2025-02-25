import { prisma } from '../lib/prisma';
import type { UserStats } from '../interfaces';

interface ArtistStats {
  artistName: string;
  playCount: number;
  totalTime?: number;
  lastPlayed?: number;
}

interface TrackStats {
  trackName: string;
  artistName: string;
  playCount: number;
}

export async function getUserStats(discordId: string): Promise<UserStats | null> {
  const [topArtists, topTracks, totalPlaytime, trackCount] = await Promise.all([
    getTopArtists(discordId),
    getTopTracks(discordId),
    getTotalPlaytime(discordId),
    getTrackCount(discordId),
  ]);

  return {
    topArtists,
    topTracks,
    totalPlaytime,
    trackCount,
  };
}

export async function getTopArtists(discordId: string, limit: number = 3): Promise<ArtistStats[]> {
  const results = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: {
      discordId,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: limit,
  });

  return results.map((result) => ({
    artistName: result.artistName,
    playCount: result._count.id,
  }));
}

export async function getTopTracks(discordId: string, limit: number = 3): Promise<TrackStats[]> {
  const results = await prisma.listeningHistory.groupBy({
    by: ['trackName', 'artistName'],
    where: {
      discordId,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: limit,
  });

  return results.map((result) => ({
    trackName: result.trackName,
    artistName: result.artistName,
    playCount: result._count.id,
  }));
}

export async function getTotalPlaytime(discordId: string): Promise<number> {
  const result = await prisma.listeningHistory.aggregate({
    where: {
      discordId,
    },
    _sum: {
      durationMs: true,
    },
  });

  return result._sum.durationMs || 0;
}

export async function getTrackCount(discordId: string): Promise<number> {
  return await prisma.listeningHistory.count({
    where: {
      discordId,
    },
  });
}

export async function getDetailedArtistStats(discordId: string): Promise<ArtistStats[]> {
  const results = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: { discordId },
    _count: {
      id: true,
    },
    _sum: {
      durationMs: true,
    },
    _max: {
      timestamp: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 10,
  });

  return results.map((result) => ({
    artistName: result.artistName,
    playCount: result._count.id,
    totalTime: result._sum.durationMs || 0,
    lastPlayed: result._max.timestamp || 0,
  }));
}

export async function getRecentHighlights(discordId: string) {
  const lastWeek = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const results = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: {
      discordId,
      timestamp: { gt: lastWeek },
    },
    _count: {
      id: true,
    },
    having: {
      _count: {
        id: {
          gte: 3,
        },
      },
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 5,
  });

  const highlights = await Promise.all(
    results.map(async (result) => {
      const tracks = await prisma.listeningHistory.findMany({
        where: {
          discordId,
          artistName: result.artistName,
          timestamp: { gt: lastWeek },
        },
        distinct: ['trackName'],
        select: { trackName: true },
      });

      return {
        artistName: result.artistName,
        play_count: result._count.id,
        tracks: tracks.map((t) => t.trackName).join(','),
      };
    })
  );

  return highlights;
}

export async function findCommonArtists(user1: string, user2: string) {
  const results = await prisma.$queryRaw`
    WITH user1_plays AS (
      SELECT artistName, COUNT(DISTINCT trackId) as plays
      FROM ListeningHistory
      WHERE discordId = ${user1}
      GROUP BY artistName
    ),
    user2_plays AS (
      SELECT artistName, COUNT(DISTINCT trackId) as plays
      FROM ListeningHistory
      WHERE discordId = ${user2}
      GROUP BY artistName
    )
    SELECT 
      u1.artistName,
      u1.plays as user1_tracks,
      u2.plays as user2_tracks
    FROM user1_plays u1
    INNER JOIN user2_plays u2 ON u1.artistName = u2.artistName
    WHERE u1.plays >= 2 AND u2.plays >= 2
    ORDER BY (u1.plays + u2.plays) DESC
    LIMIT 10
  `;
  return results;
}

export async function getListeningBattle(user1: string, user2: string) {
  const [user1Stats, user2Stats] = await Promise.all([getUserStats(user1), getUserStats(user2)]);

  const today = Math.floor(Date.now() / 1000) - 86400;

  const recentActivity = await prisma.listeningHistory.groupBy({
    by: ['discordId'],
    where: {
      discordId: { in: [user1, user2] },
      timestamp: { gt: today },
    },
    _count: {
      id: true,
      artistName: true,
    },
  });

  const formattedActivity = recentActivity.map((activity) => ({
    discordId: activity.discordId,
    tracks_today: activity._count.id,
    artists_today: activity._count.artistName,
  }));

  return {
    overall: {
      user1: user1Stats,
      user2: user2Stats,
    },
    today: formattedActivity,
    battleScore: calculateBattleScore(user1Stats, user2Stats, formattedActivity),
  };
}

export async function getListeningTrends(discordId: string) {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  return prisma.$queryRaw`
    SELECT 
      date(datetime(timestamp, 'unixepoch')) as day,
      COUNT(*) as plays,
      COUNT(DISTINCT artistName) as unique_artists
    FROM ListeningHistory
    WHERE discordId = ${discordId} AND timestamp > ${thirtyDaysAgo}
    GROUP BY day
    ORDER BY day DESC
  `;
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
  const baseScore = Math.log10(stats.trackCount || 1) * 10;
  const activityScore = today.tracks_today * 2 + today.artists_today * 5;
  return Math.round(baseScore + activityScore);
}

export async function compareListeningStats(user1: string, user2: string) {
  const [stats1, stats2] = await Promise.all([getUserStats(user1), getUserStats(user2)]);

  const commonArtists = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: {
      discordId: { in: [user1, user2] },
    },
    _count: {
      id: true,
    },
    having: {
      _count: {
        id: {
          gt: 1,
        },
      },
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 5,
  });

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
    (Math.min(stats1.totalPlaytime || 0, stats2.totalPlaytime || 0) /
      Math.max(stats1.totalPlaytime || 1, stats2.totalPlaytime || 1)) *
    50;

  return Math.round(artistScore + timeScore);
}

export async function getUserMostPlayedArtists(
  discordId: string,
  limit: number = 3
): Promise<ArtistStats[]> {
  const results = await prisma.listeningHistory.groupBy({
    by: ['artistName'],
    where: { discordId },
    _count: {
      id: true,
    },
    _sum: {
      durationMs: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: limit,
  });

  return results.map((result) => ({
    artistName: result.artistName,
    playCount: result._count.id,
    totalTime: result._sum.durationMs || 0,
  }));
}

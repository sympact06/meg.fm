import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function getTokens(discordId: string) {
  return prisma.spotifyToken.findUnique({
    where: { discordId },
  });
}

export async function setTokens(
  discordId: string,
  access_token: string,
  refresh_token: string,
  expires_at: number
) {
  return prisma.spotifyToken.upsert({
    where: { discordId },
    update: {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at,
    },
    create: {
      discordId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at,
    },
  });
}

export async function updateAccessToken(
  discordId: string,
  access_token: string,
  expires_at: number
) {
  return prisma.spotifyToken.update({
    where: { discordId },
    data: {
      accessToken: access_token,
      expiresAt: expires_at,
    },
  });
}

export async function getLastTrackedSong(discordId: string) {
  return prisma.listeningHistory.findFirst({
    where: { discordId },
    orderBy: { timestamp: 'desc' },
  });
}

export async function recordListening(discordId: string, track: any) {
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

    await prisma.$transaction(async (tx) => {
      // Record the listening history
      await tx.listeningHistory.create({
        data: {
          discordId,
          trackId: track.id,
          trackName: track.name,
          artistName: track.artists[0].name,
          albumName: track.album.name,
          timestamp,
          durationMs: track.duration_ms,
        },
      });

      const playCount = await tx.listeningHistory.count({
        where: {
          discordId,
          trackId: track.id,
        },
      });

      if (playCount === 1) {
        const favoriteArtist = await tx.listeningHistory.groupBy({
          by: ['artistName'],
          where: { discordId },
          _count: true,
          orderBy: {
            _count: {
              id: 'desc',
            },
          },
          take: 1,
        });

        const favoriteTrack = await tx.listeningHistory.groupBy({
          by: ['trackName'],
          where: { discordId },
          _count: true,
          orderBy: {
            _count: {
              id: 'desc',
            },
          },
          take: 1,
        });

        await tx.userStatistic.upsert({
          where: { discordId },
          create: {
            discordId,
            totalTracksPlayed: 1,
            totalListeningTimeMs: track.duration_ms,
            lastChecked: timestamp,
            favoriteArtist: favoriteArtist[0]?.artistName,
            favoriteTrack: favoriteTrack[0]?.trackName,
          },
          update: {
            totalTracksPlayed: { increment: 1 },
            totalListeningTimeMs: { increment: track.duration_ms },
            lastChecked: timestamp,
            favoriteArtist: favoriteArtist[0]?.artistName,
            favoriteTrack: favoriteTrack[0]?.trackName,
          },
        });
      }
    });

    return true;
  } catch (error) {
    console.error('Error recording listening history:', error);
    return false;
  }
}

export async function getAllAuthorizedUsers() {
  return prisma.spotifyToken.findMany({
    select: { discordId: true },
  });
}

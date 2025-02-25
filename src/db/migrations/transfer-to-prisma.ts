import { Database } from 'sqlite';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { PrismaClient } from '@prisma/client';

async function getOldDb() {
  return open({
    filename: './data.sqlite',
    driver: sqlite3.Database,
  });
}

async function transferData() {
  const oldDb = await getOldDb();
  const prisma = new PrismaClient();

  try {
    console.log('Starting data transfer...');

    // Transfer spotify tokens
    console.log('Transferring Spotify tokens...');
    const tokens = await oldDb.all('SELECT * FROM spotify_tokens');
    for (const token of tokens) {
      await prisma.spotifyToken.upsert({
        where: { discordId: token.discordId },
        update: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: token.expires_at || 0,
        },
        create: {
          discordId: token.discordId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: token.expires_at || 0,
        },
      });
    }

    // Transfer listening history
    console.log('Transferring listening history...');
    const history = await oldDb.all('SELECT * FROM listening_history');
    for (const record of history) {
      try {
        await prisma.listeningHistory.create({
          data: {
            discordId: record.discordId,
            trackId: record.trackId,
            trackName: record.trackName,
            artistName: record.artistName,
            albumName: record.albumName,
            timestamp: record.timestamp || Math.floor(Date.now() / 1000),
            durationMs: record.duration_ms || 0,
          },
        });
      } catch (e) {
        // Skip duplicate entries
        if (e.code !== 'P2002') throw e;
      }
    }

    // Transfer user statistics
    console.log('Transferring user statistics...');
    const stats = await oldDb.all('SELECT * FROM user_statistics');
    for (const stat of stats) {
      await prisma.userStatistic.upsert({
        where: { discordId: stat.discordId },
        update: {
          totalTracksPlayed: stat.total_tracks_played || 0,
          totalListeningTimeMs: stat.total_listening_time_ms || 0,
          lastChecked: stat.last_checked || Math.floor(Date.now() / 1000),
          favoriteArtist: stat.favorite_artist || null,
          favoriteTrack: stat.favorite_track || null,
        },
        create: {
          discordId: stat.discordId,
          totalTracksPlayed: stat.total_tracks_played || 0,
          totalListeningTimeMs: stat.total_listening_time_ms || 0,
          lastChecked: stat.last_checked || Math.floor(Date.now() / 1000),
          favoriteArtist: stat.favorite_artist || null,
          favoriteTrack: stat.favorite_track || null,
        },
      });
    }

    // Transfer user achievements
    console.log('Transferring user achievements...');
    const achievements = await oldDb.all('SELECT * FROM user_achievements');
    for (const achievement of achievements) {
      await prisma.userAchievement.upsert({
        where: {
          discordId_achievementId: {
            discordId: achievement.discordId,
            achievementId: achievement.achievement_id,
          },
        },
        update: {
          unlockedAt: achievement.unlocked_at || Math.floor(Date.now() / 1000),
          progress: achievement.progress || 0,
        },
        create: {
          discordId: achievement.discordId,
          achievementId: achievement.achievement_id,
          unlockedAt: achievement.unlocked_at || Math.floor(Date.now() / 1000),
          progress: achievement.progress || 0,
        },
      });
    }

    // Transfer friends
    console.log('Transferring friends...');
    const friends = await oldDb.all('SELECT * FROM friends');
    const now = Math.floor(Date.now() / 1000);
    for (const friend of friends) {
      await prisma.friend.upsert({
        where: {
          userId_friendId: {
            userId: friend.user_id,
            friendId: friend.friend_id,
          },
        },
        update: {
          status: (friend.status || 'pending').toLowerCase(),
          updatedAt: friend.updated_at || now,
        },
        create: {
          userId: friend.user_id,
          friendId: friend.friend_id,
          status: (friend.status || 'pending').toLowerCase(),
          createdAt: friend.created_at || now,
          updatedAt: friend.updated_at || now,
        },
      });
    }

    console.log('Data transfer completed successfully!');
  } catch (error) {
    console.error('Error during data transfer:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await oldDb.close();
  }
}

if (require.main === module) {
  transferData().catch(console.error);
}

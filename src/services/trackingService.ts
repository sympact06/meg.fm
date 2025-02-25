import {
  getTokens,
  updateAccessToken,
  recordListening,
  getAllAuthorizedUsers,
} from '../db/database';
import { SpotifyService } from './streaming/SpotifyService';
import { refreshAccessToken } from '../utils/spotifyUtils';
import axios from 'axios';

export class TrackingService {
  private static instance: TrackingService;
  private trackingInterval: NodeJS.Timeout | null = null;
  private activeUsers: Map<string, { lastCheck: number; lastTrackId?: string }> = new Map();
  private rateLimitedUsers: Set<string> = new Set();
  private readonly CHECK_INTERVAL = 45000; // 45 seconds

  private constructor(private streamingService: SpotifyService) {}

  static getInstance(streamingService: SpotifyService): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService(streamingService);
    }
    return TrackingService.instance;
  }

  async initializeFromDatabase() {
    try {
      const users = await getAllAuthorizedUsers();
      const now = Date.now();
      users.forEach((user) => {
        this.activeUsers.set(user.discordId, { lastCheck: now });
      });
      console.log(`[Tracking] Loaded ${this.activeUsers.size} users from database`);
      await this.startTracking();
    } catch (error) {
      console.error('[Tracking] Error loading users from database:', error);
    }
  }

  addUser(discordId: string) {
    this.activeUsers.set(discordId, { lastCheck: Date.now() });
    console.log(
      `[Tracking] Added user ${discordId} to tracking. Total users: ${this.activeUsers.size}`
    );
  }

  private async trackUser(
    discordId: string,
    userData: { lastCheck: number; lastTrackId?: string }
  ) {
    if (this.rateLimitedUsers.has(discordId)) {
      return;
    }

    try {
      const tokens = await getTokens(discordId);
      if (!tokens) return;

      let {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      } = tokens;

      if (Date.now() >= expiresAt * 1000) {
        const refreshed = await this.streamingService.refreshToken(refreshToken);
        accessToken = refreshed.accessToken;
        const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
        await updateAccessToken(discordId, accessToken, newExpiresAt);
      }

      const currentTrack = await this.streamingService.getCurrentTrack(accessToken);

      if (currentTrack && currentTrack.progress > 2000) {
        // Only track if more than 2 seconds into the song
        const trackData = {
          id: currentTrack.id,
          name: currentTrack.name,
          artists: [{ name: currentTrack.artist }],
          album: { name: currentTrack.album },
          duration_ms: currentTrack.duration,
        };

        const recorded = await recordListening(discordId, trackData);
        if (recorded) {
          console.log(
            `[Tracking] New record: User ${discordId} listening to "${currentTrack.name}" by ${currentTrack.artist}`
          );
        }
      }
    } catch (error: any) {
      if (error.message === 'TOKEN_REFRESH_NEEDED') {
        try {
          const tokens = await getTokens(discordId);
          if (!tokens) {
            this.activeUsers.delete(discordId);
            return;
          }
          const newTokenData = await refreshAccessToken(tokens.refresh_token);
          const currentTime = Math.floor(Date.now() / 1000);
          await updateAccessToken(
            discordId,
            newTokenData.access_token,
            currentTime + newTokenData.expires_in
          );
          // Skip this iteration, will retry on next interval
          return;
        } catch (refreshError) {
          console.error(`[Tracking] Error refreshing token for user ${discordId}:`, refreshError);
          this.activeUsers.delete(discordId);
        }
      } else {
        console.error(`[Tracking] Error tracking user ${discordId}:`, error);
      }
    }

    userData.lastCheck = Date.now();
  }

  async startTracking() {
    if (this.trackingInterval) {
      return;
    }

    this.trackingInterval = setInterval(async () => {
      const trackingPromises = Array.from(this.activeUsers.entries()).map(([discordId, userData]) =>
        this.trackUser(discordId, userData)
      );

      await Promise.allSettled(trackingPromises);
    }, this.CHECK_INTERVAL);

    console.log('[Tracking] Started tracking service');
  }

  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('[Tracking] Stopped tracking service');
    }
  }
}

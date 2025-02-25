import {
  getTokens,
  updateAccessToken,
  recordListening,
  getAllAuthorizedUsers,
} from '../db/database';
import { SpotifyService } from './streaming/SpotifyService';
import { Track } from './streaming/BaseStreamingService';

export class TrackingService {
  private static instance: TrackingService;
  private trackingInterval: NodeJS.Timeout | null = null;
  private activeUsers: Map<string, { lastCheck: number; lastTrackId?: string }> = new Map();
  private rateLimitedUsers: Set<string> = new Set();
  private readonly CHECK_INTERVAL = 45000; // 45 seconds
  private readonly RATE_LIMIT_RESET = 300000; // 5 minutes

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

      let { accessToken, refreshToken, expiresAt } = tokens;

      if (Date.now() >= expiresAt) {
        const refreshed = await this.streamingService.refreshToken(refreshToken);
        accessToken = refreshed.accessToken;
        const newExpiresAt = Date.now() + refreshed.expiresIn * 1000;
        await updateAccessToken(discordId, accessToken, newExpiresAt);
      }

      const track = await this.streamingService.getCurrentTrack(discordId, accessToken);

      if (track && track.progress > 2000 && track.id !== userData.lastTrackId) {
        await this.recordTrack(discordId, track);
        userData.lastTrackId = track.id;
      }

      userData.lastCheck = Date.now();
    } catch (error) {
      if (error instanceof Error && error.message === 'Rate limit exceeded') {
        this.rateLimitedUsers.add(discordId);
        setTimeout(() => this.rateLimitedUsers.delete(discordId), this.RATE_LIMIT_RESET);
      }
      console.error(`[Tracking] Error tracking user ${discordId}:`, error);
    }
  }

  private async recordTrack(discordId: string, track: Track) {
    try {
      const recorded = await recordListening(discordId, {
        id: track.id,
        name: track.name,
        artists: [{ name: track.artist }],
        album: { name: track.album },
      });
      if (recorded) {
        console.log(
          `[Tracking] New record: User ${discordId} listening to "${track.name}" by ${track.artist}`
        );
      }
    } catch (error) {
      console.error(`[Tracking] Error recording track for user ${discordId}:`, error);
    }
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

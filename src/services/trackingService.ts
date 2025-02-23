import { getTokens, updateAccessToken, recordListening, getAllAuthorizedUsers } from '../db/database';
import { refreshAccessToken } from '../utils/spotifyUtils';
import axios from 'axios';

export class TrackingService {
  private static instance: TrackingService;
  private trackingInterval: NodeJS.Timeout | null = null;
  private activeUsers: Set<string> = new Set();

  private constructor() {}

  static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  async initializeFromDatabase() {
    try {
      const users = await getAllAuthorizedUsers();
      users.forEach(user => {
        this.activeUsers.add(user.discordId);
      });
      console.log(`[Tracking] Loaded ${this.activeUsers.size} users from database`);
      this.startTracking();
    } catch (error) {
      console.error('[Tracking] Error loading users from database:', error);
    }
  }

  addUser(discordId: string) {
    this.activeUsers.add(discordId);
    console.log(`[Tracking] Added user ${discordId} to tracking. Total users: ${this.activeUsers.size}`);
  }

  startTracking() {
    if (this.trackingInterval) return;

    this.trackingInterval = setInterval(async () => {
      console.log(`[Tracking] Checking ${this.activeUsers.size} users...`);
      
      for (const discordId of this.activeUsers) {
        try {
          const tokens = await getTokens(discordId);
          if (!tokens) {
            this.activeUsers.delete(discordId);
            continue;
          }

          let accessToken = tokens.access_token;
          const currentTime = Math.floor(Date.now() / 1000);

          if (tokens.expires_at < currentTime) {
            const newTokenData = await refreshAccessToken(tokens.refresh_token);
            accessToken = newTokenData.access_token;
            const newExpiresAt = currentTime + newTokenData.expires_in;
            await updateAccessToken(discordId, accessToken, newExpiresAt);
          }

          const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.data && response.data.item) {
            const track = response.data.item;
            const progress = response.data.progress_ms;
            
            if (progress > 2000) { // Only track if more than 2 seconds into the song
              const recorded = await recordListening(discordId, track);
              if (recorded) {
                console.log(`[Tracking] New record: User ${discordId} listening to "${track.name}" by ${track.artists[0].name}`);
              }
            }
          }
        } catch (error) {
          console.error(`[Tracking] Error tracking user ${discordId}:`, error);
        }
      }
    }, 45000); 

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

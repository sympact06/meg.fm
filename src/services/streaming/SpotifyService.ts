import axios from 'axios';
import { BaseStreamingService, Track, StreamingServiceConfig } from './BaseStreamingService';

interface RateLimitState {
  reset: number;
  remaining: number;
  total: number;
}

export class SpotifyService extends BaseStreamingService {
  private static instance: SpotifyService;
  private rateLimitState: RateLimitState = { reset: 0, remaining: 100, total: 100 };
  private retryAfter: number = 0;

  private constructor(config: StreamingServiceConfig) {
    super(config);
  }

  static getInstance(config: StreamingServiceConfig): SpotifyService {
    if (!SpotifyService.instance) {
      SpotifyService.instance = new SpotifyService(config);
    }
    return SpotifyService.instance;
  }

  getName(): string {
    return 'Spotify';
  }

  private updateRateLimits(headers: any) {
    this.rateLimitState = {
      remaining: parseInt(headers['x-ratelimit-remaining'] || this.rateLimitState.remaining),
      reset: parseInt(headers['x-ratelimit-reset'] || this.rateLimitState.reset),
      total: parseInt(headers['x-ratelimit-limit'] || this.rateLimitState.total),
    };
  }

  private async handleRateLimit() {
    if (this.retryAfter > Date.now()) {
      const waitTime = this.retryAfter - Date.now();
      console.log(`Rate limited, waiting ${waitTime}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  async getCurrentTrack(accessToken: string): Promise<Track | null> {
    await this.handleRateLimit();

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.headers) {
        this.updateRateLimits(response.headers);
      }

      if (!response.data || !response.data.item) {
        return null;
      }

      const { item: track, progress_ms } = response.data;
      return {
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        imageUrl: track.album.images[0]?.url,
        duration: track.duration_ms,
        progress: progress_ms,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.retryAfter =
            Date.now() + parseInt(error.response.headers['retry-after'] || '5') * 1000;
          throw new Error(`Rate limit exceeded. Retry after ${this.retryAfter - Date.now()}ms`);
        }
        if (error.response?.status === 401) {
          // Instead of throwing immediately, let the caller handle token refresh
          throw new Error('TOKEN_REFRESH_NEEDED');
        }
        if (error.response?.status === 403) {
          throw new Error('Insufficient permissions');
        }
      }
      console.error('Error fetching current track:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    await this.handleRateLimit();

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new Error('Invalid refresh token');
        }
        if (error.response?.status === 429) {
          this.retryAfter =
            Date.now() + parseInt(error.response.headers['retry-after'] || '5') * 1000;
          throw new Error('Rate limit exceeded');
        }
      }
      throw error;
    }
  }

  getAuthUrl(): string {
    const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
    return `https://accounts.spotify.com/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.config.redirectUri,
    })}`;
  }
}

import axios from 'axios';
import { BaseStreamingService, Track, StreamingServiceConfig } from './BaseStreamingService';

export class SpotifyService extends BaseStreamingService {
  private static instance: SpotifyService;

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

  async getCurrentTrack(userId: string, accessToken: string): Promise<Track | null> {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

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
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
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

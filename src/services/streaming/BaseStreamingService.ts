export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  imageUrl?: string;
  duration: number;
  progress: number;
}

export interface StreamingServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export abstract class BaseStreamingService {
  protected config: StreamingServiceConfig;

  constructor(config: StreamingServiceConfig) {
    this.config = config;
  }

  abstract getName(): string;
  abstract getCurrentTrack(userId: string, accessToken: string): Promise<Track | null>;
  abstract refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
  abstract getAuthUrl(): string;
}

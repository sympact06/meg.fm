interface EnvironmentConfig {
  DISCORD_TOKEN: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_REDIRECT_URI: string;
  DATABASE_PATH: string;
  NODE_ENV: 'development' | 'production';
}

class ConfigValidator {
  private static validateEnvVar(name: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  static validate(): EnvironmentConfig {
    return {
      DISCORD_TOKEN: this.validateEnvVar('DISCORD_TOKEN', process.env.DISCORD_TOKEN),
      SPOTIFY_CLIENT_ID: this.validateEnvVar('SPOTIFY_CLIENT_ID', process.env.SPOTIFY_CLIENT_ID),
      SPOTIFY_CLIENT_SECRET: this.validateEnvVar(
        'SPOTIFY_CLIENT_SECRET',
        process.env.SPOTIFY_CLIENT_SECRET
      ),
      SPOTIFY_REDIRECT_URI: this.validateEnvVar(
        'SPOTIFY_REDIRECT_URI',
        process.env.SPOTIFY_REDIRECT_URI
      ),
      DATABASE_PATH: process.env.DATABASE_PATH || 'data.sqlite',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    };
  }

  static validateOrExit(): EnvironmentConfig {
    try {
      const config = this.validate();
      console.log('Environment configuration validated successfully');
      return config;
    } catch (error) {
      console.error('Configuration error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

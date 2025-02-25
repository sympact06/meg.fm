import { Client, GatewayIntentBits, ActivityType, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import express from 'express';
import { initializeCommands } from './commands';
import { initializeEvents } from './events';
import { loginRoute } from './auth/authorize';
import { callbackRoute } from './auth/callback';
import { TrackingService } from './services/trackingService';
import { createBackup } from './utils/backup';
import { monitor } from './services/monitoring/PerformanceMonitor';
import { SpotifyService } from './services/streaming/SpotifyService';

// Load and validate environment variables
config();
validateEnvironment();

// Initialize Discord client with only necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

function validateEnvironment(): void {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

function scheduleBackups(): void {
  const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(async () => {
    try {
      await createBackup();
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      monitor.recordError(error as Error);
    }
  }, BACKUP_INTERVAL);
}

async function startServer(): Promise<void> {
  const app = express();
  const port = process.env.PORT || 8888;

  loginRoute(app);
  callbackRoute(app);

  app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
  });
}

async function registerCommands(commands: any) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    const commandData = [...commands.values()].map(cmd => cmd.data.toJSON());
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commandData },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
    throw error;
  }
}

// Main application startup
async function main(): Promise<void> {
  try {
    const commands = await initializeCommands();
    client.commands = commands;
    await initializeEvents(client);

    // Register commands before login
    await registerCommands(commands);

    client.once('ready', async () => {
      console.log('Bot is ready!');
      client.user.setPresence({
        status: 'idle',
        activities: [{ name: '❤️', type: ActivityType.Custom }],
      });
      const spotifyService = SpotifyService.getInstance({
        clientId: process.env.SPOTIFY_CLIENT_ID!,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
      });
      const trackingService = TrackingService.getInstance(spotifyService);
      await trackingService.initializeFromDatabase();
    });

    await client.login(process.env.DISCORD_TOKEN);
    await startServer();
    scheduleBackups();
  } catch (error) {
    console.error('Application startup failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  monitor.recordError(error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  monitor.recordError(reason as Error);
  console.error('Unhandled Rejection:', reason);
});

// Start the application
main();

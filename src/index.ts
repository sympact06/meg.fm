import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import express from 'express';
import { readdirSync } from 'fs';
import { join } from 'path';
import { loginRoute } from './auth/authorize';
import { callbackRoute } from './auth/callback';
import { initDB } from './db/database';
import { TrackingService } from './services/trackingService';
import { createBackup } from './utils/backup';
import { PerformanceMonitor } from './services/monitoring/PerformanceMonitor';
import { SpotifyService } from './services/streaming/SpotifyService';

// Load and validate environment variables
config();
validateEnvironment();

// Initialize performance monitoring
const monitor = PerformanceMonitor.getInstance();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
}) as any;

// Initialize collections
client.commands = new Collection();

async function initializeCommands(): Promise<void> {
  const startTime = monitor.startTimer();
  try {
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.ts'));
    const commandsData: any[] = [];

    for (const file of commandFiles) {
      const command = require(join(commandsPath, file));
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commandsData,
    });

    monitor.recordMetric('command-init', { duration: performance.now() - startTime });
    console.log('Successfully registered application commands.');
  } catch (error) {
    monitor.recordError(error as Error);
    console.error('Failed to initialize commands:', error);
    throw error;
  }
}

async function initializeEvents(): Promise<void> {
  const startTime = monitor.startTimer();
  try {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith('.ts'));

    for (const file of eventFiles) {
      const event = require(join(eventsPath, file));
      if (event.once) {
        client.once(event.name, (...args: any[]) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args: any[]) => event.execute(...args, client));
      }
    }

    monitor.recordMetric('event-init', { duration: performance.now() - startTime });
  } catch (error) {
    monitor.recordError(error as Error);
    console.error('Failed to initialize events:', error);
    throw error;
  }
}

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
  // Run backup every day at 3 AM
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      try {
        await createBackup();
      } catch (error) {
        monitor.recordError(error as Error);
      }
    }
  }, 60 * 1000); // Check every minute
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

// Main application startup
async function main(): Promise<void> {
  try {
    await initDB();
    await initializeCommands();
    await initializeEvents();

    client.once('ready', async () => {
      console.log('Bot is ready!');
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

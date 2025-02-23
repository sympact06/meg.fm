import { Client, GatewayIntentBits, Collection, REST, Routes, Message } from 'discord.js';
import { config } from 'dotenv';
import express from 'express';
import { readdirSync } from 'fs';
import { join } from 'path';
import { loginRoute } from './auth/authorize';
import { callbackRoute } from './auth/callback';
import { initDB } from './db/database';
import { TrackingService } from './services/trackingService';

config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ]
}) as any;
client.commands = new Collection();

const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
const commandsData: any[] = [];

for (const file of commandFiles) {
  const command = require(join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is not defined in the environment variables');
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
rest.put(
  Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
  { body: commandsData }
)
  .then(() => console.log('Successfully registered application (slash) commands.'))
  .catch(console.error);

const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts'));
for (const file of eventFiles) {
  const event = require(join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args: any[]) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args: any[]) => event.execute(...args, client));
  }
}

client.once('ready', async () => {
  console.log('Bot is ready!');
  const trackingService = TrackingService.getInstance();
  await trackingService.initializeFromDatabase();
});

client.login(process.env.DISCORD_TOKEN);

initDB().then(() => console.log('Database initialized'));

const app = express();
const port = process.env.PORT || 8888;

loginRoute(app);
callbackRoute(app);

app.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});

import { Client } from 'discord.js';
import * as interactionCreate from './interactionCreate';
import * as messageCreate from './messageCreate';
import * as ready from './ready';

const events = [interactionCreate, messageCreate, ready];

export async function initializeEvents(client: Client) {
  client.removeAllListeners();

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

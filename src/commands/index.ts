import { Collection } from 'discord.js';
import * as achievements from './achievements';
import * as authorize from './authorize';
import * as compare from './compare';
import * as effects from './effects';
import * as friend from './friend';
import * as meg from './meg';
import * as profile from './profile';
import * as stats from './stats';

const commands = new Collection();

// Add all commands to the collection
[
  achievements,
  authorize,
  compare,
  effects,
  friend,
  meg,
  profile,
  stats
].forEach(cmd => {
  if ('data' in cmd && 'execute' in cmd) {
    commands.set(cmd.data.name, cmd);
  }
});

export async function initializeCommands() {
  return commands;
}

export { commands };
import { SlashCommandBuilder, CommandInteraction, Message } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('authorize')
  .setDescription('Authorize the bot to access your Spotify account');

export async function execute(context: CommandInteraction | Message, args?: string[]) {
  const discordId = 'user' in context ? context.user.id : context.author.id;
  // Change the hostname if deploying publicly.
  const authUrl = `http://localhost:8888/login?discordId=${discordId}`;
  await context.reply(`Please authorize the bot by clicking this link: ${authUrl}`);
}

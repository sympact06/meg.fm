import { SlashCommandBuilder, CommandInteraction, Message } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('authorize')
  .setDescription('Authorize the bot to access your Spotify account')
  .setContexts([0, 1, 2]); // Guild, BotDM, PrivateChannel

export async function execute(context: CommandInteraction | Message, args?: string[]) {
  const discordId = 'user' in context ? context.user.id : context.author.id;
  const authUrl = `http://localhost:8888/login?discordId=${discordId}`;
  await context.reply(`Please authorize the bot by clicking this link: ${authUrl}`);
}

import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserStats, getUserMostPlayedArtists } from '../db/userStats';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View listening profile for a user')
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('User to view profile for (defaults to yourself)')
      .setRequired(false)
  );

export async function execute(interaction: CommandInteraction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const stats = await getUserStats(targetUser.id);
  
  if (!stats) {
    await interaction.reply({
      content: `No listening data found for ${targetUser.username}`,
      ephemeral: true
    });
    return;
  }

  const topArtists = await getUserMostPlayedArtists(targetUser.id, 3);
  
  const embed = new EmbedBuilder()
    .setColor('#1DB954')
    .setTitle(`${targetUser.username}'s Music Profile`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { 
        name: '🎵 Listening Overview', 
        value: `
          Tracks Played: ${stats.total_tracks_played}
          Total Listening Time: ${Math.round(stats.total_listening_time_ms / 3600000)}h
        `,
        inline: false
      },
      {
        name: '🎸 Top Artists',
        value: topArtists.length ? 
          topArtists.map((a, i) => `${['🥇','🥈','🥉'][i]} ${a.artistName}`).join('\n') :
          'No artists yet',
        inline: true
      },
      {
        name: '💫 Current Favorite',
        value: stats.favorite_track || 'No favorite track yet',
        inline: true
      }
    );

  await interaction.reply({ embeds: [embed] });
}

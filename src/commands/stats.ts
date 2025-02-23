import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getFriendship } from '../db/friends';
import { getDetailedArtistStats, getGenreStats, getListeningTrends } from '../db/userStats';
import { getAchievements } from '../utils/achievements';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View detailed music statistics')
  .addSubcommand(sub => 
    sub.setName('artists')
      .setDescription('View detailed artist statistics')
      .addUserOption(opt => 
        opt.setName('user')
           .setDescription('User to view stats for')
           .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('trends')
      .setDescription('View your listening trends')
  )
  .addSubcommand(sub =>
    sub.setName('achievements')
      .setDescription('View your music achievements')
  );

export async function execute(interaction: CommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user') || interaction.user;

  if (targetUser.id !== interaction.user.id) {
    const friendship = await getFriendship(interaction.user.id, targetUser.id);
    if (!friendship) {
      await interaction.reply({
        content: `You need to be friends with ${targetUser.username} to view their stats! Use /friend add first.`,
        ephemeral: true
      });
      return;
    }
  }

  switch (subcommand) {
    case 'artists':
      const artistStats = await getDetailedArtistStats(targetUser.id);
      const artistEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Top Artists`)
        .setDescription('Most played artists in the last 30 days')
        .addFields(
          artistStats.map(stat => ({
            name: stat.artistName,
            value: `Played ${stat.playCount} times\nTotal: ${Math.round(stat.totalTime / 3600000)}h`,
            inline: true
          }))
        );
      await interaction.reply({ embeds: [artistEmbed] });
      break;

    case 'trends':
      const trends = await getListeningTrends(targetUser.id);
      const trendEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Listening Trends`)
        .addFields({
          name: 'Last 30 Days',
          value: trends.map(t => 
            `${t.day}: ${t.plays} plays (${t.unique_artists} artists)`
          ).join('\n').slice(0, 1024)
        });
      await interaction.reply({ embeds: [trendEmbed] });
      break;

    case 'achievements':
      const achievements = await getAchievements(targetUser.id);
      const achievementsEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Achievements`)
        .setDescription('Your music listening milestones')
        .addFields(
          achievements.map(a => ({
            name: `${a.emoji} ${a.name}`,
            value: a.description,
            inline: true
          }))
        );
      await interaction.reply({ embeds: [achievementsEmbed] });
      break;
  }
}

import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getFriendship } from '../db/friends';
import { getDetailedArtistStats, getListeningTrends, getUserStats } from '../db/userStats';
import { 
  getAchievements, 
  formatAchievements, 
  getCategoryEmoji, 
  formatAchievement,
  ACHIEVEMENTS  // Import ACHIEVEMENTS constant
} from '../utils/achievements';
import { createProgressBar } from '../utils/formatters';

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
    if (!friendship || friendship.status !== 'accepted') {
      await interaction.reply({ 
        content: `You need to be friends with ${targetUser.username} to view their stats! Use /friend add first.`,
        flags: ['Ephemeral']
      });
      return;
    }
  }

  const stats = await getUserStats(targetUser.id);
  if (!stats) {
    await interaction.reply({
      content: `No listening data found for ${targetUser.username}`,
      flags: ['Ephemeral']
    });
    return;
  }

  switch (subcommand) {
    case 'artists': {
      const artistStats = await getDetailedArtistStats(targetUser.id);
      if (!artistStats.length) {
        await interaction.reply({
          content: `${targetUser.username} hasn't listened to any music yet!`,
          flags: ['Ephemeral']
        });
        return;
      }

      const artistEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Top Artists`)
        .setDescription('Most played artists in the last 30 days')
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          artistStats.map(stat => ({
            name: stat.artistName,
            value: `🎵 ${stat.playCount} plays\n⏱️ ${Math.round(stat.totalTime / 3600000)}h total`,
            inline: true
          }))
        );
      await interaction.reply({ embeds: [artistEmbed] });
      break;
    }

    case 'trends': {
      const trends = await getListeningTrends(targetUser.id);
      if (!trends.length) {
        await interaction.reply({
          content: `No recent listening activity found for ${targetUser.username}`,
          flags: ['Ephemeral']
        });
        return;
      }

      const trendEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Listening Trends`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields({
          name: '📊 Last 30 Days',
          value: trends.map(t => 
            `${t.day}: ${t.plays} plays (${t.unique_artists} artists)`
          ).join('\n').slice(0, 1024)
        });
      await interaction.reply({ embeds: [trendEmbed] });
      break;
    }

    case 'achievements': {
      const achievements = await getAchievements(targetUser.id);
      const { categories, stats: achievementStats, level, inProgress } = formatAchievements(achievements, stats);
      
      const achievementsEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${targetUser.username}'s Music Journey`)
        .setDescription(
          `🎭 **${level.title}** (Level ${level.level})\n` +
          createProgressBar(level.currentXP, level.nextLevelXP, 20) + 
          `\n${level.currentXP}/${level.nextLevelXP} XP\n\n` +
          `🏆 **Achievement Progress**\n` +
          `👑 Legendary: ${achievementStats.legendary}\n` +
          `💫 Epic: ${achievementStats.epic}\n` +
          `✨ Rare: ${achievementStats.rare}\n` +
          `⭐ Common: ${achievementStats.common}\n` +
          `Total: ${achievementStats.total}/${Object.values(ACHIEVEMENTS).flat().length}`
        )
        .setThumbnail(targetUser.displayAvatarURL());

      // Add completed achievements by category
      Object.entries(categories).forEach(([category, items]) => {
        const completedItems = items.filter(a => 
          a.progress && a.progress.current >= a.progress.target
        );
        
        if (completedItems.length > 0) {
          achievementsEmbed.addFields({
            name: `${getCategoryEmoji(category)} Completed`,
            value: completedItems.map(a => formatAchievement(a)).join('\n\n'),
            inline: false
          });
        }
      });

      // Add in-progress achievements
      if (inProgress.length > 0) {
        achievementsEmbed.addFields({
          name: '🎯 In Progress',
          value: inProgress.map(a => formatAchievement(a)).join('\n\n'),
          inline: false
        });
      }

      // Add locked achievements count
      const totalAchievements = Object.values(ACHIEVEMENTS).flat().length;
      const lockedCount = totalAchievements - achievements.length;
      if (lockedCount > 0) {
        achievementsEmbed.addFields({
          name: '🔒 Locked',
          value: `${lockedCount} more achievements to discover!`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [achievementsEmbed] });
      break;
    }
  }
}

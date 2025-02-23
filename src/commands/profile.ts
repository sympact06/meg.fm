import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserStats, getUserMostPlayedArtists } from '../db/userStats';
import { getAchievements, formatAchievements, getCategoryEmoji } from '../utils/achievements';

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
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const stats = await getUserStats(targetUser.id);
  
  if (!stats) {
    await interaction.editReply({
      content: `No listening data found for ${targetUser.username}`
    });
    return;
  }

  const topArtists = await getUserMostPlayedArtists(targetUser.id, 3);
  const achievements = await getAchievements(targetUser.id);
  const { categories, stats: achievementStats, level, inProgress } = formatAchievements(achievements, stats);

  // Calculate daily average, default to "N/A" if invalid
  const daysSinceFirst = stats.first_seen ? 
    Math.max(1, (Date.now() - stats.first_seen) / 86400000) : 0;
  const dailyAverage = daysSinceFirst > 0 ? 
    `**${Math.round((stats.total_tracks_played / daysSinceFirst) * 10) / 10}**` : 
    "**N/A**";

  // Create the main embed
  const embed = new EmbedBuilder()
    .setColor('#1DB954')
    .setTitle(`${targetUser.username}'s Music Profile`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { 
        name: '📊 Level Stats', 
        value: `
          **Level ${level.level}** - ${level.title}
          XP: ${level.currentXP}/${level.nextLevelXP}
          Progress: ${'▰'.repeat(Math.floor(level.currentXP/level.nextLevelXP * 10))}${'▱'.repeat(10 - Math.floor(level.currentXP/level.nextLevelXP * 10))}
        `,
        inline: false
      },
      { 
        name: '🎵 Listening Overview', 
        value: `
          Tracks Played: **${stats.total_tracks_played.toLocaleString()}**
          Total Listening Time: **${Math.round(stats.total_listening_time_ms / 3600000)}h**
          Daily Average: ${dailyAverage} tracks
        `,
        inline: false
      },
      {
        name: '🏆 Achievements',
        value: `
          Total: **${achievementStats.total}**
          👑 Legendary: **${achievementStats.legendary}**
          💫 Epic: **${achievementStats.epic}**
          ✨ Rare: **${achievementStats.rare}**
          ⭐ Common: **${achievementStats.common}**
        `,
        inline: true
      },
      {
        name: '🎸 Top Artists',
        value: topArtists.length ? 
          topArtists.map((a, i) => `${['🥇','🥈','🥉'][i]} ${a.artistName} (${a.plays || 0} plays)`).join('\n') :
          'No artists yet',
        inline: true
      }
    );

  // Add recent achievements if any
  const recentAchievements = achievements
    .filter(a => a.unlockedAt)
    .sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0))
    .slice(0, 3);

  if (recentAchievements.length > 0) {
    embed.addFields({
      name: '🎉 Recent Achievements',
      value: recentAchievements
        .map(a => `${a.emoji} **${a.name}** (${a.rarity})`)
        .join('\n'),
      inline: false
    });
  }

  // Add achievements in progress if any
  if (inProgress.length > 0) {
    embed.addFields({
      name: '🎯 Next Achievements',
      value: inProgress
        .slice(0, 3)
        .map(a => `${a.emoji} **${a.name}** - ${a.progress?.display}`)
        .join('\n'),
      inline: false
    });
  }

  // Set footer with last updated timestamp
  embed.setFooter({ 
    text: `Last updated: ${new Date(stats.last_checked * 1000).toLocaleString()}`
  });

  await interaction.editReply({ embeds: [embed] });
}

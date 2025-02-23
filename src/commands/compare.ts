import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getFriendship } from '../db/friends';
import { getListeningBattle, findCommonArtists, compareListeningStats } from '../db/userStats';

export const data = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Compare music taste with a friend')
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('User to compare with')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('What to compare')
      .setRequired(true)
      .addChoices(
        { name: 'Overall Stats', value: 'overall' },
        { name: 'Common Artists', value: 'artists' },
        { name: 'Music Battle', value: 'battle' }
      )
  );

export async function execute(interaction: CommandInteraction) {
  const targetUser = interaction.options.getUser('user')!;
  const compareType = interaction.options.getString('type')!;

  // Check friendship
  const friendship = await getFriendship(interaction.user.id, targetUser.id);
  if (!friendship) {
    await interaction.reply({
      content: `You need to be friends with ${targetUser.username} to compare stats! Use /friend add first.`,
      ephemeral: true
    });
    return;
  }

  switch (compareType) {
    case 'overall':
      const stats = await compareListeningStats(interaction.user.id, targetUser.id);
      const overallEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`${interaction.user.username} vs ${targetUser.username}`)
        .setDescription(`Music Taste Match: ${stats.matchScore}%`)
        .addFields(
          {
            name: 'Common Artists',
            value: stats.commonArtists.length ? 
              stats.commonArtists.map(a => `• ${a.artistName}`).join('\n') :
              'No common artists yet',
            inline: false
          },
          {
            name: interaction.user.username,
            value: `${stats.stats1?.total_tracks_played || 0} tracks\n${Math.round((stats.stats1?.total_listening_time_ms || 0) / 3600000)}h total`,
            inline: true
          },
          {
            name: targetUser.username,
            value: `${stats.stats2?.total_tracks_played || 0} tracks\n${Math.round((stats.stats2?.total_listening_time_ms || 0) / 3600000)}h total`,
            inline: true
          }
        );
      await interaction.reply({ embeds: [overallEmbed] });
      break;

    case 'artists':
      const commonArtists = await findCommonArtists(interaction.user.id, targetUser.id);
      const artistEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle(`Common Artists: ${interaction.user.username} & ${targetUser.username}`)
        .addFields(
          commonArtists.map(artist => ({
            name: artist.artistName,
            value: `${interaction.user.username}: ${artist.user1_tracks} tracks\n${targetUser.username}: ${artist.user2_tracks} tracks`,
            inline: true
          }))
        );
      await interaction.reply({ embeds: [artistEmbed] });
      break;

    case 'battle':
      const battle = await getListeningBattle(interaction.user.id, targetUser.id);
      const battleEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎵 Music Battle! 🎵')
        .setDescription(`${interaction.user.username} vs ${targetUser.username}`)
        .addFields(
          {
            name: `${interaction.user.username}'s Score: ${battle.battleScore.user1}`,
            value: getBattleStats(battle.overall.user1, battle.today[0]),
            inline: true
          },
          {
            name: `${targetUser.username}'s Score: ${battle.battleScore.user2}`,
            value: getBattleStats(battle.overall.user2, battle.today[1]),
            inline: true
          },
          {
            name: 'Battle Result',
            value: getBattleResult(battle.battleScore, interaction.user.username, targetUser.username),
            inline: false
          }
        );
      await interaction.reply({ embeds: [battleEmbed] });
      break;
  }
}

function getBattleStats(overall: any, today: any) {
  return `All Time: ${overall?.total_tracks_played || 0} tracks
Today: ${today?.tracks_today || 0} tracks
Unique Artists Today: ${today?.artists_today || 0}`;
}

function getBattleResult(scores: any, user1: string, user2: string): string {
  const diff = Math.abs(scores.user1 - scores.user2);
  const winner = scores.user1 > scores.user2 ? user1 : user2;
  
  if (diff < 10) return "It's a close battle! 🤼";
  if (diff < 50) return `${winner} has the edge! 🏆`;
  return `${winner} dominates! 👑`;
}

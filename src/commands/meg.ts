import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, Message, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import axios from 'axios';
import { getTokens, updateAccessToken } from '../db/database';
import { refreshAccessToken } from '../utils/spotifyUtils';
import { recordReaction, getTotalReactions, getTotalVotes, getUserVote, recordVote } from '../db/reactions';
import { extractColors } from '../utils/colorExtractor';
import specialEffects from '../config/specialEffects.json';
import { TrackingService } from '../services/trackingService';

export const data = new SlashCommandBuilder()
  .setName('meg')
  .setDescription('Displays your currently playing Spotify track');

export async function execute(context: CommandInteraction | Message, args?: string[]) {
  const discordId = 'user' in context ? context.user.id : context.author.id;
  console.log('Command executed by:', discordId);

  // Start tracking this user
  const trackingService = TrackingService.getInstance();
  trackingService.addUser(discordId);
  trackingService.startTracking();

  const tokens = await getTokens(discordId);
  if (!tokens) {
    if (context instanceof CommandInteraction) {
      await context.reply("You haven't authorized yet. Please use `/authorize`.");
    } else {
      await context.reply("You haven't authorized yet. Please use `.authorize`.");
    }
    return;
  }

  let accessToken = tokens.access_token;
  const currentTime = Math.floor(Date.now() / 1000);
  // Refresh token if expired
  if (tokens.expires_at < currentTime) {
    try {
      const newTokenData = await refreshAccessToken(tokens.refresh_token);
      accessToken = newTokenData.access_token;
      const newExpiresAt = currentTime + newTokenData.expires_in;
      await updateAccessToken(discordId, accessToken, newExpiresAt);
    } catch (error) {
      console.error('Error refreshing token:', error);
      await context.reply('Error refreshing your Spotify token. Please re-authorize with `/authorize` or `.authorize`.');
      return;
    }
  }

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.data && response.data.item) {
      const track = response.data.item;
      const invokerId = context instanceof CommandInteraction ? context.user.id : context.author.id;
      console.log('Track info:', { 
        id: track.id, 
        name: track.name, 
        artist: track.artists[0].name,
        invoker: invokerId 
      });
      
      // Get colors based on the track URL (now synchronous)
      const colors = extractColors(track.album.images[0].url);
      
      // Check for special effects
      const artistEffect = specialEffects.artists[track.artists[0].name];
      const songEffect = specialEffects.songs[track.name];
      const effect = songEffect || artistEffect;

      // Get initial vote counts
      const votes = await getTotalVotes(track.id);
      const userVote = await getUserVote(track.id, invokerId);
      console.log('Initial votes:', { trackId: track.id, ...votes, userVote });

      const embed = new EmbedBuilder()
        .setColor(effect?.color ? effect.color : colors.primary)
        .setTitle(applyEffect(track.name, effect?.effect))
        .setURL(track.external_urls.spotify)
        .setAuthor({ 
          name: track.artists.map((artist: any) => artist.name).join(', '),
          iconURL: track.album.images[2].url
        })
        .setThumbnail(track.album.images[0].url)
        .addFields(
          { name: 'Album', value: track.album.name, inline: true },
          { name: 'Duration', value: formatDuration(track.duration_ms), inline: true },
          { name: 'Popularity', value: `${track.popularity}%`, inline: true },
          { name: '👍 Likes', value: votes.likes.toString(), inline: true },
          { name: '👎 Dislikes', value: votes.dislikes.toString(), inline: true }
        );

      // Create buttons with debug info
      console.log('Creating buttons with customId pattern:', `like/dislike_${track.id}_${invokerId}`);
      const row = createVoteButtons(track.id, invokerId, userVote);

      const reply = await context.reply({ 
        embeds: [embed],
        components: [row],
        fetchReply: true
      });
      console.log('Reply sent:', { messageId: reply.id });
    } else {
      await context.reply('No track is currently playing.');
    }
  } catch (error) {
    console.error('Error fetching currently playing track:', error);
    await context.reply('Error fetching your currently playing track.');
  }
}

export async function handleButton(interaction: ButtonInteraction) {
  console.log('Button interaction received:', {
    customId: interaction.customId,
    userId: interaction.user.id,
    messageId: interaction.message.id
  });

  const [action, trackId, trackOwnerId] = interaction.customId.split('_');
  console.log('Parsed interaction data:', { action, trackId, trackOwnerId });

  const userId = interaction.user.id;
  if (trackOwnerId === userId) {
    console.log('Self-vote attempted:', { userId, trackId });
    await interaction.reply({ 
      content: 'You cannot vote on your own track!',
      ephemeral: true 
    });
    return;
  }

  console.log('Recording vote:', { userId, trackId, action });
  const voteRecorded = await recordVote(trackId, userId, action);
  if (!voteRecorded) {
    console.log('Failed to record vote');
    await interaction.reply({
      content: 'Failed to record your vote. Please try again.',
      ephemeral: true
    });
    return;
  }

  const votes = await getTotalVotes(trackId);
  console.log('Updated vote counts:', { trackId, ...votes });

  // Update embed using interaction.message directly
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .spliceFields(3, 2, { 
      name: '👍 Likes', 
      value: votes.likes.toString(), 
      inline: true 
    }, {
      name: '👎 Dislikes',
      value: votes.dislikes.toString(),
      inline: true
    });

  // Update button styles
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`like_${trackId}_${trackOwnerId}`)
        .setEmoji('👍')
        .setStyle(action === 'like' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`dislike_${trackId}_${trackOwnerId}`)
        .setEmoji('👎')
        .setStyle(action === 'dislike' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

  console.log('Updating message with new embed and buttons');
  await interaction.update({ 
    embeds: [embed],
    components: [row]
  });
  console.log('Update complete');
}

function formatDuration(duration_ms: number): string {
  const minutes = Math.floor(duration_ms / 60000);
  const seconds = Math.floor((duration_ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function applyEffect(text: string, effectName?: string): string {
  if (!effectName || !specialEffects.effects[effectName]) return text;
  const effectTemplate = specialEffects.effects[effectName];
  return effectTemplate.replace('%s', text);
}

function createVoteButtons(trackId: string, invokerId: string, userVote: string) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`like_${trackId}_${invokerId}`)
        .setEmoji('👍')
        .setStyle(userVote === 'like' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`dislike_${trackId}_${invokerId}`)
        .setEmoji('👎')
        .setStyle(userVote === 'dislike' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
}

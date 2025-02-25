import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ColorResolvable,
} from 'discord.js';
import axios from 'axios';
import { getTokens, updateAccessToken } from '../db/database';
import { refreshAccessToken } from '../utils/spotifyUtils';
import { getTotalVotes, getUserVote, recordVote } from '../db/reactions';
import { extractColors } from '../utils/colorExtractor';
import specialEffects from '../config/specialEffects.json';
import { TrackingService } from '../services/trackingService';
import { SpotifyService } from '../services/streaming/SpotifyService';

type SpecialEffect = {
  effect: string;
  border: string;
  color: ColorResolvable;
};

type SpecialEffects = {
  artists: { [key: string]: SpecialEffect };
  songs: { [key: string]: SpecialEffect };
  effects: { [key: string]: string };
};

const typedSpecialEffects = specialEffects as SpecialEffects;

export const data = new SlashCommandBuilder()
  .setName('meg')
  .setDescription('View currently playing track')
  .setContexts([0, 1, 2]); // Guild, BotDM, PrivateChannel

export async function execute(interaction: CommandInteraction) {
  const discordId = interaction.user.id;
  console.log('Command executed by:', discordId);

  const spotifyService = SpotifyService.getInstance({
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
  });
  const trackingService = TrackingService.getInstance(spotifyService);
  trackingService.addUser(discordId);
  trackingService.startTracking();

  const tokens = await getTokens(discordId);
  if (!tokens) {
    await interaction.reply("You haven't authorized yet. Please use `/authorize`.");
    return;
  }

  let accessToken = tokens.accessToken;
  const currentTime = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt < currentTime) {
    try {
      const newTokenData = await spotifyService.refreshToken(tokens.refreshToken);
      accessToken = newTokenData.accessToken;
      const newExpiresAt = currentTime + newTokenData.expiresIn;
      await updateAccessToken(discordId, accessToken, newExpiresAt);
    } catch (error) {
      console.error('Error refreshing token:', error);
      await interaction.reply(
        'Error refreshing your Spotify token. Please re-authorize with `/authorize`.'
      );
      return;
    }
  }

  try {
    const track = await spotifyService.getCurrentTrack(accessToken);
    if (track) {
      const votes = await getTotalVotes(track.id);
      const userVote = await getUserVote(track.id, interaction.user.id);

      const artistEffect = typedSpecialEffects.artists[track.artist];
      const songEffect = typedSpecialEffects.songs[track.name];
      const effect = songEffect || artistEffect;

      const embed = new EmbedBuilder()
        .setColor(effect?.color ? effect.color : '#1DB954')
        .setTitle(applyEffect(track.name, effect?.effect))
        .setURL(`https://open.spotify.com/track/${track.id}`)
        .setAuthor({
          name: track.artist,
        })
        .setThumbnail(track.imageUrl || '')
        .addFields(
          { name: 'Album', value: track.album, inline: true },
          { name: 'Duration', value: formatDuration(track.duration), inline: true },
          { name: 'Votes', value: `👍 ${votes.likes} • 👎 ${votes.dislikes}`, inline: true }
        );

      const row = createVoteButtons(track.id, interaction.user.id, userVote);

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        withResponse: true,
      });
      console.log('Reply sent:', { messageId: reply.id });
    } else {
      await interaction.reply('No track is currently playing.');
    }
  } catch (error) {
    console.error('Error fetching currently playing track:', error);
    await interaction.reply('Error fetching your currently playing track.');
  }
}

export async function handleButton(interaction: ButtonInteraction) {
  console.log('Button interaction received:', {
    customId: interaction.customId,
    userId: interaction.user.id,
    messageId: interaction.message.id,
  });

  const [action, trackId, trackOwnerId] = interaction.customId.split('_');
  console.log('Parsed interaction data:', { action, trackId, trackOwnerId });

  const userId = interaction.user.id;
  if (trackOwnerId === userId) {
    console.log('Self-vote attempted:', { userId, trackId });
    await interaction.reply({
      content: 'You cannot vote on your own track!',
      ephemeral: true,
    });
    return;
  }

  console.log('Recording vote:', { userId, trackId, action });
  await recordVote(trackId, userId, action);

  const votes = await getTotalVotes(trackId);
  console.log('Updated vote counts:', { trackId, ...votes });

  const embed = EmbedBuilder.from(interaction.message.embeds[0]).spliceFields(2, 1, {
    name: 'Votes',
    value: `👍 ${votes.likes} • 👎 ${votes.dislikes}`,
    inline: true,
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    components: [row],
  });
  console.log('Update complete');
}

function formatDuration(duration_ms: number): string {
  const minutes = Math.floor(duration_ms / 60000);
  const seconds = Math.floor((duration_ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function applyEffect(text: string, effectName?: string): string {
  if (!effectName) return text;
  const effect = typedSpecialEffects.effects[effectName];
  return effect ? effect.replace('%s', text) : text;
}

function createVoteButtons(trackId: string, invokerId: string, userVote: string | null) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
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

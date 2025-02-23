import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder } from 'discord.js';
import { getUserStats, getUserMostPlayedArtists } from '../db/userStats';
import { getAchievements, formatAchievements } from '../utils/achievements';
import { getUserProfile, updateUserProfile } from '../db/profile';
import { renderProfile } from '../utils/profileRenderer';
import { shiftColor } from '../utils/colorUtils';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View or customize your music profile')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('User to view profile for')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('accent_color')
      .setDescription('Set your profile accent color (hex code)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('banner')
      .setDescription('Set your profile banner (1-5)')
      .setRequired(false)
      .addChoices(
        { name: 'Waves', value: 'waves' },
        { name: 'Mountains', value: 'mountains' },
        { name: 'Circuit', value: 'circuit' },
        { name: 'Gradient', value: 'gradient' },
        { name: 'Minimal', value: 'minimal' }
      )
  );

export async function execute(interaction: CommandInteraction) {
  // Handle customization if color or banner options are provided
  const accentColor = interaction.options.getString('accent_color');
  const banner = interaction.options.getString('banner');

  if (accentColor || banner) {
    // Validate hex color if provided
    if (accentColor && !/^#[0-9A-F]{6}$/i.test(accentColor)) {
      await interaction.reply({
        content: 'Invalid color format! Please use a valid hex color code (e.g., #FF0000).',
        ephemeral: true
      });
      return;
    }

    await updateUserProfile(interaction.user.id, {
      ...(accentColor && { accent_color: accentColor }),
      ...(banner && { banner })
    });

    await interaction.reply({
      content: 'Profile customization updated!',
      ephemeral: true
    });
    return;
  }

  // Handle profile view
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const [stats, topArtists, achievements, profile] = await Promise.all([
    getUserStats(targetUser.id),
    getUserMostPlayedArtists(targetUser.id, 3),
    getAchievements(targetUser.id),
    getUserProfile(targetUser.id)
  ]);

  if (!stats) {
    await interaction.reply({
      content: `No listening data found for ${targetUser.username}.`,
      ephemeral: true
    });
    return;
  }

  const achievementsData = formatAchievements(achievements, stats);

  try {
    // Shift background color slightly from accent color
    const profileImage = await renderProfile({
      user: targetUser,
      stats,
      topArtists: topArtists || [],
      achievements: achievementsData || {
        level: { level: 1, currentXP: 0, nextLevelXP: 100, title: 'Newbie Listener' },
        recent: []
      },
      profile: {
        ...profile,
        background_color: shiftColor(profile.accent_color, -20)
      }
    });

    const attachment = new AttachmentBuilder(profileImage, { name: 'profile.png' });
    await interaction.reply({ files: [attachment] });
  } catch (error) {
    console.error('Error generating profile:', error);
    await interaction.reply({
      content: 'There was an error generating your profile. Please try again later.',
      ephemeral: true
    });
  }
}

import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import adminUsers from '../config/adminUsers.json';
import specialEffects from '../config/specialEffects.json';
import { predefinedColors, ColorName } from '../config/colors';

export const data = new SlashCommandBuilder()
  .setName('effects')
  .setDescription('Manage special effects for songs and artists')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all available effects')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a special effect')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type of target')
          .setRequired(true)
          .addChoices(
            { name: 'Artist', value: 'artist' },
            { name: 'Song', value: 'song' }
          )
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Artist or song name')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('effect')
          .setDescription('Effect to apply')
          .setRequired(true)
          .addChoices(
            { name: '✨ Sparkles', value: 'sparkles' },
            { name: '💠 Neon', value: 'neon' },
            { name: '🌊 Wave', value: 'wave' }
          )
      )
      .addStringOption(option => {
        const colorOption = option
          .setName('color')
          .setDescription('Choose a color')
          .setRequired(true);

        // Add all predefined colors as choices
        Object.entries(predefinedColors).forEach(([name, hex]) => {
          option.addChoices({ name, value: hex });
        });

        return option;
      })
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a special effect')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type of target')
          .setRequired(true)
          .addChoices(
            { name: 'Artist', value: 'artist' },
            { name: 'Song', value: 'song' }
          )
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Artist or song name')
          .setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction) {
  // Check if user is admin
  if (!adminUsers.admins.includes(interaction.user.id)) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: true
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    const embed = new EmbedBuilder()
      .setTitle('Special Effects Configuration')
      .setColor('#1DB954')
      .addFields(
        { 
          name: 'Available Effects', 
          value: Object.entries(specialEffects.effects)
            .map(([name, pattern]) => `${name}: ${pattern}`)
            .join('\n')
        },
        {
          name: 'Available Colors',
          value: Object.entries(predefinedColors)
            .map(([name, hex]) => `${name}: ${hex}`)
            .join('\n')
        },
        {
          name: 'Artists with Effects',
          value: Object.entries(specialEffects.artists)
            .map(([name, config]) => `${name}: ${config.effect} (${config.color})`)
            .join('\n') || 'None'
        },
        {
          name: 'Songs with Effects',
          value: Object.entries(specialEffects.songs)
            .map(([name, config]) => `${name}: ${config.effect} (${config.color})`)
            .join('\n') || 'None'
        }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === 'add') {
    const type = interaction.options.getString('type', true);
    const name = interaction.options.getString('name', true);
    const effect = interaction.options.getString('effect', true);
    const color = interaction.options.getString('color', true);

    const target = type === 'artist' ? specialEffects.artists : specialEffects.songs;
    target[name] = {
      effect,
      border: getBorderForEffect(effect),
      color
    };

    saveSpecialEffects();

    await interaction.reply({
      content: `Added ${effect} effect to ${type} "${name}" with color ${getColorName(color)}`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'remove') {
    const type = interaction.options.getString('type', true);
    const name = interaction.options.getString('name', true);

    const target = type === 'artist' ? specialEffects.artists : specialEffects.songs;
    if (delete target[name]) {
      saveSpecialEffects();
      await interaction.reply({
        content: `Removed effect from ${type} "${name}"`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `No effect found for ${type} "${name}"`,
        ephemeral: true
      });
    }
  }
}

function getBorderForEffect(effect: string): string {
  const borders = {
    sparkles: '⭐',
    neon: '💫',
    wave: '🌊'
  };
  return borders[effect as keyof typeof borders] || '▬';
}

function saveSpecialEffects() {
  const filePath = join(__dirname, '../config/specialEffects.json');
  writeFileSync(filePath, JSON.stringify(specialEffects, null, 2));
}

function getColorName(hex: string): string {
  const entry = Object.entries(predefinedColors).find(([_, value]) => value === hex);
  return entry ? entry[0] : hex;
}

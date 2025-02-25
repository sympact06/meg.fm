import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
} from 'discord.js';
import { ACHIEVEMENTS } from '../utils/achievements';

export const data = new SlashCommandBuilder()
  .setName('achievements')
  .setDescription('View all available achievements')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Filter achievements by category')
      .setRequired(false)
      .addChoices(
        { name: '⏰ Dedication', value: 'dedication' },
        { name: '🗺️ Explorer', value: 'explorer' },
        { name: '🎤 Artist', value: 'artist' },
        { name: '👥 Social', value: 'social' },
        { name: '✨ Special', value: 'special' }
      )
  )
  .addStringOption((option) =>
    option
      .setName('rarity')
      .setDescription('Filter achievements by rarity')
      .setRequired(false)
      .addChoices(
        { name: '👑 Legendary', value: 'legendary' },
        { name: '💫 Epic', value: 'epic' },
        { name: '✨ Rare', value: 'rare' },
        { name: '⭐ Common', value: 'common' }
      )
  )
  .setContexts([0, 1, 2]); // Guild, BotDM, PrivateChannel

interface AchievementFilter {
  category?: string;
  rarity?: string;
  page: number;
  sortBy: 'category' | 'rarity';
}

const ITEMS_PER_PAGE = 5;

export async function execute(interaction: CommandInteraction) {
  const initialFilter: AchievementFilter = {
    category: interaction.options.getString('category') || undefined,
    rarity: interaction.options.getString('rarity') || undefined,
    page: 0,
    sortBy: 'category',
  };

  const achievements = getFilteredAchievements(initialFilter);
  const pages = Math.ceil(achievements.length / ITEMS_PER_PAGE);
  const embed = createAchievementsEmbed(
    achievements.slice(0, ITEMS_PER_PAGE),
    initialFilter,
    pages
  );

  const response = await interaction.reply({
    embeds: [embed],
    components: createNavigationButtons(initialFilter, pages),
    fetchReply: true,
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: "You can't interact with someone else's achievement list!",
        ephemeral: true,
      });
      return;
    }

    const newFilter = handleButtonClick(i.customId, initialFilter);
    const newAchievements = getFilteredAchievements(newFilter);
    const newPages = Math.ceil(newAchievements.length / ITEMS_PER_PAGE);
    const currentPageAchievements = newAchievements.slice(
      newFilter.page * ITEMS_PER_PAGE,
      (newFilter.page + 1) * ITEMS_PER_PAGE
    );

    await i.update({
      embeds: [createAchievementsEmbed(currentPageAchievements, newFilter, newPages)],
      components: createNavigationButtons(newFilter, newPages),
    });
  });

  collector.on('end', () => {
    if (response.editable) {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}

async function showAchievements(
  interaction: CommandInteraction | ButtonInteraction,
  filter: AchievementFilter
) {
  const achievements = getFilteredAchievements(filter);
  const pages = Math.ceil(achievements.length / ITEMS_PER_PAGE);
  const currentPageAchievements = achievements.slice(
    filter.page * ITEMS_PER_PAGE,
    (filter.page + 1) * ITEMS_PER_PAGE
  );

  const embed = createAchievementsEmbed(currentPageAchievements, filter, pages);
  const components = createNavigationButtons(filter, pages);

  const response = await interaction.reply({
    embeds: [embed],
    components,
    fetchReply: true,
  });

  // Create button collector
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    const newFilter = handleButtonClick(i.customId, filter);
    await showAchievements(i, newFilter);
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] });
  });
}

function getFilteredAchievements(filter: AchievementFilter) {
  let achievements = Object.entries(ACHIEVEMENTS).flatMap(([categoryName, items]) =>
    items.map((a) => ({
      ...a,
      category: categoryName,
    }))
  );

  if (filter.category) {
    achievements = achievements.filter((a) =>
      a.category.toLowerCase().includes(filter.category!.toLowerCase())
    );
  }

  if (filter.rarity) {
    achievements = achievements.filter((a) => a.rarity === filter.rarity);
  }

  // Sort achievements
  if (filter.sortBy === 'category') {
    achievements.sort((a, b) => a.category.localeCompare(b.category));
  } else {
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    achievements.sort(
      (a, b) =>
        rarityOrder[a.rarity as keyof typeof rarityOrder] -
        rarityOrder[b.rarity as keyof typeof rarityOrder]
    );
  }

  return achievements;
}

function createAchievementsEmbed(
  achievements: any[],
  filter: AchievementFilter,
  totalPages: number
) {
  const embed = new EmbedBuilder()
    .setColor('#1DB954')
    .setTitle('Available Achievements')
    .setDescription(
      `Sorted by: ${filter.sortBy}\n` +
        `${filter.category ? `Category: ${filter.category}\n` : ''}` +
        `${filter.rarity ? `Rarity: ${filter.rarity}\n` : ''}` +
        `Page ${filter.page + 1}/${totalPages}`
    );

  // Group achievements if sorted by category
  if (filter.sortBy === 'category') {
    const grouped = achievements.reduce(
      (acc, achievement) => {
        const cat = achievement.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(achievement);
        return acc;
      },
      {} as Record<string, any[]>
    );

    Object.entries(grouped).forEach(([category, items]) => {
      embed.addFields({
        name: category.split('_').join(' '),
        value: formatAchievements(items),
        inline: false,
      });
    });
  } else {
    embed.addFields({
      name: 'Achievements',
      value: formatAchievements(achievements),
      inline: false,
    });
  }

  return embed;
}

function createNavigationButtons(filter: AchievementFilter, totalPages: number) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(filter.page === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(filter.page === totalPages - 1)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sort_category')
      .setLabel('Sort by Category')
      .setStyle(filter.sortBy === 'category' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sort_rarity')
      .setLabel('Sort by Rarity')
      .setStyle(filter.sortBy === 'rarity' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return [row1, row2];
}

function handleButtonClick(customId: string, currentFilter: AchievementFilter): AchievementFilter {
  const newFilter = { ...currentFilter };

  switch (customId) {
    case 'prev':
      newFilter.page = Math.max(0, currentFilter.page - 1);
      break;
    case 'next':
      newFilter.page = currentFilter.page + 1;
      break;
    case 'sort_category':
      newFilter.sortBy = 'category';
      newFilter.page = 0;
      break;
    case 'sort_rarity':
      newFilter.sortBy = 'rarity';
      newFilter.page = 0;
      break;
  }

  return newFilter;
}

function formatAchievements(achievements: any[]): string {
  const rarityEmojis = {
    legendary: '👑',
    epic: '💫',
    rare: '✨',
    common: '⭐',
  };

  return achievements
    .map((a) => {
      let text = `${a.emoji} **${a.name}** ${rarityEmojis[a.rarity as keyof typeof rarityEmojis]}`;
      if (a.description) {
        text += `\n┗ ${a.description}`;
      } else if (a.target) {
        text += `\n┗ Required: ${a.target} ${a.category.includes('TIME') ? 'hours' : 'times'}`;
      }
      if (a.secret) {
        text += '\n┗ 🔍 Secret Achievement';
      }
      return text;
    })
    .join('\n\n');
}

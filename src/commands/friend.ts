import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('friend')
  .setDescription('Manage your music friends')
  .setContexts([0, 1, 2]) // Guild, BotDM, PrivateChannel
  .addSubcommand((sub) =>
    sub
      .setName('request')
      .setDescription('Send a friend request')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to send request to').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('accept')
      .setDescription('Accept a friend request')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User whose request to accept').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('decline')
      .setDescription('Decline a friend request')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User whose request to decline').setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('pending').setDescription('List pending friend requests'))
  .addSubcommand((sub) => sub.setName('list').setDescription('List your music friends'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'request': {
      const userToAdd = interaction.options.getUser('user')!;
      if (userToAdd.id === interaction.user.id) {
        await interaction.reply({
          content: "You can't add yourself as a friend!",
          flags: ['Ephemeral'],
        });
        return;
      }

      const existingFriendship = await prisma.friend.findUnique({
        where: {
          userId_friendId: {
            userId: interaction.user.id,
            friendId: userToAdd.id,
          },
        },
      });

      if (existingFriendship) {
        await interaction.reply({
          content: "You've already sent a friend request or are already friends!",
          flags: ['Ephemeral'],
        });
        return;
      }

      await prisma.friend.create({
        data: {
          userId: interaction.user.id,
          friendId: userToAdd.id,
          status: 'pending',
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        },
      });

      await interaction.reply({
        content: `Sent friend request to ${userToAdd.username}! They need to accept it using \`/friend accept\``,
        flags: ['Ephemeral'],
      });
      break;
    }

    case 'accept': {
      const userToAccept = interaction.options.getUser('user')!;
      const pendingRequest = await prisma.friend.findFirst({
        where: {
          userId: userToAccept.id,
          friendId: interaction.user.id,
          status: 'pending',
        },
      });

      if (!pendingRequest) {
        await interaction.reply({
          content: 'No pending friend request from this user!',
          flags: ['Ephemeral'],
        });
        return;
      }

      await prisma.friend.update({
        where: {
          userId_friendId: {
            userId: userToAccept.id,
            friendId: interaction.user.id,
          },
        },
        data: {
          status: 'accepted',
          updatedAt: Math.floor(Date.now() / 1000),
        },
      });

      await interaction.reply({
        content: `Accepted ${userToAccept.username}'s friend request! You can now view each other's stats.`,
        flags: ['Ephemeral'],
      });
      break;
    }

    case 'decline': {
      const userToDecline = interaction.options.getUser('user')!;

      await prisma.friend.delete({
        where: {
          userId_friendId: {
            userId: userToDecline.id,
            friendId: interaction.user.id,
          },
        },
      });

      await interaction.reply({
        content: `Declined ${userToDecline.username}'s friend request.`,
        flags: ['Ephemeral'],
      });
      break;
    }

    case 'pending': {
      const requests = await prisma.friend.findMany({
        where: {
          friendId: interaction.user.id,
          status: 'pending',
        },
      });

      if (requests.length === 0) {
        await interaction.reply({
          content: 'No pending friend requests!',
          flags: ['Ephemeral'],
        });
        return;
      }

      const requestUsers = await Promise.all(
        requests.map(async (r) => {
          const user = await interaction.client.users.fetch(r.userId);
          return `• ${user.username} (sent ${new Date(r.createdAt * 1000).toLocaleDateString()})`;
        })
      );

      const pendingEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('Pending Friend Requests')
        .setDescription(requestUsers.join('\n'));

      await interaction.reply({ embeds: [pendingEmbed], flags: ['Ephemeral'] });
      break;
    }

    case 'list': {
      const friends = await prisma.friend.findMany({
        where: {
          OR: [
            { userId: interaction.user.id, status: 'accepted' },
            { friendId: interaction.user.id, status: 'accepted' },
          ],
        },
      });

      if (friends.length === 0) {
        await interaction.reply({
          content: "You don't have any music friends yet!",
          flags: ['Ephemeral'],
        });
        return;
      }

      const friendUsers = await Promise.all(
        friends.map(async (f) => {
          const userId = f.userId === interaction.user.id ? f.friendId : f.userId;
          const user = await interaction.client.users.fetch(userId);
          return `• ${user.username} (since ${new Date(f.createdAt * 1000).toLocaleDateString()})`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('Your Music Friends')
        .setDescription(friendUsers.join('\n'));

      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      break;
    }
  }
}

import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { addFriend, removeFriend, getFriendsList, getFriendship } from '../db/friends';
import { getDB } from '../db/database';  

export const data = new SlashCommandBuilder()
  .setName('friend')
  .setDescription('Manage your music friends')
  .addSubcommand(sub =>
    sub.setName('request')
      .setDescription('Send a friend request')
      .addUserOption(opt =>
        opt.setName('user')
           .setDescription('User to send request to')
           .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('accept')
      .setDescription('Accept a friend request')
      .addUserOption(opt =>
        opt.setName('user')
           .setDescription('User whose request to accept')
           .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('decline')
      .setDescription('Decline a friend request')
      .addUserOption(opt =>
        opt.setName('user')
           .setDescription('User whose request to decline')
           .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('pending')
      .setDescription('List pending friend requests')
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List your music friends')
  );

export async function execute(interaction: CommandInteraction) {
  const db = await getDB();  // Get db instance
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'request':
      const userToAdd = interaction.options.getUser('user')!;
      if (userToAdd.id === interaction.user.id) {
        await interaction.reply({ content: "You can't add yourself as a friend!", flags: ['Ephemeral'] });
        return;
      }
      
      const existingFriendship = await getFriendship(interaction.user.id, userToAdd.id);
      if (existingFriendship) {
        await interaction.reply({ content: "You've already sent a friend request or are already friends!", flags: ['Ephemeral'] });
        return;
      }

      await addFriend(interaction.user.id, userToAdd.id);
      await interaction.reply({ 
        content: `Sent friend request to ${userToAdd.username}! They need to accept it using \`/friend accept\``,
        flags: ['Ephemeral'] 
      });
      break;

    case 'accept':
      const userToAccept = interaction.options.getUser('user')!;
      const pendingRequest = await db.get(
        'SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = ?',
        userToAccept.id, interaction.user.id, 'pending'
      );

      if (!pendingRequest) {
        await interaction.reply({ 
          content: "No pending friend request from this user!", 
          flags: ['Ephemeral'] 
        });
        return;
      }

      await acceptFriend(interaction.user.id, userToAccept.id);
      await interaction.reply({ 
        content: `Accepted ${userToAccept.username}'s friend request! You can now view each other's stats.`,
        flags: ['Ephemeral'] 
      });
      break;

    case 'decline':
      const userToDecline = interaction.options.getUser('user')!;
      await declineFriend(interaction.user.id, userToDecline.id);
      await interaction.reply({ 
        content: `Declined ${userToDecline.username}'s friend request.`,
        flags: ['Ephemeral'] 
      });
      break;

    case 'pending':
      const requests = await getPendingRequests(interaction.user.id);
      if (requests.length === 0) {
        await interaction.reply({ content: "No pending friend requests!", flags: ['Ephemeral'] });
        return;
      }

      const requestUsers = await Promise.all(
        requests.map(async (r) => {
          const user = await interaction.client.users.fetch(r.user_id);
          return `• ${user.username} (sent ${new Date(r.added_at).toLocaleDateString()})`;
        })
      );

      const pendingEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('Pending Friend Requests')
        .setDescription(requestUsers.join('\n'));

      await interaction.reply({ embeds: [pendingEmbed], flags: ['Ephemeral'] });
      break;

    case 'list':
      const friends = await getFriendsList(interaction.user.id);
      if (friends.length === 0) {
        await interaction.reply({ content: "You don't have any music friends yet!", flags: ['Ephemeral'] });
        return;
      }

      const friendUsers = await Promise.all(
        friends.map(async (f) => {
          const user = await interaction.client.users.fetch(f.friend_id);
          return `• ${user.username} (since ${new Date(f.added_at).toLocaleDateString()})`;
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

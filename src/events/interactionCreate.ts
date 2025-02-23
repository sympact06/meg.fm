import { Client, Interaction } from 'discord.js';

export const name = 'interactionCreate';
export async function execute(interaction: Interaction, client: any) {
  try {
    console.log('Interaction received:', {
      type: interaction.type,
      commandName: interaction.isCommand() ? interaction.commandName : undefined,
      customId: interaction.isButton() ? interaction.customId : undefined,
      userId: interaction.user.id
    });

    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.log('Command not found:', interaction.commandName);
        return;
      }
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      const [command] = interaction.customId.split('_');
      console.log('Button pressed:', { command, customId: interaction.customId });
      
      if (command === 'like' || command === 'dislike') {
        const megCommand = client.commands.get('meg');
        if (!megCommand) {
          console.error('Meg command not found for button handler');
          return;
        }
        await megCommand.handleButton(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    const reply = {
      content: 'There was an error processing your request.',
      ephemeral: true
    };
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply(reply);
    }
  }
}

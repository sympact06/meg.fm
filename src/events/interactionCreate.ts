import { Events, Interaction } from 'discord.js';
import { commands } from '../commands';
import { monitor } from '../services/monitoring/PerformanceMonitor';

export const name = Events.InteractionCreate;
export const once = false;
export async function execute(interaction: Interaction, client: any) {
  console.log('Interaction received:', {
    type: interaction.type,
    commandName: interaction.isCommand() ? interaction.commandName : undefined,
    customId: interaction.isButton() ? interaction.customId : undefined,
    userId: interaction.user.id,
  });

  const timer = monitor.startTimer();

  try {
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({
          content: 'There was an error executing this command!',
          ephemeral: true,
        });
        return;
      }

      await command.execute(interaction);
    } else if (interaction.isButton()) {
      const [command] = interaction.customId.split('_');
      const buttonHandler = client.commands.get(command)?.handleButton;

      if (!buttonHandler) {
        console.error(`No button handler for ${command} was found.`);
        await interaction.reply({
          content: 'There was an error while handling this button interaction!',
          ephemeral: true,
        });
        return;
      }

      await buttonHandler(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    const errorMessage = 'There was an error while executing this command!';
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (followUpError) {
      console.error('Error sending error message:', followUpError);
    }

    monitor.recordError(error as Error, interaction.user.id, {
      command: interaction.isCommand() ? interaction.commandName : undefined,
      customId: interaction.isButton() ? interaction.customId : undefined,
    });
  } finally {
    monitor.recordDuration('command-init', timer, interaction.user.id);
  }
}

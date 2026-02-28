import { Client, Events, Interaction } from 'discord.js';
import { commandHandlers } from '../commands';
import { buttonHandlers } from '../buttons';
import { modalHandlers } from '../modals';
import { handleRankPagination } from '../lib/pagination';
import { logger } from '../lib/logger';

export function registerInteractionEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const handler = commandHandlers[interaction.commandName];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('rank-page-')) {
          await handleRankPagination(interaction);
          return;
        }

        const [action] = interaction.customId.split(':');
        const handler = buttonHandlers[action];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        const [action] = interaction.customId.split(':');
        const handler = modalHandlers[action];
        if (handler) await handler(interaction);
        return;
      }
    } catch (error) {
      const interactionId = 'customId' in interaction ? (interaction as any).customId : (interaction as any).commandName;
      logger.error('Erro ao processar interação', { interactionId, error: String(error) });
      const reply = { content: 'Ocorreu um erro ao processar esta ação.', ephemeral: true };
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
  });
}

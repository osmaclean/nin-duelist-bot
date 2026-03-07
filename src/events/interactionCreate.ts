import { Client, Events, Interaction } from 'discord.js';
import { commandHandlers } from '../commands';
import { buttonHandlers } from '../buttons';
import { modalHandlers } from '../modals';
import { handleRankPagination, handleHistoryPagination } from '../lib/pagination';
import { logger } from '../lib/logger';

export function registerInteractionEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    const requestId = interaction.id;

    try {
      if (interaction.isChatInputCommand()) {
        logger.info('Comando recebido', { requestId, command: interaction.commandName });
        const handler = commandHandlers[interaction.commandName];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isButton()) {
        logger.info('Botão clicado', { requestId, customId: interaction.customId });

        if (interaction.customId.startsWith('rank-page-')) {
          await handleRankPagination(interaction);
          return;
        }

        if (interaction.customId.startsWith('hist:')) {
          await handleHistoryPagination(interaction);
          return;
        }

        const [action] = interaction.customId.split(':');
        const handler = buttonHandlers[action];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        logger.info('Modal submetido', { requestId, customId: interaction.customId });
        const [action] = interaction.customId.split(':');
        const handler = modalHandlers[action];
        if (handler) await handler(interaction);
        return;
      }
    } catch (error) {
      const interactionId =
        'customId' in interaction
          ? (interaction as { customId: string }).customId
          : 'commandName' in interaction
            ? (interaction as { commandName: string }).commandName
            : 'unknown';
      logger.error('Erro ao processar interação', { requestId, interactionId, error: String(error) });
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

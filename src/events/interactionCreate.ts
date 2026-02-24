import {
  Client,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { handleDuelCommand } from '../commands/duel';
import { handleRankCommand } from '../commands/rank';
import { handleMvpCommand } from '../commands/mvp';
import { handleAcceptDuel } from '../buttons/accept-duel';
import { handleAcceptWitness } from '../buttons/accept-witness';
import { handleStartDuel } from '../buttons/start-duel';
import { handleSubmitResult } from '../buttons/submit-result';
import { handleConfirmResult } from '../buttons/confirm-result';
import { handleRejectResult } from '../buttons/reject-result';
import { handleSubmitScoreModal } from '../modals/submit-score';
import { handleRankPagination } from '../lib/pagination';

const commandHandlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  duel: handleDuelCommand,
  rank: handleRankCommand,
  mvp: handleMvpCommand,
};

const buttonHandlers: Record<string, (i: ButtonInteraction) => Promise<void>> = {
  'accept-duel': handleAcceptDuel,
  'accept-witness': handleAcceptWitness,
  'start-duel': handleStartDuel,
  'submit-result': handleSubmitResult,
  'confirm-result': handleConfirmResult,
  'reject-result': handleRejectResult,
};

export function registerInteractionEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const handler = commandHandlers[interaction.commandName];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isButton()) {
        // Pagination buttons: rank-page-{page}
        if (interaction.customId.startsWith('rank-page-')) {
          await handleRankPagination(interaction);
          return;
        }

        // Duel buttons: {action}:{duelId}
        const [action] = interaction.customId.split(':');
        const handler = buttonHandlers[action];
        if (handler) await handler(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('submit-score:')) {
          await handleSubmitScoreModal(interaction);
        }
        return;
      }
    } catch (error) {
      console.error('Erro ao processar interação:', error);
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

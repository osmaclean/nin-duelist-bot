import { createDuelButtonHandler } from './handler';
import { startDuel } from '../services/duel.service';
import { notifyDuelStarted } from '../lib/notifications';

export const handleStartDuel = createDuelButtonHandler({
  expectedStatus: 'ACCEPTED',
  permissionCheck: (interaction, duel) => {
    const isParticipant =
      interaction.user.id === duel.challenger.discordId || interaction.user.id === duel.opponent.discordId;
    return isParticipant ? null : 'Apenas os duelistas podem iniciar o duelo.';
  },
  execute: async (duelId, interaction) => {
    const updated = await startDuel(duelId);
    if (updated) {
      notifyDuelStarted(interaction.client, updated).catch(() => {});
    }
    return updated;
  },
  errorMessage: 'Este duelo não pode ser iniciado.',
});

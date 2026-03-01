import { createDuelButtonHandler } from './handler';
import { acceptOpponent } from '../services/duel.service';
import { notifyDuelAccepted } from '../lib/notifications';

export const handleAcceptDuel = createDuelButtonHandler({
  expectedStatus: 'PROPOSED',
  permissionCheck: (interaction, duel) =>
    interaction.user.id !== duel.opponent.discordId
      ? 'Apenas o oponente pode aceitar o duelo.'
      : null,
  execute: async (duelId, interaction) => {
    const updated = await acceptOpponent(duelId);
    if (updated?.status === 'ACCEPTED') {
      notifyDuelAccepted(interaction.client, updated).catch(() => {});
    }
    return updated;
  },
  errorMessage: 'Este duelo não está mais disponível.',
});

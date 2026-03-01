import { createDuelButtonHandler } from './handler';
import { acceptWitness } from '../services/duel.service';
import { notifyDuelAccepted } from '../lib/notifications';

export const handleAcceptWitness = createDuelButtonHandler({
  expectedStatus: 'PROPOSED',
  permissionCheck: (interaction, duel) =>
    !duel.witness || interaction.user.id !== duel.witness.discordId
      ? 'Apenas a testemunha designada pode aceitar.'
      : null,
  execute: async (duelId, interaction) => {
    const updated = await acceptWitness(duelId);
    if (updated?.status === 'ACCEPTED') {
      notifyDuelAccepted(interaction.client, updated).catch(() => {});
    }
    return updated;
  },
  errorMessage: 'Este duelo não está mais disponível.',
});

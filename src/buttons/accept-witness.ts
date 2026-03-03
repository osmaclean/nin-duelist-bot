import { createDuelButtonHandler } from './handler';
import { getDuelById } from '../services/duel.service';

/**
 * Legacy handler — kept for backwards compatibility with old embeds that
 * still have the "Aceitar (Testemunha)" button. Will always return the
 * current duel state without modifying it.
 */
export const handleAcceptWitness = createDuelButtonHandler({
  expectedStatus: 'PROPOSED',
  permissionCheck: (interaction, duel) =>
    !duel.witness || interaction.user.id !== duel.witness.discordId
      ? 'Apenas a testemunha designada pode aceitar.'
      : null,
  execute: async (duelId) => getDuelById(duelId),
  errorMessage: 'Este duelo não está mais disponível.',
});

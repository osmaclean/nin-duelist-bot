import { createDuelButtonHandler } from './handler';
import { acceptWitness } from '../services/duel.service';

export const handleAcceptWitness = createDuelButtonHandler({
  expectedStatus: 'PROPOSED',
  permissionCheck: (interaction, duel) =>
    !duel.witness || interaction.user.id !== duel.witness.discordId
      ? 'Apenas a testemunha designada pode aceitar.'
      : null,
  execute: (duelId) => acceptWitness(duelId),
  errorMessage: 'Este duelo não está mais disponível.',
});

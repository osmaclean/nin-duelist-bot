import { createDuelButtonHandler } from './handler';
import { acceptOpponent } from '../services/duel.service';

export const handleAcceptDuel = createDuelButtonHandler({
  expectedStatus: 'PROPOSED',
  permissionCheck: (interaction, duel) =>
    interaction.user.id !== duel.opponent.discordId
      ? 'Apenas o oponente pode aceitar o duelo.'
      : null,
  execute: (duelId) => acceptOpponent(duelId),
  errorMessage: 'Este duelo não está mais disponível.',
});

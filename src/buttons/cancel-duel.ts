import { createDuelButtonHandler } from './handler';
import { cancelDuel } from '../services/duel.service';

export const handleCancelDuel = createDuelButtonHandler({
  expectedStatus: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'],
  permissionCheck: (interaction, duel) => {
    const participantIds = [duel.challenger.discordId, duel.opponent.discordId, duel.witness.discordId];
    return participantIds.includes(interaction.user.id)
      ? null
      : 'Apenas os participantes do duelo podem cancelá-lo.';
  },
  execute: (duelId) => cancelDuel(duelId),
  errorMessage: 'Este duelo não pode mais ser cancelado.',
});

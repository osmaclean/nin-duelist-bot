import { createDuelButtonHandler } from './handler';
import { cancelDuel } from '../services/duel.service';

export const handleCancelDuel = createDuelButtonHandler({
  expectedStatus: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_VALIDATION'],
  permissionCheck: (interaction, duel) => {
    const userId = interaction.user.id;
    const isDuelist = userId === duel.challenger.discordId || userId === duel.opponent.discordId;
    const isWitness = userId === duel.witness.discordId;

    // PROPOSED/ACCEPTED: duelists can cancel
    if (duel.status === 'PROPOSED' || duel.status === 'ACCEPTED') {
      return isDuelist ? null : 'Apenas os duelistas podem cancelar nesta fase.';
    }

    // IN_PROGRESS/AWAITING_VALIDATION: only witness can cancel
    if (duel.status === 'IN_PROGRESS') {
      return isWitness ? null : 'Apenas a testemunha pode cancelar duelos em andamento.';
    }
    return isWitness ? null : 'Apenas a testemunha pode cancelar duelos em validação.';
  },
  execute: (duelId) => cancelDuel(duelId),
  errorMessage: 'Este duelo não pode mais ser cancelado.',
});

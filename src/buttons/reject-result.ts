import { createDuelButtonHandler } from './handler';
import { rejectResult } from '../services/duel.service';

export const handleRejectResult = createDuelButtonHandler({
  expectedStatus: 'AWAITING_VALIDATION',
  permissionCheck: (interaction, duel) =>
    !duel.witness || interaction.user.id !== duel.witness.discordId
      ? 'Apenas a testemunha pode rejeitar o resultado.'
      : null,
  execute: (duelId) => rejectResult(duelId),
  errorMessage: 'Este duelo não está aguardando validação.',
});

import { createDuelButtonHandler } from './handler';
import { startDuel } from '../services/duel.service';

export const handleStartDuel = createDuelButtonHandler({
  expectedStatus: 'ACCEPTED',
  permissionCheck: (interaction, duel) => {
    const isParticipant =
      interaction.user.id === duel.challenger.discordId || interaction.user.id === duel.opponent.discordId;
    return isParticipant ? null : 'Apenas os duelistas podem iniciar o duelo.';
  },
  execute: (duelId) => startDuel(duelId),
  errorMessage: 'Este duelo não pode ser iniciado.',
});

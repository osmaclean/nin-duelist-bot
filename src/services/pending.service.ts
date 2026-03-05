import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE, DuelWithPlayers } from './duel.service';
import { DUEL_EXPIRY_MS } from '../config';

export type PendingDuel = DuelWithPlayers & { urgency: number };

/**
 * Retorna duelos que dependem de ação do jogador, ordenados por urgência:
 * 1. Perto de expirar (PROPOSED, < 10 min restantes)
 * 2. Aguardando validação (testemunha)
 * 3. Aguardando aceitação (oponente/testemunha)
 * 4. Prontos para iniciar (ACCEPTED)
 * 5. Em andamento (IN_PROGRESS)
 */
export async function getPendingDuels(discordId: string, seasonId: number): Promise<PendingDuel[]> {
  const player = await prisma.player.findUnique({ where: { discordId } });
  if (!player) return [];

  const duels = await prisma.duel.findMany({
    where: {
      seasonId,
      status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_VALIDATION'] },
      OR: [{ challengerId: player.id }, { opponentId: player.id }, { witnessId: player.id }],
    },
    include: DUEL_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  const expiryWarningMs = DUEL_EXPIRY_MS - 10 * 60 * 1000; // 10 min before expiry

  return duels
    .map((duel) => {
      let urgency: number;
      const age = now - duel.createdAt.getTime();

      if (duel.status === 'PROPOSED' && age >= expiryWarningMs) {
        urgency = 0; // most urgent: about to expire
      } else if (duel.status === 'AWAITING_VALIDATION' && duel.witnessId === player.id) {
        urgency = 1;
      } else if (
        duel.status === 'PROPOSED' &&
        ((duel.opponentId === player.id && !duel.opponentAccepted) ||
          (duel.witnessId === player.id && !duel.witnessAccepted))
      ) {
        urgency = 2;
      } else if (duel.status === 'ACCEPTED') {
        urgency = 3;
      } else {
        urgency = 4;
      }

      return { ...duel, urgency };
    })
    .sort((a, b) => a.urgency - b.urgency);
}

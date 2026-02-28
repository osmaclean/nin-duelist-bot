import { prisma } from '../lib/prisma';

/**
 * Anti-farm: máximo 1 duelo confirmado por par por dia civil (UTC).
 * Retorna true se o duelo é permitido.
 */
export async function canDuelToday(playerAId: number, playerBId: number): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const count = await prisma.duel.count({
    where: {
      status: 'CONFIRMED',
      updatedAt: { gte: todayStart, lt: todayEnd },
      OR: [
        { challengerId: playerAId, opponentId: playerBId },
        { challengerId: playerBId, opponentId: playerAId },
      ],
    },
  });

  return count === 0;
}

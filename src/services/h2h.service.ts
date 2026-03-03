import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE, DuelWithPlayers } from './duel.service';

export type H2hResult = {
  totalDuels: number;
  winsA: number;
  winsB: number;
  winRateA: number;
  winRateB: number;
  recentDuels: DuelWithPlayers[];
};

export async function getHeadToHead(
  discordIdA: string,
  discordIdB: string,
  seasonId: number,
): Promise<H2hResult> {
  const [playerA, playerB] = await Promise.all([
    prisma.player.findUnique({ where: { discordId: discordIdA } }),
    prisma.player.findUnique({ where: { discordId: discordIdB } }),
  ]);

  const empty: H2hResult = { totalDuels: 0, winsA: 0, winsB: 0, winRateA: 0, winRateB: 0, recentDuels: [] };

  if (!playerA || !playerB) return empty;

  const duels = await prisma.duel.findMany({
    where: {
      seasonId,
      status: 'CONFIRMED',
      OR: [
        { challengerId: playerA.id, opponentId: playerB.id },
        { challengerId: playerB.id, opponentId: playerA.id },
      ],
    },
    include: DUEL_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const totalDuels = duels.length;
  if (totalDuels === 0) return empty;

  let winsA = 0;
  let winsB = 0;
  for (const duel of duels) {
    if (duel.winnerId === playerA.id) winsA++;
    else if (duel.winnerId === playerB.id) winsB++;
  }

  return {
    totalDuels,
    winsA,
    winsB,
    winRateA: Math.round((winsA / totalDuels) * 100),
    winRateB: Math.round((winsB / totalDuels) * 100),
    recentDuels: duels,
  };
}

import { prisma } from '../lib/prisma';
import { RANK_PAGE_SIZE } from '../config';

export async function getLeaderboard(seasonId: number, page: number = 1) {
  const skip = (page - 1) * RANK_PAGE_SIZE;

  const [players, total] = await Promise.all([
    prisma.playerSeason.findMany({
      where: { seasonId },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
      include: { player: true },
      skip,
      take: RANK_PAGE_SIZE,
    }),
    prisma.playerSeason.count({ where: { seasonId } }),
  ]);

  return {
    players,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / RANK_PAGE_SIZE)),
  };
}

/**
 * Retorna a posição do jogador no ranking da season (1-indexed).
 * Retorna null se o jogador não tem PlayerSeason.
 */
export async function getPlayerRank(playerId: number, seasonId: number): Promise<number | null> {
  const ps = await prisma.playerSeason.findUnique({
    where: { playerId_seasonId: { playerId, seasonId } },
  });
  if (!ps) return null;

  // Conta quantos jogadores estão à frente (mais pontos, ou mesmos pontos com mais wins, etc.)
  const ahead = await prisma.playerSeason.count({
    where: {
      seasonId,
      OR: [
        { points: { gt: ps.points } },
        { points: ps.points, wins: { gt: ps.wins } },
        { points: ps.points, wins: ps.wins, peakStreak: { gt: ps.peakStreak } },
      ],
    },
  });

  return ahead + 1;
}

export async function getTopPlayers(seasonId: number, limit: number = 5) {
  return prisma.playerSeason.findMany({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
    include: { player: true },
    take: limit,
  });
}

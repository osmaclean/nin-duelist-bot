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

export async function getTopPlayers(seasonId: number, limit: number = 5) {
  return prisma.playerSeason.findMany({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
    include: { player: true },
    take: limit,
  });
}

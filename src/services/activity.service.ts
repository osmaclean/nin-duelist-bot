import { prisma } from '../lib/prisma';

export type ActivityEntry = {
  discordId: string;
  totalDuels: number;
  wins: number;
  losses: number;
};

export async function getMostActive(seasonId: number, limit: number = 10): Promise<ActivityEntry[]> {
  const players = await prisma.playerSeason.findMany({
    where: { seasonId },
    include: { player: true },
    orderBy: [{ wins: 'desc' }, { losses: 'desc' }],
    take: limit,
  });

  return players
    .map((ps) => ({
      discordId: ps.player.discordId,
      totalDuels: ps.wins + ps.losses,
      wins: ps.wins,
      losses: ps.losses,
    }))
    .filter((e) => e.totalDuels > 0)
    .sort((a, b) => b.totalDuels - a.totalDuels);
}

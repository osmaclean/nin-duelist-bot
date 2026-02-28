import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE, DuelWithPlayers } from './duel.service';

export type PlayerStats = {
  points: number;
  wins: number;
  losses: number;
  streak: number;
  peakStreak: number;
  winRate: number;
};

export type HistoryResult = {
  stats: PlayerStats | null;
  recentDuels: DuelWithPlayers[];
};

export async function getPlayerHistory(discordId: string, seasonId: number): Promise<HistoryResult> {
  const player = await prisma.player.findUnique({ where: { discordId } });
  if (!player) {
    return { stats: null, recentDuels: [] };
  }

  const [playerSeason, recentDuels] = await Promise.all([
    prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId: player.id, seasonId } },
    }),
    prisma.duel.findMany({
      where: {
        seasonId,
        status: 'CONFIRMED',
        OR: [{ challengerId: player.id }, { opponentId: player.id }],
      },
      include: DUEL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  if (!playerSeason) {
    return { stats: null, recentDuels: [] };
  }

  const total = playerSeason.wins + playerSeason.losses;
  const winRate = total > 0 ? Math.round((playerSeason.wins / total) * 100) : 0;

  return {
    stats: {
      points: playerSeason.points,
      wins: playerSeason.wins,
      losses: playerSeason.losses,
      streak: playerSeason.streak,
      peakStreak: playerSeason.peakStreak,
      winRate,
    },
    recentDuels,
  };
}

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE, DuelWithPlayers } from './duel.service';
import { HISTORY_PAGE_SIZE } from '../config';

export type PlayerStats = {
  points: number;
  wins: number;
  losses: number;
  streak: number;
  peakStreak: number;
  winRate: number;
};

export type HistoryFilters = {
  vsDiscordId?: string;
  from?: Date;
  to?: Date;
};

export type HistoryResult = {
  stats: PlayerStats | null;
  recentDuels: DuelWithPlayers[];
  total: number;
  page: number;
  totalPages: number;
};

export async function getPlayerHistory(
  discordId: string,
  seasonId: number,
  page: number = 1,
  filters: HistoryFilters = {},
): Promise<HistoryResult> {
  const player = await prisma.player.findUnique({ where: { discordId } });
  if (!player) {
    return { stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 };
  }

  // Build duel filter conditions
  const vsPlayer = filters.vsDiscordId
    ? await prisma.player.findUnique({ where: { discordId: filters.vsDiscordId } })
    : null;

  const duelWhere: Prisma.DuelWhereInput = {
    seasonId,
    status: 'CONFIRMED' as const,
    OR: [{ challengerId: player.id }, { opponentId: player.id }],
  };

  if (vsPlayer) {
    duelWhere.OR = [
      { challengerId: player.id, opponentId: vsPlayer.id },
      { challengerId: vsPlayer.id, opponentId: player.id },
    ];
  }

  if (filters.from || filters.to) {
    duelWhere.updatedAt = {};
    if (filters.from) duelWhere.updatedAt.gte = filters.from;
    if (filters.to) duelWhere.updatedAt.lte = filters.to;
  }

  const skip = (page - 1) * HISTORY_PAGE_SIZE;

  const [playerSeason, recentDuels, total] = await Promise.all([
    prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId: player.id, seasonId } },
    }),
    prisma.duel.findMany({
      where: duelWhere,
      include: DUEL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: HISTORY_PAGE_SIZE,
    }),
    prisma.duel.count({ where: duelWhere }),
  ]);

  if (!playerSeason) {
    return { stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 };
  }

  const totalGames = playerSeason.wins + playerSeason.losses;
  const winRate = totalGames > 0 ? Math.round((playerSeason.wins / totalGames) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

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
    total,
    page,
    totalPages,
  };
}

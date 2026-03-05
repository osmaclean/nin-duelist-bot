import { DuelStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { SEASON_DURATION_DAYS } from '../config';
import { logger } from '../lib/logger';

const TERMINAL_STATUSES: DuelStatus[] = ['CONFIRMED', 'CANCELLED', 'EXPIRED'];

export type SeasonWithStats = {
  id: number;
  number: number;
  name: string | null;
  startDate: Date;
  endDate: Date;
  active: boolean;
  championId: number | null;
  totalDuels: number;
  activePlayers: number;
};

export type PodiumEntry = {
  rank: number;
  playerId: number;
  discordId: string;
  points: number;
  wins: number;
  losses: number;
  peakStreak: number;
};

export async function getActiveSeason() {
  return prisma.season.findFirst({ where: { active: true } });
}

export async function ensureActiveSeason() {
  const existing = await getActiveSeason();
  if (existing) {
    logger.info('Season ativa encontrada', { seasonNumber: existing.number, endDate: existing.endDate.toISOString() });
    return existing;
  }

  const lastSeason = await prisma.season.findFirst({ orderBy: { number: 'desc' } });
  const nextNumber = lastSeason ? lastSeason.number + 1 : 1;

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + SEASON_DURATION_DAYS);

  const season = await prisma.season.create({
    data: { number: nextNumber, startDate: now, endDate, active: true },
  });

  logger.info('Season criada', { seasonNumber: season.number, endDate: season.endDate.toISOString() });
  return season;
}

export async function closeSeason(seasonId: number) {
  // Cancel all active (non-terminal) duels before closing
  const cancelled = await prisma.duel.updateMany({
    where: {
      seasonId,
      status: { notIn: TERMINAL_STATUSES },
    },
    data: { status: 'CANCELLED' },
  });

  if (cancelled.count > 0) {
    logger.info('Duelos ativos cancelados no fechamento de season', { seasonId, count: cancelled.count });
  }

  // Find champion (most points)
  const topPlayer = await prisma.playerSeason.findFirst({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
  });

  await prisma.season.update({
    where: { id: seasonId },
    data: { active: false, championId: topPlayer?.playerId ?? null },
  });

  logger.info('Season encerrada', { seasonId, championId: topPlayer?.playerId ?? null });
}

export async function getSeasonStatus(seasonId: number): Promise<SeasonWithStats | null> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return null;

  const [totalDuels, activePlayers] = await Promise.all([
    prisma.duel.count({ where: { seasonId } }),
    prisma.playerSeason.count({ where: { seasonId } }),
  ]);

  return { ...season, totalDuels, activePlayers };
}

export async function getSeasonPodium(seasonId: number): Promise<PodiumEntry[]> {
  const top3 = await prisma.playerSeason.findMany({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
    include: { player: true },
    take: 3,
  });

  return top3.map((ps, i) => ({
    rank: i + 1,
    playerId: ps.playerId,
    discordId: ps.player.discordId,
    points: ps.points,
    wins: ps.wins,
    losses: ps.losses,
    peakStreak: ps.peakStreak,
  }));
}

export async function adminEndSeason(seasonId: number) {
  // Cancel all active duels
  const cancelled = await prisma.duel.updateMany({
    where: {
      seasonId,
      status: { notIn: TERMINAL_STATUSES },
    },
    data: { status: 'CANCELLED' },
  });

  if (cancelled.count > 0) {
    logger.info('Duelos ativos cancelados no fechamento admin de season', { seasonId, count: cancelled.count });
  }

  // Find champion
  const topPlayer = await prisma.playerSeason.findFirst({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
  });

  await prisma.season.update({
    where: { id: seasonId },
    data: { active: false, championId: topPlayer?.playerId ?? null },
  });

  logger.info('Season encerrada por admin', { seasonId, championId: topPlayer?.playerId ?? null });
}

export async function adminCreateSeason(name: string | null, durationDays: number) {
  const lastSeason = await prisma.season.findFirst({ orderBy: { number: 'desc' } });
  const nextNumber = lastSeason ? lastSeason.number + 1 : 1;

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + durationDays);

  const season = await prisma.season.create({
    data: { number: nextNumber, name, startDate: now, endDate, active: true },
  });

  logger.info('Season criada por admin', { seasonNumber: season.number, name, durationDays });
  return season;
}

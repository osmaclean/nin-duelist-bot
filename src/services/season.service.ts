import { prisma } from '../lib/prisma';
import { SEASON_DURATION_DAYS } from '../config';

export async function getActiveSeason() {
  return prisma.season.findFirst({ where: { active: true } });
}

export async function ensureActiveSeason() {
  const existing = await getActiveSeason();
  if (existing) {
    console.log(`Season ${existing.number} ativa (até ${existing.endDate.toISOString()})`);
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

  console.log(`Season ${season.number} criada (até ${season.endDate.toISOString()})`);
  return season;
}

export async function closeSeason(seasonId: number) {
  // Find champion (most points)
  const topPlayer = await prisma.playerSeason.findFirst({
    where: { seasonId },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
  });

  await prisma.season.update({
    where: { id: seasonId },
    data: { active: false, championId: topPlayer?.playerId ?? null },
  });

  console.log(`Season ${seasonId} encerrada.`);
}

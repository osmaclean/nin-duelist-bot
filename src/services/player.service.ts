import { prisma } from '../lib/prisma';
import { POINTS_WIN, POINTS_LOSS } from '../config';

export async function getOrCreatePlayer(discordId: string, username: string) {
  return prisma.player.upsert({
    where: { discordId },
    update: { username },
    create: { discordId, username },
  });
}

export async function ensurePlayerSeason(playerId: number, seasonId: number) {
  return prisma.playerSeason.upsert({
    where: { playerId_seasonId: { playerId, seasonId } },
    update: {},
    create: { playerId, seasonId },
  });
}

export async function applyResult(winnerId: number, loserId: number, seasonId: number) {
  await ensurePlayerSeason(winnerId, seasonId);
  await ensurePlayerSeason(loserId, seasonId);

  // Update winner
  const winnerSeason = await prisma.playerSeason.update({
    where: { playerId_seasonId: { playerId: winnerId, seasonId } },
    data: {
      points: { increment: POINTS_WIN },
      wins: { increment: 1 },
      streak: { increment: 1 },
    },
  });

  // Update peak streak if needed
  if (winnerSeason.streak > winnerSeason.peakStreak) {
    await prisma.playerSeason.update({
      where: { playerId_seasonId: { playerId: winnerId, seasonId } },
      data: { peakStreak: winnerSeason.streak },
    });
  }

  // Update loser: reset streak
  await prisma.playerSeason.update({
    where: { playerId_seasonId: { playerId: loserId, seasonId } },
    data: {
      points: { increment: POINTS_LOSS },
      losses: { increment: 1 },
      streak: 0,
    },
  });
}

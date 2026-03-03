import { Prisma } from '@prisma/client';
import { prisma, TxClient } from '../lib/prisma';
import { POINTS_WIN, POINTS_LOSS } from '../config';

export async function getOrCreatePlayer(discordId: string, username: string) {
  return prisma.player.upsert({
    where: { discordId },
    update: { username },
    create: { discordId, username },
  });
}

export async function ensurePlayerSeason(playerId: number, seasonId: number, tx: TxClient = prisma) {
  return tx.playerSeason.upsert({
    where: { playerId_seasonId: { playerId, seasonId } },
    update: {},
    create: { playerId, seasonId },
  });
}

/** Reverse the stats applied by a previous confirmResult (for admin fix-result) */
export async function reverseResult(winnerId: number, loserId: number, seasonId: number, tx: TxClient = prisma) {
  await Promise.all([
    tx.$executeRaw(Prisma.sql`
      UPDATE "PlayerSeason"
      SET "points" = "points" - ${POINTS_WIN},
          "wins" = GREATEST("wins" - 1, 0)
      WHERE "playerId" = ${winnerId} AND "seasonId" = ${seasonId}
    `),
    tx.$executeRaw(Prisma.sql`
      UPDATE "PlayerSeason"
      SET "points" = "points" - ${POINTS_LOSS},
          "losses" = GREATEST("losses" - 1, 0)
      WHERE "playerId" = ${loserId} AND "seasonId" = ${seasonId}
    `),
  ]);
}

export async function applyResult(winnerId: number, loserId: number, seasonId: number, tx: TxClient = prisma) {
  await Promise.all([
    ensurePlayerSeason(winnerId, seasonId, tx),
    ensurePlayerSeason(loserId, seasonId, tx),
  ]);

  await Promise.all([
    // Update winner: points, wins, streak, and peakStreak in one query
    tx.$executeRaw(Prisma.sql`
      UPDATE "PlayerSeason"
      SET "points" = "points" + ${POINTS_WIN},
          "wins" = "wins" + 1,
          "streak" = "streak" + 1,
          "peakStreak" = GREATEST("peakStreak", "streak" + 1)
      WHERE "playerId" = ${winnerId} AND "seasonId" = ${seasonId}
    `),

    // Update loser: points, losses, reset streak
    tx.$executeRaw(Prisma.sql`
      UPDATE "PlayerSeason"
      SET "points" = "points" + ${POINTS_LOSS},
          "losses" = "losses" + 1,
          "streak" = 0
      WHERE "playerId" = ${loserId} AND "seasonId" = ${seasonId}
    `),
  ]);
}

import { DuelStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE, DuelWithPlayers } from './duel.service';

const SEARCH_LIMIT = 15;

export async function searchDuelsByPlayer(discordId: string): Promise<DuelWithPlayers[]> {
  const player = await prisma.player.findUnique({ where: { discordId } });
  if (!player) return [];

  return prisma.duel.findMany({
    where: {
      OR: [{ challengerId: player.id }, { opponentId: player.id }, { witnessId: player.id }],
    },
    include: DUEL_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: SEARCH_LIMIT,
  });
}

export async function searchDuelsByStatus(status: DuelStatus): Promise<DuelWithPlayers[]> {
  return prisma.duel.findMany({
    where: { status },
    include: DUEL_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: SEARCH_LIMIT,
  });
}

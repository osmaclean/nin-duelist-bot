import { DuelStatus, DuelFormat, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../lib/prisma';
import { applyResult } from './player.service';

export const DUEL_INCLUDE = {
  challenger: true,
  opponent: true,
  witness: true,
  winner: true,
} as const;

export type DuelWithPlayers = Prisma.DuelGetPayload<{ include: typeof DUEL_INCLUDE }>;

export async function createDuel(params: {
  challengerId: number;
  opponentId: number;
  witnessId: number;
  seasonId: number;
  format: DuelFormat;
  channelId: string;
}) {
  return prisma.duel.create({
    data: {
      challengerId: params.challengerId,
      opponentId: params.opponentId,
      witnessId: params.witnessId,
      seasonId: params.seasonId,
      format: params.format,
      channelId: params.channelId,
    },
    include: DUEL_INCLUDE,
  });
}

export async function getDuelById(id: number) {
  return prisma.duel.findUnique({
    where: { id },
    include: DUEL_INCLUDE,
  });
}

/** Transition helper with optimistic locking on status */
async function transitionDuel(
  id: number,
  expectedStatus: DuelStatus | DuelStatus[],
  data: Record<string, unknown>,
  tx: TxClient = prisma,
) {
  const statusFilter = Array.isArray(expectedStatus) ? { in: expectedStatus } : expectedStatus;

  const result = await tx.duel.updateMany({
    where: { id, status: statusFilter },
    data,
  });

  if (result.count === 0) {
    return null; // Status already changed — race condition guard
  }

  return tx.duel.findUnique({ where: { id }, include: DUEL_INCLUDE });
}

export async function setMessageId(duelId: number, messageId: string) {
  await prisma.duel.update({ where: { id: duelId }, data: { messageId } });
}

export async function acceptOpponent(duelId: number) {
  // Mark opponent accepted
  await prisma.duel.updateMany({
    where: { id: duelId, status: 'PROPOSED', opponentAccepted: false },
    data: { opponentAccepted: true },
  });

  return tryMoveToAccepted(duelId);
}

export async function acceptWitness(duelId: number) {
  await prisma.duel.updateMany({
    where: { id: duelId, status: 'PROPOSED', witnessAccepted: false },
    data: { witnessAccepted: true },
  });

  return tryMoveToAccepted(duelId);
}

/** Move to ACCEPTED if all parties have accepted */
async function tryMoveToAccepted(duelId: number) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  if (!duel || duel.status !== 'PROPOSED') return getDuelById(duelId);

  const opponentOk = duel.opponentAccepted;
  const witnessOk = duel.witnessAccepted;

  if (opponentOk && witnessOk) {
    return transitionDuel(duelId, 'PROPOSED', { status: 'ACCEPTED' });
  }

  return getDuelById(duelId);
}

export async function startDuel(duelId: number) {
  return transitionDuel(duelId, 'ACCEPTED', { status: 'IN_PROGRESS' });
}

export async function submitResult(
  duelId: number,
  winnerId: number,
  scoreWinner: number,
  scoreLoser: number,
) {
  return transitionDuel(duelId, 'IN_PROGRESS', {
    status: 'AWAITING_VALIDATION',
    winnerId,
    scoreWinner,
    scoreLoser,
  });
}

export async function confirmResult(duelId: number, tx: TxClient = prisma) {
  return transitionDuel(duelId, 'AWAITING_VALIDATION', { status: 'CONFIRMED' }, tx);
}

export async function confirmAndApplyResult(duelId: number) {
  return prisma.$transaction(async (tx) => {
    const confirmed = await confirmResult(duelId, tx);
    if (!confirmed) return null;

    if (confirmed.winnerId) {
      const loserId =
        confirmed.winnerId === confirmed.challengerId ? confirmed.opponentId : confirmed.challengerId;
      await applyResult(confirmed.winnerId, loserId, confirmed.seasonId, tx);
    }

    return confirmed;
  });
}

export async function rejectResult(duelId: number) {
  return transitionDuel(duelId, 'AWAITING_VALIDATION', {
    status: 'IN_PROGRESS',
    winnerId: null,
    scoreWinner: null,
    scoreLoser: null,
  });
}

export async function expireDuel(duelId: number) {
  return transitionDuel(duelId, 'PROPOSED', { status: 'EXPIRED' });
}

export async function cancelDuel(duelId: number) {
  return transitionDuel(duelId, ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'], { status: 'CANCELLED' });
}

/** Check if player has an active (non-terminal) duel */
export async function hasActiveDuel(playerId: number) {
  const terminalStatuses: DuelStatus[] = ['CONFIRMED', 'CANCELLED', 'EXPIRED'];
  const count = await prisma.duel.count({
    where: {
      status: { notIn: terminalStatuses },
      OR: [{ challengerId: playerId }, { opponentId: playerId }],
    },
  });
  return count > 0;
}

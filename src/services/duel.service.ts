import { DuelStatus, DuelMode, DuelFormat } from '@prisma/client';
import { prisma } from '../lib/prisma';

const DUEL_INCLUDE = {
  challenger: true,
  opponent: true,
  witness: true,
  winner: true,
} as const;

export async function createDuel(params: {
  challengerId: number;
  opponentId: number;
  witnessId?: number;
  seasonId: number;
  mode: DuelMode;
  format: DuelFormat;
  channelId: string;
}) {
  return prisma.duel.create({
    data: {
      challengerId: params.challengerId,
      opponentId: params.opponentId,
      witnessId: params.witnessId,
      seasonId: params.seasonId,
      mode: params.mode,
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
) {
  const statusFilter = Array.isArray(expectedStatus) ? { in: expectedStatus } : expectedStatus;

  const result = await prisma.duel.updateMany({
    where: { id, status: statusFilter },
    data,
  });

  if (result.count === 0) {
    return null; // Status already changed — race condition guard
  }

  return prisma.duel.findUnique({ where: { id }, include: DUEL_INCLUDE });
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
  const witnessOk = duel.witnessId === null || duel.witnessAccepted;

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
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  if (!duel || duel.status !== 'IN_PROGRESS') return null;

  // Casual without witness → go straight to CONFIRMED
  const nextStatus =
    duel.mode === 'CASUAL' && duel.witnessId === null ? 'CONFIRMED' : 'AWAITING_VALIDATION';

  // For ranked, always go to AWAITING_VALIDATION
  const finalStatus = duel.mode === 'RANKED' ? 'AWAITING_VALIDATION' : nextStatus;

  return transitionDuel(duelId, 'IN_PROGRESS', {
    status: finalStatus,
    winnerId,
    scoreWinner,
    scoreLoser,
  });
}

export async function confirmResult(duelId: number) {
  return transitionDuel(duelId, 'AWAITING_VALIDATION', { status: 'CONFIRMED' });
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

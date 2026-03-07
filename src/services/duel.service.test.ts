import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { applyResult } from './player.service';
import {
  acceptOpponent,
  cancelDuel,
  confirmAndApplyResult,
  confirmResult,
  createDuel,
  expireDuel,
  getDuelById,
  hasActiveDuel,
  rejectResult,
  setMessageId,
  startDuel,
  submitResult,
} from './duel.service';

vi.mock('./player.service', () => ({
  applyResult: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  },
}));

const duelId = 42;
const include = {
  challenger: true,
  opponent: true,
  witness: true,
  winner: true,
};

function mockDuel(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: duelId,
    status,
    challengerId: 1,
    opponentId: 2,
    witnessId: 3,
    seasonId: 10,
    opponentAccepted: false,
    ...extra,
  };
}

describe('duel.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createDuel should create ranked duel with includes', async () => {
    const created = mockDuel('PROPOSED');
    (prisma.duel.create as any).mockResolvedValue(created);

    const result = await createDuel({
      challengerId: 1,
      opponentId: 2,
      witnessId: 3,
      seasonId: 10,
      format: 'MD3',
      channelId: '123',
    });

    expect(prisma.duel.create).toHaveBeenCalledWith({
      data: {
        challengerId: 1,
        opponentId: 2,
        witnessId: 3,
        seasonId: 10,
        format: 'MD3',
        channelId: '123',
      },
      include,
    });
    expect(result).toEqual(created);
  });

  it('getDuelById should query with include', async () => {
    const duel = mockDuel('PROPOSED');
    (prisma.duel.findUnique as any).mockResolvedValue(duel);

    const result = await getDuelById(duelId);

    expect(prisma.duel.findUnique).toHaveBeenCalledWith({
      where: { id: duelId },
      include,
    });
    expect(result).toEqual(duel);
  });

  it('setMessageId should update duel messageId', async () => {
    (prisma.duel.update as any).mockResolvedValue({});

    await setMessageId(duelId, 'msg-1');

    expect(prisma.duel.update).toHaveBeenCalledWith({
      where: { id: duelId },
      data: { messageId: 'msg-1' },
    });
  });

  it('acceptOpponent should move directly to ACCEPTED', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('ACCEPTED', { opponentAccepted: true }));

    const result = await acceptOpponent(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'PROPOSED' },
      data: { status: 'ACCEPTED', opponentAccepted: true },
    });
    expect(result?.status).toBe('ACCEPTED');
  });

  it('acceptOpponent should return null when duel is not PROPOSED', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await acceptOpponent(duelId);

    expect(result).toBeNull();
  });

  it('startDuel should return null when transition precondition fails', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await startDuel(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'ACCEPTED' },
      data: { status: 'IN_PROGRESS' },
    });
    expect(result).toBeNull();
  });

  it('startDuel should transition to IN_PROGRESS when precondition passes', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('IN_PROGRESS'));

    const result = await startDuel(duelId);

    expect(result?.status).toBe('IN_PROGRESS');
  });

  it('submitResult should return null when duel is not IN_PROGRESS', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await submitResult(duelId, 1, 2, 1);

    expect(result).toBeNull();
  });

  it('submitResult should move duel to AWAITING_VALIDATION for IN_PROGRESS duel', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(
      mockDuel('AWAITING_VALIDATION', { winnerId: 1, scoreWinner: 2, scoreLoser: 1 }),
    );

    const result = await submitResult(duelId, 1, 2, 1);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'IN_PROGRESS' },
      data: {
        status: 'AWAITING_VALIDATION',
        winnerId: 1,
        scoreWinner: 2,
        scoreLoser: 1,
      },
    });
    expect(result?.status).toBe('AWAITING_VALIDATION');
  });

  it('confirmResult should return null when precondition fails', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await confirmResult(duelId);

    expect(result).toBeNull();
  });

  it('confirmResult should transition to CONFIRMED', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('CONFIRMED'));

    const result = await confirmResult(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'AWAITING_VALIDATION' },
      data: { status: 'CONFIRMED' },
    });
    expect(result?.status).toBe('CONFIRMED');
  });

  it('rejectResult should return null when precondition fails', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await rejectResult(duelId);

    expect(result).toBeNull();
  });

  it('rejectResult should clear winner and score and return IN_PROGRESS', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(
      mockDuel('IN_PROGRESS', { winnerId: null, scoreWinner: null, scoreLoser: null }),
    );

    const result = await rejectResult(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'AWAITING_VALIDATION' },
      data: { status: 'IN_PROGRESS', winnerId: null, scoreWinner: null, scoreLoser: null },
    });
    expect(result?.status).toBe('IN_PROGRESS');
  });

  it('expireDuel should return null when duel is not PROPOSED', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await expireDuel(duelId);

    expect(result).toBeNull();
  });

  it('expireDuel should only transition from PROPOSED', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('EXPIRED'));

    const result = await expireDuel(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: 'PROPOSED' },
      data: { status: 'EXPIRED' },
    });
    expect(result?.status).toBe('EXPIRED');
  });

  it('cancelDuel should return null when duel is terminal', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await cancelDuel(duelId);

    expect(result).toBeNull();
  });

  it('cancelDuel should transition from PROPOSED/ACCEPTED/IN_PROGRESS', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('CANCELLED'));

    const result = await cancelDuel(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: duelId, status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED' },
    });
    expect(result?.status).toBe('CANCELLED');
  });

  it('hasActiveDuel should return true when count > 0 and false when count = 0', async () => {
    (prisma.duel.count as any).mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    const first = await hasActiveDuel(99);
    const second = await hasActiveDuel(99);

    expect(prisma.duel.count).toHaveBeenNthCalledWith(1, {
      where: {
        status: { notIn: ['CONFIRMED', 'CANCELLED', 'EXPIRED'] },
        OR: [{ challengerId: 99 }, { opponentId: 99 }],
      },
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('confirmAndApplyResult should return null when confirmResult fails', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await confirmAndApplyResult(duelId);

    expect(result).toBeNull();
    expect(applyResult).not.toHaveBeenCalled();
  });

  it('confirmAndApplyResult should confirm and apply result with winner', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(
      mockDuel('CONFIRMED', { winnerId: 1, challengerId: 1, opponentId: 2, seasonId: 10 }),
    );

    const result = await confirmAndApplyResult(duelId);

    expect(result?.status).toBe('CONFIRMED');
    expect(applyResult).toHaveBeenCalledWith(1, 2, 10, expect.anything());
  });

  it('confirmAndApplyResult should confirm without applying when no winner', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(
      mockDuel('CONFIRMED', { winnerId: null, challengerId: 1, opponentId: 2, seasonId: 10 }),
    );

    const result = await confirmAndApplyResult(duelId);

    expect(result?.status).toBe('CONFIRMED');
    expect(applyResult).not.toHaveBeenCalled();
  });

  it('confirmAndApplyResult should compute loserId when winner is opponent', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any).mockResolvedValue(
      mockDuel('CONFIRMED', { winnerId: 2, challengerId: 1, opponentId: 2, seasonId: 10 }),
    );

    const result = await confirmAndApplyResult(duelId);

    expect(result?.status).toBe('CONFIRMED');
    expect(applyResult).toHaveBeenCalledWith(2, 1, 10, expect.anything());
  });
});

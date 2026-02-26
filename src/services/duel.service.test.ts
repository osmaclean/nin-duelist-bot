import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import {
  acceptOpponent,
  acceptWitness,
  cancelDuel,
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

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
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
    witnessAccepted: false,
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
        mode: 'RANKED',
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

  it('acceptOpponent should move to ACCEPTED when witness already accepted', async () => {
    (prisma.duel.updateMany as any)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    (prisma.duel.findUnique as any)
      .mockResolvedValueOnce(mockDuel('PROPOSED', { opponentAccepted: true, witnessAccepted: true }))
      .mockResolvedValueOnce(mockDuel('ACCEPTED', { opponentAccepted: true, witnessAccepted: true }));

    const result = await acceptOpponent(duelId);

    expect(prisma.duel.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: duelId, status: 'PROPOSED', opponentAccepted: false },
      data: { opponentAccepted: true },
    });
    expect(prisma.duel.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: duelId, status: 'PROPOSED' },
      data: { status: 'ACCEPTED' },
    });
    expect(result?.status).toBe('ACCEPTED');
  });

  it('acceptWitness should stay PROPOSED when opponent not accepted', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.duel.findUnique as any)
      .mockResolvedValueOnce(mockDuel('PROPOSED', { opponentAccepted: false, witnessAccepted: true }))
      .mockResolvedValueOnce(mockDuel('PROPOSED', { opponentAccepted: false, witnessAccepted: true }));

    const result = await acceptWitness(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe('PROPOSED');
  });

  it('acceptWitness should move to ACCEPTED when opponent already accepted', async () => {
    (prisma.duel.updateMany as any)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    (prisma.duel.findUnique as any)
      .mockResolvedValueOnce(mockDuel('PROPOSED', { opponentAccepted: true, witnessAccepted: true }))
      .mockResolvedValueOnce(mockDuel('ACCEPTED', { opponentAccepted: true, witnessAccepted: true }));

    const result = await acceptWitness(duelId);

    expect(prisma.duel.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: duelId, status: 'PROPOSED', witnessAccepted: false },
      data: { witnessAccepted: true },
    });
    expect(prisma.duel.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: duelId, status: 'PROPOSED' },
      data: { status: 'ACCEPTED' },
    });
    expect(result?.status).toBe('ACCEPTED');
  });

  it('acceptOpponent should return null when duel does not exist', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.duel.findUnique as any).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await acceptOpponent(duelId);

    expect(prisma.duel.findUnique).toHaveBeenNthCalledWith(1, { where: { id: duelId } });
    expect(prisma.duel.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: duelId },
      include,
    });
    expect(result).toBeNull();
  });

  it('acceptOpponent should return current duel when status is no longer PROPOSED', async () => {
    const accepted = mockDuel('ACCEPTED', { opponentAccepted: true, witnessAccepted: true });
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.duel.findUnique as any)
      .mockResolvedValueOnce(mockDuel('ACCEPTED'))
      .mockResolvedValueOnce(accepted);

    const result = await acceptOpponent(duelId);

    expect(prisma.duel.updateMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual(accepted);
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

  it('submitResult should return null when duel does not exist', async () => {
    (prisma.duel.findUnique as any).mockResolvedValue(null);

    const result = await submitResult(duelId, 1, 2, 1);

    expect(result).toBeNull();
    expect(prisma.duel.updateMany).not.toHaveBeenCalled();
  });

  it('submitResult should return null when duel is not IN_PROGRESS', async () => {
    (prisma.duel.findUnique as any).mockResolvedValue(mockDuel('ACCEPTED'));

    const result = await submitResult(duelId, 1, 2, 1);

    expect(result).toBeNull();
    expect(prisma.duel.updateMany).not.toHaveBeenCalled();
  });

  it('submitResult should move duel to AWAITING_VALIDATION for IN_PROGRESS duel', async () => {
    (prisma.duel.findUnique as any)
      .mockResolvedValueOnce(mockDuel('IN_PROGRESS'))
      .mockResolvedValueOnce(mockDuel('AWAITING_VALIDATION', { winnerId: 1, scoreWinner: 2, scoreLoser: 1 }));
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });

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
});

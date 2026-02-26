import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { canDuelToday } from './antifarm.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      count: vi.fn(),
    },
  },
}));

describe('antifarm.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('canDuelToday should return true when there is no confirmed duel between pair today', async () => {
    (prisma.duel.count as any).mockResolvedValue(0);

    const result = await canDuelToday(1, 2);

    expect(result).toBe(true);
    expect(prisma.duel.count).toHaveBeenCalledTimes(1);
    const call = (prisma.duel.count as any).mock.calls[0][0];
    expect(call.where.status).toBe('CONFIRMED');
    expect(call.where.OR).toEqual([
      { challengerId: 1, opponentId: 2 },
      { challengerId: 2, opponentId: 1 },
    ]);
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    expect(call.where.createdAt.lt).toBeInstanceOf(Date);
  });

  it('canDuelToday should return false when already has confirmed duel between pair today', async () => {
    (prisma.duel.count as any).mockResolvedValue(1);

    const result = await canDuelToday(1, 2);

    expect(result).toBe(false);
  });

  it('canDuelToday should query exact UTC day boundaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T18:45:12.000Z'));
    (prisma.duel.count as any).mockResolvedValue(0);

    await canDuelToday(10, 20);

    const call = (prisma.duel.count as any).mock.calls[0][0];
    expect(call.where.createdAt.gte.toISOString()).toBe('2026-02-26T00:00:00.000Z');
    expect(call.where.createdAt.lt.toISOString()).toBe('2026-02-27T00:00:00.000Z');
  });
});

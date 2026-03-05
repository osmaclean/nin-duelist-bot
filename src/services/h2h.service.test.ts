import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getHeadToHead } from './h2h.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findUnique: vi.fn(),
    },
    duel: {
      findMany: vi.fn(),
    },
  },
}));

describe('h2h.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty when player A not found', async () => {
    (prisma.player.findUnique as any).mockResolvedValue(null);

    const result = await getHeadToHead('unknownA', 'unknownB', 1);

    expect(result.totalDuels).toBe(0);
    expect(prisma.duel.findMany).not.toHaveBeenCalled();
  });

  it('should return empty when player B not found', async () => {
    (prisma.player.findUnique as any).mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);

    const result = await getHeadToHead('a', 'b', 1);

    expect(result.totalDuels).toBe(0);
  });

  it('should return empty when no confirmed duels between players', async () => {
    (prisma.player.findUnique as any).mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    (prisma.duel.findMany as any).mockResolvedValue([]);

    const result = await getHeadToHead('a', 'b', 1);

    expect(result.totalDuels).toBe(0);
    expect(result.winsA).toBe(0);
    expect(result.winsB).toBe(0);
  });

  it('should calculate wins and winRate correctly', async () => {
    (prisma.player.findUnique as any).mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 20 });
    (prisma.duel.findMany as any).mockResolvedValue([{ winnerId: 10 }, { winnerId: 20 }, { winnerId: 10 }]);

    const result = await getHeadToHead('a', 'b', 5);

    expect(result.totalDuels).toBe(3);
    expect(result.winsA).toBe(2);
    expect(result.winsB).toBe(1);
    expect(result.winRateA).toBe(67);
    expect(result.winRateB).toBe(33);
    expect(result.recentDuels).toHaveLength(3);
  });

  it('should query with correct filters and ordering', async () => {
    (prisma.player.findUnique as any).mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    (prisma.duel.findMany as any).mockResolvedValue([]);

    await getHeadToHead('a', 'b', 3);

    expect(prisma.duel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: 3,
          status: 'CONFIRMED',
          OR: [
            { challengerId: 1, opponentId: 2 },
            { challengerId: 2, opponentId: 1 },
          ],
        }),
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    );
  });
});

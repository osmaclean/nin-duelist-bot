import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getPlayerHistory } from './history.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findUnique: vi.fn(),
    },
    playerSeason: {
      findUnique: vi.fn(),
    },
    duel: {
      findMany: vi.fn(),
    },
  },
}));

describe('history.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null stats when player not found', async () => {
    (prisma.player.findUnique as any).mockResolvedValue(null);

    const result = await getPlayerHistory('unknown', 1);

    expect(result).toEqual({ stats: null, recentDuels: [] });
    expect(prisma.playerSeason.findUnique).not.toHaveBeenCalled();
  });

  it('should return null stats when no PlayerSeason exists', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue(null);
    (prisma.duel.findMany as any).mockResolvedValue([]);

    const result = await getPlayerHistory('u1', 5);

    expect(result).toEqual({ stats: null, recentDuels: [] });
  });

  it('should return stats with correct winRate and recent duels', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 7,
      wins: 9,
      losses: 3,
      streak: 2,
      peakStreak: 5,
    });
    const duels = [{ id: 1 }, { id: 2 }];
    (prisma.duel.findMany as any).mockResolvedValue(duels);

    const result = await getPlayerHistory('u1', 5);

    expect(result.stats).toEqual({
      points: 7,
      wins: 9,
      losses: 3,
      streak: 2,
      peakStreak: 5,
      winRate: 75,
    });
    expect(result.recentDuels).toEqual(duels);
  });

  it('should return 0 winRate when no duels played', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      peakStreak: 0,
    });
    (prisma.duel.findMany as any).mockResolvedValue([]);

    const result = await getPlayerHistory('u1', 5);

    expect(result.stats!.winRate).toBe(0);
  });

  it('should query duels ordered by updatedAt desc with limit 10', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 3 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 1,
      wins: 1,
      losses: 0,
      streak: 1,
      peakStreak: 1,
    });
    (prisma.duel.findMany as any).mockResolvedValue([]);

    await getPlayerHistory('u3', 2);

    expect(prisma.duel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seasonId: 2, status: 'CONFIRMED' }),
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    );
  });
});

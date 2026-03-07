import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getPlayerHistory } from './history.service';

vi.mock('../config', () => ({
  HISTORY_PAGE_SIZE: 10,
  POINTS_WIN: 1,
  POINTS_LOSS: -1,
  DISCORD_TOKEN: 'test-token',
  DISCORD_CLIENT_ID: 'test-client-id',
}));

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
      count: vi.fn(),
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

    expect(result).toEqual({ stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 });
    expect(prisma.playerSeason.findUnique).not.toHaveBeenCalled();
  });

  it('should return null stats when no PlayerSeason exists', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue(null);
    (prisma.duel.findMany as any).mockResolvedValue([]);
    (prisma.duel.count as any).mockResolvedValue(0);

    const result = await getPlayerHistory('u1', 5);

    expect(result).toEqual({ stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 });
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
    (prisma.duel.count as any).mockResolvedValue(2);

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
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
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
    (prisma.duel.count as any).mockResolvedValue(0);

    const result = await getPlayerHistory('u1', 5);

    expect(result.stats!.winRate).toBe(0);
  });

  it('should query duels with pagination (skip/take)', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 3 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 1,
      wins: 1,
      losses: 0,
      streak: 1,
      peakStreak: 1,
    });
    (prisma.duel.findMany as any).mockResolvedValue([]);
    (prisma.duel.count as any).mockResolvedValue(25);

    const result = await getPlayerHistory('u3', 2, 3);

    expect(prisma.duel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
    );
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(3);
  });

  it('should filter by vs opponent when vsDiscordId provided', async () => {
    (prisma.player.findUnique as any)
      .mockResolvedValueOnce({ id: 1 }) // main player
      .mockResolvedValueOnce({ id: 2 }); // vs player
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 5,
      wins: 5,
      losses: 0,
      streak: 5,
      peakStreak: 5,
    });
    (prisma.duel.findMany as any).mockResolvedValue([]);
    (prisma.duel.count as any).mockResolvedValue(0);

    await getPlayerHistory('u1', 1, 1, { vsDiscordId: 'u2' });

    expect(prisma.duel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { challengerId: 1, opponentId: 2 },
            { challengerId: 2, opponentId: 1 },
          ],
        }),
      }),
    );
  });

  it('should filter by date range when from/to provided', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 3,
      wins: 3,
      losses: 0,
      streak: 3,
      peakStreak: 3,
    });
    (prisma.duel.findMany as any).mockResolvedValue([]);
    (prisma.duel.count as any).mockResolvedValue(0);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    await getPlayerHistory('u1', 1, 1, { from, to });

    expect(prisma.duel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

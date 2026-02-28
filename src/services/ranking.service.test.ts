import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getLeaderboard, getTopPlayers, getPlayerRank } from './ranking.service';
import { RANK_PAGE_SIZE } from '../config';

vi.mock('../lib/prisma', () => ({
  prisma: {
    playerSeason: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('ranking.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLeaderboard should return paginated players for requested page', async () => {
    const players = [{ playerId: 1 }, { playerId: 2 }];
    (prisma.playerSeason.findMany as any).mockResolvedValue(players);
    (prisma.playerSeason.count as any).mockResolvedValue(55);

    const result = await getLeaderboard(10, 2);

    expect(prisma.playerSeason.findMany).toHaveBeenCalledWith({
      where: { seasonId: 10 },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
      include: { player: true },
      skip: RANK_PAGE_SIZE,
      take: RANK_PAGE_SIZE,
    });
    expect(prisma.playerSeason.count).toHaveBeenCalledWith({ where: { seasonId: 10 } });
    expect(result).toEqual({
      players,
      total: 55,
      page: 2,
      totalPages: Math.ceil(55 / RANK_PAGE_SIZE),
    });
  });

  it('getLeaderboard should keep totalPages >= 1 when there are no players', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);
    (prisma.playerSeason.count as any).mockResolvedValue(0);

    const result = await getLeaderboard(20, 1);

    expect(result.total).toBe(0);
    expect(result.players).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it('getLeaderboard should reflect requested page even when page is 0', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);
    (prisma.playerSeason.count as any).mockResolvedValue(10);

    const result = await getLeaderboard(20, 0);

    expect(prisma.playerSeason.findMany).toHaveBeenCalledWith({
      where: { seasonId: 20 },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
      include: { player: true },
      skip: -RANK_PAGE_SIZE,
      take: RANK_PAGE_SIZE,
    });
    expect(result.page).toBe(0);
  });

  it('getTopPlayers should return top N ordered by points/wins/peakStreak', async () => {
    const top = [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }];
    (prisma.playerSeason.findMany as any).mockResolvedValue(top);

    const result = await getTopPlayers(30, 3);

    expect(prisma.playerSeason.findMany).toHaveBeenCalledWith({
      where: { seasonId: 30 },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
      include: { player: true },
      take: 3,
    });
    expect(result).toEqual(top);
  });

  it('getTopPlayers should use default limit (5) when not provided', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);

    await getTopPlayers(40);

    expect(prisma.playerSeason.findMany).toHaveBeenCalledWith({
      where: { seasonId: 40 },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { peakStreak: 'desc' }],
      include: { player: true },
      take: 5,
    });
  });

  it('getPlayerRank should return null when player has no PlayerSeason', async () => {
    (prisma.playerSeason.findUnique as any).mockResolvedValue(null);

    const rank = await getPlayerRank(99, 1);

    expect(rank).toBeNull();
  });

  it('getPlayerRank should return 1 when player is top ranked', async () => {
    (prisma.playerSeason.findUnique as any).mockResolvedValue({ points: 10, wins: 8, peakStreak: 5 });
    (prisma.playerSeason.count as any).mockResolvedValue(0); // nobody ahead

    const rank = await getPlayerRank(1, 5);

    expect(rank).toBe(1);
  });

  it('getPlayerRank should return correct position based on players ahead', async () => {
    (prisma.playerSeason.findUnique as any).mockResolvedValue({ points: 5, wins: 3, peakStreak: 2 });
    (prisma.playerSeason.count as any).mockResolvedValue(4); // 4 players ahead

    const rank = await getPlayerRank(10, 5);

    expect(rank).toBe(5);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getMostActive } from './activity.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    playerSeason: {
      findMany: vi.fn(),
    },
  },
}));

describe('activity.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty when no players', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);

    const result = await getMostActive(1);

    expect(result).toEqual([]);
  });

  it('should filter out players with 0 duels', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([{ player: { discordId: 'u1' }, wins: 0, losses: 0 }]);

    const result = await getMostActive(1);

    expect(result).toEqual([]);
  });

  it('should sort by total duels descending', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([
      { player: { discordId: 'u1' }, wins: 2, losses: 1 },
      { player: { discordId: 'u2' }, wins: 5, losses: 3 },
      { player: { discordId: 'u3' }, wins: 1, losses: 0 },
    ]);

    const result = await getMostActive(1);

    expect(result).toHaveLength(3);
    expect(result[0].discordId).toBe('u2');
    expect(result[0].totalDuels).toBe(8);
    expect(result[1].discordId).toBe('u1');
    expect(result[1].totalDuels).toBe(3);
    expect(result[2].discordId).toBe('u3');
    expect(result[2].totalDuels).toBe(1);
  });

  it('should query with correct seasonId and limit', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);

    await getMostActive(5, 3);

    expect(prisma.playerSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId: 5 },
        take: 3,
      }),
    );
  });
});

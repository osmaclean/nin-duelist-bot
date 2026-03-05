import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getPlayerProfile } from './profile.service';
import { getPlayerRank } from './ranking.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findUnique: vi.fn(),
    },
    playerSeason: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('./ranking.service', () => ({
  getPlayerRank: vi.fn(),
}));

describe('profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when player not found', async () => {
    (prisma.player.findUnique as any).mockResolvedValue(null);

    const result = await getPlayerProfile('unknown', 1);

    expect(result).toBeNull();
  });

  it('should return null when no PlayerSeason exists', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue(null);
    (prisma.playerSeason.count as any).mockResolvedValue(0);

    const result = await getPlayerProfile('u1', 5);

    expect(result).toBeNull();
  });

  it('should return full profile with rank and seasons played', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 7,
      wins: 9,
      losses: 3,
      streak: 2,
      peakStreak: 5,
    });
    (prisma.playerSeason.count as any).mockResolvedValue(3);
    (getPlayerRank as any).mockResolvedValue(2);

    const result = await getPlayerProfile('u1', 5);

    expect(result).toEqual({
      points: 7,
      wins: 9,
      losses: 3,
      winRate: 75,
      streak: 2,
      peakStreak: 5,
      rank: 2,
      seasonsPlayed: 3,
    });
    expect(getPlayerRank).toHaveBeenCalledWith(1, 5);
  });

  it('should return 0 winRate when no duels', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.playerSeason.findUnique as any).mockResolvedValue({
      points: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      peakStreak: 0,
    });
    (prisma.playerSeason.count as any).mockResolvedValue(1);
    (getPlayerRank as any).mockResolvedValue(1);

    const result = await getPlayerProfile('u1', 1);

    expect(result!.winRate).toBe(0);
  });
});

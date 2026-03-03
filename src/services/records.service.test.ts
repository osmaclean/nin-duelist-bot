import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getSeasonRecords } from './records.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    playerSeason: {
      findMany: vi.fn(),
    },
  },
}));

describe('records.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all nulls when no players', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([]);

    const result = await getSeasonRecords(1);

    expect(result.bestStreak).toBeNull();
    expect(result.bestWinRate).toBeNull();
    expect(result.mostDuels).toBeNull();
  });

  it('should find best streak', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([
      { player: { discordId: 'u1' }, wins: 3, losses: 1, peakStreak: 3 },
      { player: { discordId: 'u2' }, wins: 5, losses: 2, peakStreak: 5 },
    ]);

    const result = await getSeasonRecords(1);

    expect(result.bestStreak).toEqual({ discordId: 'u2', value: 5 });
  });

  it('should only consider win rate for players with 5+ games', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([
      { player: { discordId: 'u1' }, wins: 3, losses: 0, peakStreak: 3 }, // 100% but only 3 games
      { player: { discordId: 'u2' }, wins: 4, losses: 1, peakStreak: 2 }, // 80% with 5 games
    ]);

    const result = await getSeasonRecords(1);

    expect(result.bestWinRate?.discordId).toBe('u2');
    expect(result.bestWinRate?.value).toBe(80);
  });

  it('should find most duels played', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([
      { player: { discordId: 'u1' }, wins: 3, losses: 1, peakStreak: 2 },
      { player: { discordId: 'u2' }, wins: 5, losses: 5, peakStreak: 1 },
    ]);

    const result = await getSeasonRecords(1);

    expect(result.mostDuels?.discordId).toBe('u2');
    expect(result.mostDuels?.value).toBe(10);
    expect(result.mostDuels?.wins).toBe(5);
    expect(result.mostDuels?.losses).toBe(5);
  });

  it('should return null winRate when nobody has 5 games', async () => {
    (prisma.playerSeason.findMany as any).mockResolvedValue([
      { player: { discordId: 'u1' }, wins: 2, losses: 1, peakStreak: 2 },
    ]);

    const result = await getSeasonRecords(1);

    expect(result.bestWinRate).toBeNull();
    expect(result.bestStreak).not.toBeNull();
    expect(result.mostDuels).not.toBeNull();
  });
});

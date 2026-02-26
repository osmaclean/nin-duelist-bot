import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { ensurePlayerSeason, getOrCreatePlayer, applyResult } from './player.service';
import { POINTS_LOSS, POINTS_WIN } from '../config';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      upsert: vi.fn(),
    },
    playerSeason: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('player.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrCreatePlayer should upsert by discordId and update username', async () => {
    const payload = { id: 1, discordId: '123', username: 'ninja' };
    (prisma.player.upsert as any).mockResolvedValue(payload);

    const result = await getOrCreatePlayer('123', 'ninja');

    expect(prisma.player.upsert).toHaveBeenCalledWith({
      where: { discordId: '123' },
      update: { username: 'ninja' },
      create: { discordId: '123', username: 'ninja' },
    });
    expect(result).toEqual(payload);
  });

  it('ensurePlayerSeason should upsert composite key playerId_seasonId', async () => {
    const payload = { id: 11, playerId: 1, seasonId: 2 };
    (prisma.playerSeason.upsert as any).mockResolvedValue(payload);

    const result = await ensurePlayerSeason(1, 2);

    expect(prisma.playerSeason.upsert).toHaveBeenCalledWith({
      where: { playerId_seasonId: { playerId: 1, seasonId: 2 } },
      update: {},
      create: { playerId: 1, seasonId: 2 },
    });
    expect(result).toEqual(payload);
  });

  it('applyResult should update winner and loser and bump peak streak when needed', async () => {
    (prisma.playerSeason.upsert as any).mockResolvedValue({});
    (prisma.playerSeason.update as any)
      .mockResolvedValueOnce({
        playerId: 10,
        seasonId: 5,
        points: 12,
        wins: 6,
        losses: 1,
        streak: 4,
        peakStreak: 3,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await applyResult(10, 20, 5);

    expect(prisma.playerSeason.upsert).toHaveBeenNthCalledWith(1, {
      where: { playerId_seasonId: { playerId: 10, seasonId: 5 } },
      update: {},
      create: { playerId: 10, seasonId: 5 },
    });
    expect(prisma.playerSeason.upsert).toHaveBeenNthCalledWith(2, {
      where: { playerId_seasonId: { playerId: 20, seasonId: 5 } },
      update: {},
      create: { playerId: 20, seasonId: 5 },
    });

    expect(prisma.playerSeason.update).toHaveBeenNthCalledWith(1, {
      where: { playerId_seasonId: { playerId: 10, seasonId: 5 } },
      data: {
        points: { increment: POINTS_WIN },
        wins: { increment: 1 },
        streak: { increment: 1 },
      },
    });

    expect(prisma.playerSeason.update).toHaveBeenNthCalledWith(2, {
      where: { playerId_seasonId: { playerId: 10, seasonId: 5 } },
      data: { peakStreak: 4 },
    });

    expect(prisma.playerSeason.update).toHaveBeenNthCalledWith(3, {
      where: { playerId_seasonId: { playerId: 20, seasonId: 5 } },
      data: {
        points: { increment: POINTS_LOSS },
        losses: { increment: 1 },
        streak: 0,
      },
    });
  });

  it('applyResult should not update peak streak when current streak does not beat peak', async () => {
    (prisma.playerSeason.upsert as any).mockResolvedValue({});
    (prisma.playerSeason.update as any)
      .mockResolvedValueOnce({
        playerId: 10,
        seasonId: 5,
        points: 12,
        wins: 6,
        losses: 1,
        streak: 3,
        peakStreak: 3,
      })
      .mockResolvedValueOnce({});

    await applyResult(10, 20, 5);

    expect(prisma.playerSeason.update).toHaveBeenCalledTimes(2);
    expect(prisma.playerSeason.update).toHaveBeenNthCalledWith(1, {
      where: { playerId_seasonId: { playerId: 10, seasonId: 5 } },
      data: {
        points: { increment: POINTS_WIN },
        wins: { increment: 1 },
        streak: { increment: 1 },
      },
    });
    expect(prisma.playerSeason.update).toHaveBeenNthCalledWith(2, {
      where: { playerId_seasonId: { playerId: 20, seasonId: 5 } },
      data: {
        points: { increment: POINTS_LOSS },
        losses: { increment: 1 },
        streak: 0,
      },
    });
  });

  it('applyResult should propagate winner update error and stop loser update', async () => {
    (prisma.playerSeason.upsert as any).mockResolvedValue({});
    (prisma.playerSeason.update as any).mockRejectedValue(new Error('db fail on winner'));

    await expect(applyResult(10, 20, 5)).rejects.toThrow('db fail on winner');
    expect(prisma.playerSeason.update).toHaveBeenCalledTimes(1);
  });

  it('applyResult should propagate ensurePlayerSeason error', async () => {
    (prisma.playerSeason.upsert as any).mockRejectedValue(new Error('db fail on ensure'));

    await expect(applyResult(10, 20, 5)).rejects.toThrow('db fail on ensure');
    expect(prisma.playerSeason.update).not.toHaveBeenCalled();
  });
});

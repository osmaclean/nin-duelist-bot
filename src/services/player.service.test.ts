import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { ensurePlayerSeason, getOrCreatePlayer, applyResult } from './player.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      upsert: vi.fn(),
    },
    playerSeason: {
      upsert: vi.fn(),
    },
    $executeRaw: vi.fn(),
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

  it('applyResult should ensure both players and execute raw updates', async () => {
    (prisma.playerSeason.upsert as any).mockResolvedValue({});
    (prisma.$executeRaw as any).mockResolvedValue(1);

    await applyResult(10, 20, 5);

    // Both ensures called
    expect(prisma.playerSeason.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.playerSeason.upsert).toHaveBeenCalledWith({
      where: { playerId_seasonId: { playerId: 10, seasonId: 5 } },
      update: {},
      create: { playerId: 10, seasonId: 5 },
    });
    expect(prisma.playerSeason.upsert).toHaveBeenCalledWith({
      where: { playerId_seasonId: { playerId: 20, seasonId: 5 } },
      update: {},
      create: { playerId: 20, seasonId: 5 },
    });

    // Two raw queries: winner + loser
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('applyResult should propagate $executeRaw error', async () => {
    (prisma.playerSeason.upsert as any).mockResolvedValue({});
    (prisma.$executeRaw as any).mockRejectedValue(new Error('db fail'));

    await expect(applyResult(10, 20, 5)).rejects.toThrow('db fail');
  });

  it('applyResult should propagate ensurePlayerSeason error', async () => {
    (prisma.playerSeason.upsert as any).mockRejectedValue(new Error('db fail on ensure'));

    await expect(applyResult(10, 20, 5)).rejects.toThrow('db fail on ensure');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

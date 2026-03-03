import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { closeSeason, ensureActiveSeason, getActiveSeason, getSeasonStatus, getSeasonPodium, adminEndSeason, adminCreateSeason } from './season.service';
import { SEASON_DURATION_DAYS } from '../config';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    season: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    playerSeason: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    duel: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn(),
    },
  },
}));

describe('season.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveSeason should query active=true', async () => {
    const season = { id: 1, number: 9, active: true };
    (prisma.season.findFirst as any).mockResolvedValue(season);

    const result = await getActiveSeason();

    expect(prisma.season.findFirst).toHaveBeenCalledWith({ where: { active: true } });
    expect(result).toEqual(season);
  });

  it('ensureActiveSeason should return existing active season without creating a new one', async () => {
    const existing = {
      id: 1,
      number: 2,
      active: true,
      endDate: new Date('2026-03-01T00:00:00.000Z'),
    };
    (prisma.season.findFirst as any).mockResolvedValueOnce(existing);

    const result = await ensureActiveSeason();

    expect(result).toEqual(existing);
    expect(prisma.season.create).not.toHaveBeenCalled();
  });

  it('ensureActiveSeason should create season #1 when none exists', async () => {
    const created = {
      id: 10,
      number: 1,
      active: true,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-03T00:00:00.000Z'),
    };
    (prisma.season.findFirst as any)
      .mockResolvedValueOnce(null) // getActiveSeason
      .mockResolvedValueOnce(null); // lastSeason
    (prisma.season.create as any).mockResolvedValue(created);

    const before = Date.now();
    const result = await ensureActiveSeason();
    const after = Date.now();

    expect(prisma.season.create).toHaveBeenCalledTimes(1);
    const call = (prisma.season.create as any).mock.calls[0][0];
    expect(call.data.number).toBe(1);
    expect(call.data.active).toBe(true);
    expect(call.data.endDate.getTime() - call.data.startDate.getTime()).toBe(
      SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(call.data.startDate.getTime()).toBeGreaterThanOrEqual(before - 50);
    expect(call.data.startDate.getTime()).toBeLessThanOrEqual(after + 50);
    expect(result).toEqual(created);
  });

  it('ensureActiveSeason should create next season number based on last season', async () => {
    (prisma.season.findFirst as any)
      .mockResolvedValueOnce(null) // getActiveSeason
      .mockResolvedValueOnce({ id: 99, number: 7 }); // lastSeason
    (prisma.season.create as any).mockResolvedValue({
      id: 100,
      number: 8,
      active: true,
      endDate: new Date('2026-03-10T00:00:00.000Z'),
    });

    await ensureActiveSeason();

    const call = (prisma.season.create as any).mock.calls[0][0];
    expect(call.data.number).toBe(8);
  });

  it('closeSeason should cancel all active duels before closing', async () => {
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 3 });
    (prisma.playerSeason.findFirst as any).mockResolvedValue({ playerId: 1 });
    (prisma.season.update as any).mockResolvedValue({});

    await closeSeason(7);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: {
        seasonId: 7,
        status: { notIn: ['CONFIRMED', 'CANCELLED', 'EXPIRED'] },
      },
      data: { status: 'CANCELLED' },
    });
  });

  it('closeSeason should set championId with top player when ranking is not empty', async () => {
    (prisma.playerSeason.findFirst as any).mockResolvedValue({ playerId: 222 });
    (prisma.season.update as any).mockResolvedValue({});

    await closeSeason(7);

    expect(prisma.playerSeason.findFirst).toHaveBeenCalledWith({
      where: { seasonId: 7 },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }],
    });
    expect(prisma.season.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { active: false, championId: 222 },
    });
  });

  it('closeSeason should set championId=null when season has no players', async () => {
    (prisma.playerSeason.findFirst as any).mockResolvedValue(null);
    (prisma.season.update as any).mockResolvedValue({});

    await closeSeason(8);

    expect(prisma.season.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { active: false, championId: null },
    });
  });

  it('ensureActiveSeason should propagate create error', async () => {
    (prisma.season.findFirst as any)
      .mockResolvedValueOnce(null) // getActiveSeason
      .mockResolvedValueOnce({ id: 1, number: 3 }); // lastSeason
    (prisma.season.create as any).mockRejectedValue(new Error('create failed'));

    await expect(ensureActiveSeason()).rejects.toThrow('create failed');
  });

  it('closeSeason should propagate update error', async () => {
    (prisma.playerSeason.findFirst as any).mockResolvedValue({ playerId: 50 });
    (prisma.season.update as any).mockRejectedValue(new Error('update failed'));

    await expect(closeSeason(8)).rejects.toThrow('update failed');
  });

  describe('getSeasonStatus', () => {
    it('should return null when season not found', async () => {
      (prisma.season.findUnique as any).mockResolvedValue(null);
      const result = await getSeasonStatus(999);
      expect(result).toBeNull();
    });

    it('should return season with stats', async () => {
      const season = { id: 1, number: 3, name: 'Test', startDate: new Date(), endDate: new Date(), active: true, championId: null };
      (prisma.season.findUnique as any).mockResolvedValue(season);
      (prisma.duel.count as any).mockResolvedValue(42);
      (prisma.playerSeason.count as any).mockResolvedValue(15);

      const result = await getSeasonStatus(1);

      expect(result).toEqual({ ...season, totalDuels: 42, activePlayers: 15 });
    });
  });

  describe('getSeasonPodium', () => {
    it('should return top 3 with mapped fields', async () => {
      (prisma.playerSeason.findMany as any).mockResolvedValue([
        { playerId: 1, player: { discordId: 'u1' }, points: 10, wins: 8, losses: 2, peakStreak: 5 },
        { playerId: 2, player: { discordId: 'u2' }, points: 7, wins: 6, losses: 3, peakStreak: 3 },
      ]);

      const result = await getSeasonPodium(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ rank: 1, playerId: 1, discordId: 'u1', points: 10, wins: 8, losses: 2, peakStreak: 5 });
      expect(result[1].rank).toBe(2);
    });

    it('should return empty array when no players', async () => {
      (prisma.playerSeason.findMany as any).mockResolvedValue([]);
      const result = await getSeasonPodium(1);
      expect(result).toEqual([]);
    });
  });

  describe('adminEndSeason', () => {
    it('should cancel active duels and close season', async () => {
      (prisma.duel.updateMany as any).mockResolvedValue({ count: 2 });
      (prisma.playerSeason.findFirst as any).mockResolvedValue({ playerId: 5 });
      (prisma.season.update as any).mockResolvedValue({});

      await adminEndSeason(3);

      expect(prisma.duel.updateMany).toHaveBeenCalledWith({
        where: { seasonId: 3, status: { notIn: ['CONFIRMED', 'CANCELLED', 'EXPIRED'] } },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.season.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { active: false, championId: 5 },
      });
    });
  });

  describe('adminCreateSeason', () => {
    it('should create season with name and custom duration', async () => {
      (prisma.season.findFirst as any).mockResolvedValue({ id: 5, number: 3 });
      (prisma.season.create as any).mockResolvedValue({
        id: 6, number: 4, name: 'Test Season', active: true,
        startDate: new Date(), endDate: new Date(),
      });

      const result = await adminCreateSeason('Test Season', 45);

      expect(prisma.season.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ number: 4, name: 'Test Season', active: true }),
      });
      const call = (prisma.season.create as any).mock.calls[0][0];
      const diffDays = Math.round((call.data.endDate.getTime() - call.data.startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(45);
      expect(result.number).toBe(4);
    });

    it('should start at number 1 when no seasons exist', async () => {
      (prisma.season.findFirst as any).mockResolvedValue(null);
      (prisma.season.create as any).mockResolvedValue({
        id: 1, number: 1, name: null, active: true,
        startDate: new Date(), endDate: new Date(),
      });

      await adminCreateSeason(null, 30);

      const call = (prisma.season.create as any).mock.calls[0][0];
      expect(call.data.number).toBe(1);
      expect(call.data.name).toBeNull();
    });
  });
});

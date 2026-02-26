import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { closeSeason, ensureActiveSeason, getActiveSeason } from './season.service';
import { SEASON_DURATION_DAYS } from '../config';

vi.mock('../lib/prisma', () => ({
  prisma: {
    season: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    playerSeason: {
      findFirst: vi.fn(),
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
});

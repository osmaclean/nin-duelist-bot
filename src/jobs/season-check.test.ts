import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSeasonCheckJob } from './season-check';
import { closeSeason, ensureActiveSeason, getActiveSeason } from '../services/season.service';
import { logger } from '../lib/logger';

vi.mock('../config', () => ({
  SEASON_CHECK_INTERVAL_MS: 1000,
}));

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
  closeSeason: vi.fn(),
  ensureActiveSeason: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('jobs/season-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start job and log startup message', () => {
    startSeasonCheckJob();

    expect(logger.info).toHaveBeenCalledWith('Job season-check iniciado');
  });

  it('should ensure season when there is no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    (ensureActiveSeason as any).mockResolvedValue({});

    startSeasonCheckJob();
    await vi.advanceTimersByTimeAsync(1000);

    expect(getActiveSeason).toHaveBeenCalledTimes(1);
    expect(ensureActiveSeason).toHaveBeenCalledTimes(1);
    expect(closeSeason).not.toHaveBeenCalled();
  });

  it('should do nothing when active season is not expired', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T00:00:00.000Z'),
    });

    startSeasonCheckJob();
    await vi.advanceTimersByTimeAsync(1000);

    expect(getActiveSeason).toHaveBeenCalledTimes(1);
    expect(closeSeason).not.toHaveBeenCalled();
    expect(ensureActiveSeason).not.toHaveBeenCalled();
  });

  it('should close and rotate season when active season is expired', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 11,
      number: 3,
      endDate: new Date('2026-02-26T12:00:00.000Z'),
    });
    (closeSeason as any).mockResolvedValue({});
    (ensureActiveSeason as any).mockResolvedValue({});

    startSeasonCheckJob();
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.info).toHaveBeenCalledWith('Season expirou, encerrando', { seasonId: 11, seasonNumber: 3 });
    expect(closeSeason).toHaveBeenCalledWith(11);
    expect(ensureActiveSeason).toHaveBeenCalledTimes(1);
  });

  it('should catch and log errors thrown by dependencies', async () => {
    const error = new Error('season fail');
    (getActiveSeason as any).mockRejectedValue(error);

    startSeasonCheckJob();
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.error).toHaveBeenCalledWith('Erro no job season-check', { error: 'Error: season fail' });
  });
});

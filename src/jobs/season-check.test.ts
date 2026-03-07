import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSeasonCheckJob } from './season-check';
import {
  closeSeason,
  ensureActiveSeason,
  getActiveSeason,
  markSeasonEndingNotified,
} from '../services/season.service';
import { notifySeasonEnding } from '../lib/notifications';
import { logger } from '../lib/logger';

vi.mock('../config', () => ({
  SEASON_CHECK_INTERVAL_MS: 1000,
  SEASON_ENDING_WARNING_MS: 24 * 60 * 60 * 1000,
}));

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
  closeSeason: vi.fn(),
  ensureActiveSeason: vi.fn(),
  markSeasonEndingNotified: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/notifications', () => ({
  notifySeasonEnding: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<any>) => fn()),
}));

vi.mock('../lib/job-health', () => ({
  registerJob: vi.fn(),
  markJobSuccess: vi.fn(),
  checkJobHealth: vi.fn(),
}));

vi.mock('../lib/ops-webhook', () => ({
  sendOpsAlert: vi.fn(),
}));

function makeClient() {
  return { users: { fetch: vi.fn() } } as any;
}

describe('jobs/season-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start job and log startup message', () => {
    startSeasonCheckJob(makeClient());

    expect(logger.info).toHaveBeenCalledWith('Job season-check iniciado');
  });

  it('should ensure season when there is no active season and mark success', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    (ensureActiveSeason as any).mockResolvedValue({});

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(getActiveSeason).toHaveBeenCalledTimes(1);
    expect(ensureActiveSeason).toHaveBeenCalledTimes(1);
    expect(closeSeason).not.toHaveBeenCalled();

    const { markJobSuccess } = await import('../lib/job-health');
    expect(markJobSuccess).toHaveBeenCalledWith('season-check');
  });

  it('should do nothing when active season is not expired', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T00:00:00.000Z'),
      endingNotificationSent: false,
    });

    startSeasonCheckJob(makeClient());
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
      endingNotificationSent: true,
    });
    (closeSeason as any).mockResolvedValue({});
    (ensureActiveSeason as any).mockResolvedValue({});

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.info).toHaveBeenCalledWith('Season expirou, encerrando', { seasonId: 11, seasonNumber: 3 });
    expect(closeSeason).toHaveBeenCalledWith(11);
    expect(ensureActiveSeason).toHaveBeenCalledTimes(1);
  });

  it('should call markJobSuccess after successful cycle', async () => {
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2099-01-01'),
      endingNotificationSent: false,
    });

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    const { markJobSuccess } = await import('../lib/job-health');
    expect(markJobSuccess).toHaveBeenCalledWith('season-check');
  });

  it('should catch and log errors thrown by dependencies', async () => {
    const error = new Error('season fail');
    (getActiveSeason as any).mockRejectedValue(error);

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.error).toHaveBeenCalledWith('Erro no job season-check', { error: 'Error: season fail' });
  });

  it('should send ops alert when season-check fails', async () => {
    const error = new Error('db down');
    (getActiveSeason as any).mockRejectedValue(error);

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    const { sendOpsAlert } = await import('../lib/ops-webhook');
    expect(sendOpsAlert).toHaveBeenCalledWith(
      'Falha no job season-check',
      'Erro: Error: db down',
      'error',
    );
  });

  // ─── Season ending notification tests ──────────────

  it('should send season ending notification when within 24h of end (notify before marking)', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T06:00:00.000Z'), // 18h away
      endingNotificationSent: false,
    });

    // Track call order
    const callOrder: string[] = [];
    (notifySeasonEnding as any).mockImplementation(() => {
      callOrder.push('notify');
      return Promise.resolve();
    });
    (markSeasonEndingNotified as any).mockImplementation(() => {
      callOrder.push('mark');
      return Promise.resolve();
    });

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(notifySeasonEnding).toHaveBeenCalledWith(expect.anything(), 10, 2);
    expect(markSeasonEndingNotified).toHaveBeenCalledWith(10);
    expect(callOrder).toEqual(['notify', 'mark']);
    expect(logger.info).toHaveBeenCalledWith('Aviso de season encerrando enviado', { seasonId: 10 });
  });

  it('should not mark as notified if notification fails', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T06:00:00.000Z'),
      endingNotificationSent: false,
    });
    (notifySeasonEnding as any).mockRejectedValue(new Error('DM failed'));

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(notifySeasonEnding).toHaveBeenCalled();
    expect(markSeasonEndingNotified).not.toHaveBeenCalled();
  });

  it('should not send season ending notification when already sent', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T06:00:00.000Z'),
      endingNotificationSent: true, // already sent
    });

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(markSeasonEndingNotified).not.toHaveBeenCalled();
    expect(notifySeasonEnding).not.toHaveBeenCalled();
  });

  it('should not send season ending notification when more than 24h away', async () => {
    vi.setSystemTime(new Date('2026-02-24T12:00:00.000Z'));
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      number: 2,
      endDate: new Date('2026-02-27T00:00:00.000Z'), // 60h away
      endingNotificationSent: false,
    });

    startSeasonCheckJob(makeClient());
    await vi.advanceTimersByTimeAsync(1000);

    expect(markSeasonEndingNotified).not.toHaveBeenCalled();
    expect(notifySeasonEnding).not.toHaveBeenCalled();
  });
});

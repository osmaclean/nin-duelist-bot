import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerReadyEvent } from './ready';
import { ensureActiveSeason } from '../services/season.service';
import { startExpireDuelsJob } from '../jobs/expire-duels';
import { startSeasonCheckJob } from '../jobs/season-check';

vi.mock('../services/season.service', () => ({
  ensureActiveSeason: vi.fn(),
}));

vi.mock('../jobs/expire-duels', () => ({
  startExpireDuelsJob: vi.fn(),
}));

vi.mock('../jobs/season-check', () => ({
  startSeasonCheckJob: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('events/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register ClientReady handler with client.once', () => {
    const once = vi.fn();
    const client = { once } as any;

    registerReadyEvent(client);

    expect(once).toHaveBeenCalledTimes(1);
  });

  it('should initialize season and jobs when ready event fires', async () => {
    const once = vi.fn();
    const client = { once } as any;
    (ensureActiveSeason as any).mockResolvedValue({});

    registerReadyEvent(client);
    const callback = once.mock.calls[0][1];
    const readyClient = { user: { tag: 'Nin#1234' } };

    await callback(readyClient);

    const { logger } = await import('../lib/logger');
    expect(logger.info).toHaveBeenCalledWith('Bot online', { tag: 'Nin#1234' });
    expect(ensureActiveSeason).toHaveBeenCalledTimes(1);
    expect(startExpireDuelsJob).toHaveBeenCalledWith(readyClient);
    expect(startSeasonCheckJob).toHaveBeenCalledTimes(1);
  });

  it('should log error and exit process when ensureActiveSeason fails', async () => {
    const once = vi.fn();
    const client = { once } as any;
    const err = new Error('season init fail');
    (ensureActiveSeason as any).mockRejectedValue(err);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerReadyEvent(client);
    const callback = once.mock.calls[0][1];
    const readyClient = { user: { tag: 'Nin#1234' } };

    await callback(readyClient);

    const { logger } = await import('../lib/logger');
    expect(logger.error).toHaveBeenCalledWith('Falha crítica na inicialização', { error: 'Error: season init fail' });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(startExpireDuelsJob).not.toHaveBeenCalled();
    expect(startSeasonCheckJob).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

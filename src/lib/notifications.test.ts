import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyWitnessValidation } from './notifications';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 'AWAITING_VALIDATION',
    challengerId: 1,
    opponentId: 2,
    witnessId: 3,
    scoreWinner: 2,
    scoreLoser: 1,
    channelId: 'ch1',
    challenger: { discordId: 'u1' },
    opponent: { discordId: 'u2' },
    witness: { discordId: 'u3' },
    ...overrides,
  } as any;
}

describe('lib/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send DM to witness on success', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = {
      users: { fetch: vi.fn().mockResolvedValue({ send }) },
      channels: { fetch: vi.fn() },
    } as any;

    await notifyWitnessValidation(client, makeDuel());

    expect(client.users.fetch).toHaveBeenCalledWith('u3');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('Duelo #10');
    expect(send.mock.calls[0][0]).toContain('2-1');

    const { logger } = await import('./logger');
    expect(logger.info).toHaveBeenCalledWith(
      'DM de validação enviada para testemunha',
      expect.objectContaining({ duelId: 10, witnessId: 'u3' }),
    );
  });

  it('should fallback to channel when DM fails', async () => {
    const channelSend = vi.fn().mockResolvedValue(undefined);
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('Cannot send DM')) },
      channels: { fetch: vi.fn().mockResolvedValue({ send: channelSend }) },
    } as any;

    await notifyWitnessValidation(client, makeDuel());

    expect(client.channels.fetch).toHaveBeenCalledWith('ch1');
    expect(channelSend).toHaveBeenCalledTimes(1);
    expect(channelSend.mock.calls[0][0]).toContain('<@u3>');

    const { logger } = await import('./logger');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should log error when both DM and channel fallback fail', async () => {
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('DM fail')) },
      channels: { fetch: vi.fn().mockRejectedValue(new Error('Channel fail')) },
    } as any;

    await notifyWitnessValidation(client, makeDuel());

    const { logger } = await import('./logger');
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Falha no fallback de notificação no canal',
      expect.objectContaining({ duelId: 10, channelId: 'ch1' }),
    );
  });

  it('should skip channel fallback when channelId is null', async () => {
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('DM fail')) },
      channels: { fetch: vi.fn() },
    } as any;

    await notifyWitnessValidation(client, makeDuel({ channelId: null }));

    expect(client.channels.fetch).not.toHaveBeenCalled();

    const { logger } = await import('./logger');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should never throw even if everything fails', async () => {
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
      channels: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
    } as any;

    // Should not throw
    await expect(notifyWitnessValidation(client, makeDuel())).resolves.toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyDuelCreated,
  notifyDuelAccepted,
  notifyWitnessValidation,
  notifyDuelConfirmed,
  notifyResultRejected,
  notifyDuelExpired,
} from './notifications';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 'AWAITING_VALIDATION',
    format: 'MD1',
    challengerId: 1,
    opponentId: 2,
    witnessId: 3,
    winnerId: 1,
    scoreWinner: 2,
    scoreLoser: 1,
    channelId: 'ch1',
    challenger: { discordId: 'u1' },
    opponent: { discordId: 'u2' },
    witness: { discordId: 'u3' },
    ...overrides,
  } as any;
}

function makeClient(dmSuccess = true) {
  const send = dmSuccess ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('DM fail'));
  return {
    users: { fetch: vi.fn().mockResolvedValue({ send }) },
    channels: { fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue(undefined) }) },
    _send: send,
  } as any;
}

describe('lib/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyWitnessValidation', () => {
    it('should send DM to witness on success', async () => {
      const client = makeClient();
      await notifyWitnessValidation(client, makeDuel());

      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(1);
      expect(client._send.mock.calls[0][0]).toContain('Duelo #10');
      expect(client._send.mock.calls[0][0]).toContain('2-1');
    });

    it('should fallback to channel when DM fails', async () => {
      const channelSend = vi.fn().mockResolvedValue(undefined);
      const client = {
        users: { fetch: vi.fn().mockRejectedValue(new Error('DM fail')) },
        channels: { fetch: vi.fn().mockResolvedValue({ send: channelSend }) },
      } as any;

      await notifyWitnessValidation(client, makeDuel());

      expect(client.channels.fetch).toHaveBeenCalledWith('ch1');
      expect(channelSend).toHaveBeenCalledTimes(1);
      expect(channelSend.mock.calls[0][0]).toContain('<@u3>');
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
    });

    it('should never throw even if everything fails', async () => {
      const client = {
        users: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
        channels: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
      } as any;

      await expect(notifyWitnessValidation(client, makeDuel())).resolves.toBeUndefined();
    });
  });

  describe('notifyDuelCreated', () => {
    it('should send DM to opponent and witness', async () => {
      const client = makeClient();
      await notifyDuelCreated(client, makeDuel());

      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('desafiado');
      expect(client._send.mock.calls[1][0]).toContain('testemunha');
    });
  });

  describe('notifyDuelAccepted', () => {
    it('should send DM to both duelists', async () => {
      const client = makeClient();
      await notifyDuelAccepted(client, makeDuel({ status: 'ACCEPTED' }));

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Oponente aceitou');
    });
  });

  describe('notifyDuelConfirmed', () => {
    it('should send DM to both duelists with result', async () => {
      const client = makeClient();
      await notifyDuelConfirmed(client, makeDuel({ status: 'CONFIRMED' }));

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Resultado confirmado');
      expect(client._send.mock.calls[0][0]).toContain('2-1');
    });
  });

  describe('notifyResultRejected', () => {
    it('should send DM to both duelists', async () => {
      const client = makeClient();
      await notifyResultRejected(client, makeDuel({ status: 'IN_PROGRESS' }));

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('rejeitado');
    });
  });

  describe('notifyDuelExpired', () => {
    it('should send DM to all 3 participants', async () => {
      const client = makeClient();
      await notifyDuelExpired(client, makeDuel({ status: 'EXPIRED' }));

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(3);
      expect(client._send.mock.calls[0][0]).toContain('Expirado');
    });
  });

  it('should never throw from any notification function', async () => {
    const client = {
      users: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
      channels: { fetch: vi.fn().mockRejectedValue(new Error('fail')) },
    } as any;
    const duel = makeDuel();

    await expect(notifyDuelCreated(client, duel)).resolves.toBeUndefined();
    await expect(notifyDuelAccepted(client, duel)).resolves.toBeUndefined();
    await expect(notifyDuelConfirmed(client, duel)).resolves.toBeUndefined();
    await expect(notifyResultRejected(client, duel)).resolves.toBeUndefined();
    await expect(notifyDuelExpired(client, duel)).resolves.toBeUndefined();
  });
});

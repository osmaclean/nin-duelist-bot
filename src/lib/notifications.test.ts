import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyDuelCreated,
  notifyDuelAccepted,
  notifyWitnessValidation,
  notifyDuelConfirmed,
  notifyResultRejected,
  notifyDuelExpiringSoon,
  notifyDuelExpired,
  notifyAdminCancel,
  notifyAdminReopen,
  notifyAdminForceExpire,
  notifyAdminFixResult,
  notifySeasonEnding,
} from './notifications';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
}));

const mockFindUnique = vi.fn().mockResolvedValue({ dmEnabled: true });
const mockFindMany = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock('./prisma', () => ({
  prisma: {
    player: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    playerSeason: { findMany: (...args: any[]) => mockFindMany(...args) },
    player_update: { update: (...args: any[]) => mockUpdate(...args) },
  },
}));

vi.mock('../config', () => ({
  NOTIFICATION_COOLDOWN_MS: 300000,
}));

vi.mock('./notification-metrics', () => ({
  trackDmSent: vi.fn(),
  trackDmFailed: vi.fn(),
  trackChannelFallbackSent: vi.fn(),
  trackChannelFallbackFailed: vi.fn(),
  trackThrottled: vi.fn(),
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
    mockFindUnique.mockResolvedValue({ dmEnabled: true });
  });

  // ─── Existing notification tests ──────────────────

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
        channels: { fetch: vi.fn().mockResolvedValue({ send: channelSend, isTextBased: () => true }) },
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

  describe('notifyDuelExpiringSoon', () => {
    it('should send DM to opponent and witness', async () => {
      const client = makeClient();
      await notifyDuelExpiringSoon(client, makeDuel({ status: 'PROPOSED' }));

      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Expirando em breve');
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

  // ─── DM opt-out tests ──────────────────────────────

  describe('DM opt-out', () => {
    it('should skip DM and use channel fallback when dmEnabled is false', async () => {
      mockFindUnique.mockResolvedValue({ dmEnabled: false });
      const channelSend = vi.fn().mockResolvedValue(undefined);
      const client = {
        users: { fetch: vi.fn().mockResolvedValue({ send: vi.fn() }) },
        channels: { fetch: vi.fn().mockResolvedValue({ send: channelSend, isTextBased: () => true }) },
      } as any;

      await notifyWitnessValidation(client, makeDuel());

      // Should NOT attempt DM
      expect(client.users.fetch).not.toHaveBeenCalled();
      // Should use channel fallback
      expect(channelSend).toHaveBeenCalledTimes(1);
      expect(channelSend.mock.calls[0][0]).toContain('<@u3>');
    });

    it('should send DM normally when dmEnabled is true', async () => {
      mockFindUnique.mockResolvedValue({ dmEnabled: true });
      const client = makeClient();
      await notifyWitnessValidation(client, makeDuel());

      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(1);
    });

    it('should default to sending DM when player not found in DB', async () => {
      mockFindUnique.mockResolvedValue(null);
      const client = makeClient();
      await notifyWitnessValidation(client, makeDuel());

      expect(client.users.fetch).toHaveBeenCalledWith('u3');
      expect(client._send).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Anti-spam cooldown tests ──────────────────────

  describe('anti-spam cooldown', () => {
    it('should throttle notification when cooldown is active', async () => {
      const { checkCooldown } = await import('./cooldown');
      (checkCooldown as any).mockReturnValue(false);

      const client = makeClient();
      await notifyDuelCreated(client, makeDuel());

      // Should NOT attempt to send anything (throttled)
      expect(client.users.fetch).not.toHaveBeenCalled();
    });

    it('should send notification when cooldown allows', async () => {
      const { checkCooldown } = await import('./cooldown');
      (checkCooldown as any).mockReturnValue(true);

      const client = makeClient();
      await notifyDuelCreated(client, makeDuel());

      expect(client.users.fetch).toHaveBeenCalled();
      expect(client._send).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Admin notification tests ──────────────────────

  describe('notifyAdminCancel', () => {
    it('should send DM to both duelists with reason', async () => {
      const client = makeClient();
      await notifyAdminCancel(client, makeDuel({ status: 'CANCELLED' }), 'Duelo suspeito');

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Cancelado por um administrador');
      expect(client._send.mock.calls[0][0]).toContain('Duelo suspeito');
    });
  });

  describe('notifyAdminReopen', () => {
    it('should send DM to both duelists with reason', async () => {
      const client = makeClient();
      await notifyAdminReopen(client, makeDuel({ status: 'IN_PROGRESS' }), 'Erro na validação');

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Reaberto por um administrador');
      expect(client._send.mock.calls[0][0]).toContain('Erro na validação');
    });
  });

  describe('notifyAdminForceExpire', () => {
    it('should send DM to both duelists with reason', async () => {
      const client = makeClient();
      await notifyAdminForceExpire(client, makeDuel({ status: 'EXPIRED' }), 'Inatividade');

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Expirado por um administrador');
      expect(client._send.mock.calls[0][0]).toContain('Inatividade');
    });
  });

  describe('notifyAdminFixResult', () => {
    it('should send DM to both duelists with new result and reason', async () => {
      const client = makeClient();
      await notifyAdminFixResult(client, makeDuel({ status: 'CONFIRMED' }), 'u2', 2, 0, 'Placar errado');

      expect(client.users.fetch).toHaveBeenCalledWith('u1');
      expect(client.users.fetch).toHaveBeenCalledWith('u2');
      expect(client._send).toHaveBeenCalledTimes(2);
      expect(client._send.mock.calls[0][0]).toContain('Resultado corrigido por um administrador');
      expect(client._send.mock.calls[0][0]).toContain('<@u2> venceu (2-0)');
      expect(client._send.mock.calls[0][0]).toContain('Placar errado');
    });
  });

  // ─── Season ending notification tests ──────────────

  describe('notifySeasonEnding', () => {
    it('should send DM to all active players in season', async () => {
      mockFindMany.mockResolvedValue([
        { player: { discordId: 'u1' } },
        { player: { discordId: 'u2' } },
        { player: { discordId: 'u3' } },
      ]);

      const client = makeClient();
      await notifySeasonEnding(client, 5, 3);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { seasonId: 5 },
        include: { player: true },
      });
      expect(client.users.fetch).toHaveBeenCalledTimes(3);
      expect(client._send).toHaveBeenCalledTimes(3);
      expect(client._send.mock.calls[0][0]).toContain('Season 3');
      expect(client._send.mock.calls[0][0]).toContain('24 horas');
    });

    it('should handle empty season gracefully', async () => {
      mockFindMany.mockResolvedValue([]);

      const client = makeClient();
      await notifySeasonEnding(client, 5, 3);

      expect(client.users.fetch).not.toHaveBeenCalled();
    });
  });

  // ─── Never throw tests ─────────────────────────────

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
    await expect(notifyDuelExpiringSoon(client, duel)).resolves.toBeUndefined();
    await expect(notifyDuelExpired(client, duel)).resolves.toBeUndefined();
    await expect(notifyAdminCancel(client, duel, 'test')).resolves.toBeUndefined();
    await expect(notifyAdminReopen(client, duel, 'test')).resolves.toBeUndefined();
    await expect(notifyAdminForceExpire(client, duel, 'test')).resolves.toBeUndefined();
    await expect(notifyAdminFixResult(client, duel, 'u1', 2, 1, 'test')).resolves.toBeUndefined();
  });
});

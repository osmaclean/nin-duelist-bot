import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminCommand } from './admin';
import { getDuelById, cancelDuel, reopenDuel, forceExpireDuel, adminFixResult } from '../services/duel.service';
import { reverseResult } from '../services/player.service';
import { buildDuelEmbed } from '../lib/embeds';
import { logAdminAction, getAdminLogs } from '../services/audit.service';
import {
  getActiveSeason,
  getSeasonStatus,
  getSeasonPodium,
  adminEndSeason,
  adminCreateSeason,
} from '../services/season.service';
import { searchDuelsByPlayer, searchDuelsByStatus } from '../services/search.service';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  cancelDuel: vi.fn(),
  reopenDuel: vi.fn(),
  forceExpireDuel: vi.fn(),
  adminFixResult: vi.fn(),
}));

vi.mock('../services/player.service', () => ({
  reverseResult: vi.fn().mockResolvedValue(undefined),
  applyResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/audit.service', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
  getAdminLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
  getSeasonStatus: vi.fn(),
  getSeasonPodium: vi.fn(),
  adminEndSeason: vi.fn().mockResolvedValue(undefined),
  adminCreateSeason: vi.fn(),
}));

vi.mock('../services/search.service', () => ({
  searchDuelsByPlayer: vi.fn().mockResolvedValue([]),
  searchDuelsByStatus: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn(),
        duel: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
        playerSeason: { upsert: vi.fn() },
      }),
    ),
  },
}));

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof import('../config')>('../config');
  return {
    ...actual,
    ADMIN_ROLE_IDS: ['role-admin'],
  };
});

function interaction(subcommand: string, overrides: Record<string, unknown> = {}) {
  const optionsMap: Record<string, unknown> = {
    duel_id: 10,
    reason: 'Motivo teste',
    score: '2-1',
    ...((overrides._options as Record<string, unknown>) ?? {}),
  };
  const winnerUser = (overrides._winnerUser as Record<string, unknown>) ?? { id: 'u1', tag: 'User1#0001' };
  const subcommandGroup = (overrides._group as string) ?? null;

  return {
    user: { id: 'admin1', tag: 'Admin#0001' },
    member: {
      roles: ['role-admin', 'other-role'],
    },
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getSubcommandGroup: vi.fn().mockReturnValue(subcommandGroup),
      getInteger: vi.fn((name: string) => optionsMap[name] ?? null),
      getString: vi.fn((name: string) => optionsMap[name] ?? null),
      getUser: vi.fn(() => winnerUser),
    },
    client: {
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    },
    channel: (overrides._channel as any) ?? null,
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 'IN_PROGRESS',
    format: 'MD1',
    challengerId: 1,
    opponentId: 2,
    witnessId: 3,
    winnerId: null,
    scoreWinner: null,
    scoreLoser: null,
    seasonId: 1,
    channelId: 'ch1',
    messageId: null,
    challenger: { discordId: 'u1' },
    opponent: { discordId: 'u2' },
    witness: { discordId: 'u3' },
    ...overrides,
  } as any;
}

describe('commands/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Permission checks ───────────────────────────

  it('should reject when user has no admin role', async () => {
    const i = interaction('cancel', { member: { roles: ['regular-role'] } });
    await handleAdminCommand(i);
    expect(i.reply).toHaveBeenCalledWith({
      content: 'Você não tem permissão para usar comandos admin.',
      ephemeral: true,
    });
    expect(getDuelById).not.toHaveBeenCalled();
  });

  it('should reject when member has no roles', async () => {
    const i = interaction('cancel', { member: null });
    await handleAdminCommand(i);
    expect(i.reply).toHaveBeenCalledWith({
      content: 'Você não tem permissão para usar comandos admin.',
      ephemeral: true,
    });
  });

  it('should work with GuildMemberRoleManager (cache.has)', async () => {
    const i = interaction('cancel', {
      member: {
        roles: {
          cache: { has: vi.fn((id: string) => id === 'role-admin') },
        },
      },
    });
    (getDuelById as any).mockResolvedValue(null);
    await handleAdminCommand(i);
    expect(i.deferReply).toHaveBeenCalled();
  });

  // ─── /admin cancel ───────────────────────────────

  describe('cancel', () => {
    it('should reply not found when duel does not exist', async () => {
      (getDuelById as any).mockResolvedValue(null);
      const i = interaction('cancel');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 não encontrado.');
    });

    it('should reject when duel is in terminal state', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CONFIRMED' }));
      const i = interaction('cancel');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 já está em estado terminal (CONFIRMED).');
    });

    it('should reply error when cancelDuel fails', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel());
      (cancelDuel as any).mockResolvedValue(null);
      const i = interaction('cancel');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Erro ao cancelar duelo #10.');
    });

    it('should cancel duel, log audit, and reply success', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel());
      (cancelDuel as any).mockResolvedValue(makeDuel({ status: 'CANCELLED' }));
      const i = interaction('cancel');
      await handleAdminCommand(i);

      expect(cancelDuel).toHaveBeenCalledWith(10);
      expect(logAdminAction).toHaveBeenCalledWith({
        action: 'CANCEL_DUEL',
        adminDiscordId: 'admin1',
        duelId: 10,
        reason: 'Motivo teste',
        previousStatus: 'IN_PROGRESS',
        newStatus: 'CANCELLED',
      });
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('cancelado com sucesso'));
    });

    it('should update original message when channelId and messageId exist', async () => {
      const messageEdit = vi.fn().mockResolvedValue(undefined);
      const messageFetch = vi.fn().mockResolvedValue({ edit: messageEdit });
      const channelFetch = vi.fn().mockResolvedValue({ messages: { fetch: messageFetch } });

      (getDuelById as any).mockResolvedValue(makeDuel({ channelId: 'ch1', messageId: 'msg1' }));
      (cancelDuel as any).mockResolvedValue(makeDuel({ status: 'CANCELLED' }));
      (buildDuelEmbed as any).mockReturnValue({ embed: true });

      const i = interaction('cancel', { client: { channels: { fetch: channelFetch } } });
      await handleAdminCommand(i);

      expect(channelFetch).toHaveBeenCalledWith('ch1');
      expect(messageFetch).toHaveBeenCalledWith('msg1');
      expect(messageEdit).toHaveBeenCalledWith({ embeds: [{ embed: true }], components: [] });
    });
  });

  // ─── /admin reopen ───────────────────────────────

  describe('reopen', () => {
    it('should reply not found when duel does not exist', async () => {
      (getDuelById as any).mockResolvedValue(null);
      const i = interaction('reopen');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 não encontrado.');
    });

    it('should reject when duel is not in terminal state', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
      const i = interaction('reopen');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('não está em estado terminal'));
    });

    it('should reverse stats when reopening a CONFIRMED duel', async () => {
      (getDuelById as any).mockResolvedValue(
        makeDuel({ status: 'CONFIRMED', winnerId: 1, challengerId: 1, opponentId: 2, seasonId: 1 }),
      );
      (reopenDuel as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
      const i = interaction('reopen');
      await handleAdminCommand(i);

      expect(reverseResult).toHaveBeenCalledWith(1, 2, 1);
      expect(reopenDuel).toHaveBeenCalledWith(10);
      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'REOPEN_DUEL' }));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('reaberto para IN_PROGRESS'));
    });

    it('should not reverse stats when reopening a CANCELLED duel', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CANCELLED' }));
      (reopenDuel as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
      const i = interaction('reopen');
      await handleAdminCommand(i);

      expect(reverseResult).not.toHaveBeenCalled();
      expect(reopenDuel).toHaveBeenCalledWith(10);
    });

    it('should reply error when reopenDuel fails', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'EXPIRED' }));
      (reopenDuel as any).mockResolvedValue(null);
      const i = interaction('reopen');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Erro ao reabrir duelo #10.');
    });
  });

  // ─── /admin force-expire ─────────────────────────

  describe('force-expire', () => {
    it('should reply not found when duel does not exist', async () => {
      (getDuelById as any).mockResolvedValue(null);
      const i = interaction('force-expire');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 não encontrado.');
    });

    it('should reject when duel is already terminal', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CONFIRMED' }));
      const i = interaction('force-expire');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 já está em estado terminal (CONFIRMED).');
    });

    it('should force expire and log audit', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'AWAITING_VALIDATION' }));
      (forceExpireDuel as any).mockResolvedValue(makeDuel({ status: 'EXPIRED' }));
      const i = interaction('force-expire');
      await handleAdminCommand(i);

      expect(forceExpireDuel).toHaveBeenCalledWith(10);
      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FORCE_EXPIRE',
          previousStatus: 'AWAITING_VALIDATION',
          newStatus: 'EXPIRED',
        }),
      );
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('expirado forçadamente'));
    });

    it('should reply error when forceExpireDuel fails', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel());
      (forceExpireDuel as any).mockResolvedValue(null);
      const i = interaction('force-expire');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Erro ao expirar duelo #10.');
    });
  });

  // ─── /admin fix-result ───────────────────────────

  describe('fix-result', () => {
    it('should reply not found when duel does not exist', async () => {
      (getDuelById as any).mockResolvedValue(null);
      const i = interaction('fix-result');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Duelo #10 não encontrado.');
    });

    it('should reject when duel is not CONFIRMED', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
      const i = interaction('fix-result');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('não está confirmado'));
    });

    it('should reject when winner is not a participant', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CONFIRMED' }));
      const i = interaction('fix-result', { _winnerUser: { id: 'stranger', tag: 'X#0' } });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('não é participante'));
    });

    it('should reject invalid score format', async () => {
      (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CONFIRMED' }));
      const i = interaction('fix-result', { _options: { score: 'abc' } });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Placar inválido'));
    });

    it('should fix result with transaction and log audit', async () => {
      const confirmed = makeDuel({
        status: 'CONFIRMED',
        winnerId: 1,
        challengerId: 1,
        opponentId: 2,
        seasonId: 1,
      });
      (getDuelById as any).mockResolvedValue(confirmed);

      // Mock prisma.$transaction to call the callback and return result
      const { prisma: mockPrisma } = await import('../lib/prisma');
      const fixed = makeDuel({ status: 'CONFIRMED', winnerId: 1, scoreWinner: 2, scoreLoser: 1 });
      (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => {
        await fn(mockPrisma);
        return fixed;
      });
      (adminFixResult as any).mockResolvedValue(fixed);

      const i = interaction('fix-result', { _winnerUser: { id: 'u1', tag: 'User1#0' } });
      await handleAdminCommand(i);

      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FIX_RESULT',
          previousStatus: 'CONFIRMED',
          newStatus: 'CONFIRMED',
        }),
      );
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('corrigido'));
    });
  });

  // ─── /admin logs ─────────────────────────────────

  describe('logs', () => {
    it('should show no logs message when empty', async () => {
      (getAdminLogs as any).mockResolvedValue([]);
      const i = interaction('logs');
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Nenhuma ação admin registrada para o duelo #10.');
    });

    it('should format and display admin logs', async () => {
      (getAdminLogs as any).mockResolvedValue([
        {
          id: 1,
          action: 'CANCEL_DUEL',
          adminDiscordId: 'admin1',
          previousStatus: 'IN_PROGRESS',
          newStatus: 'CANCELLED',
          reason: 'Travado',
          createdAt: new Date('2026-01-15T10:30:00Z'),
        },
      ]);
      const i = interaction('logs');
      await handleAdminCommand(i);

      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('CANCEL_DUEL'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('IN_PROGRESS → CANCELLED'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Travado'));
    });
  });

  // ─── /admin season status ─────────────────────────

  describe('season status', () => {
    it('should reply no active season when none exists', async () => {
      (getActiveSeason as any).mockResolvedValue(null);
      const i = interaction('status', { _group: 'season' });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
    });

    it('should display season info with embed', async () => {
      (getActiveSeason as any).mockResolvedValue({ id: 1, number: 3 });
      (getSeasonStatus as any).mockResolvedValue({
        id: 1,
        number: 3,
        name: 'Temporada dos Campeões',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-03-03'),
        active: true,
        championId: null,
        totalDuels: 42,
        activePlayers: 15,
      });
      const i = interaction('status', { _group: 'season' });
      await handleAdminCommand(i);

      expect(i.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });
  });

  // ─── /admin season end ────────────────────────────

  describe('season end', () => {
    it('should reply no active season when none exists', async () => {
      (getActiveSeason as any).mockResolvedValue(null);
      const i = interaction('end', { _group: 'season' });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa para encerrar.');
    });

    it('should end season, log audit, and show podium', async () => {
      (getActiveSeason as any).mockResolvedValue({ id: 5, number: 2, name: null });
      (getSeasonPodium as any).mockResolvedValue([
        { rank: 1, playerId: 1, discordId: 'u1', points: 10, wins: 10, losses: 0, peakStreak: 10 },
        { rank: 2, playerId: 2, discordId: 'u2', points: 7, wins: 7, losses: 3, peakStreak: 5 },
      ]);

      const channelSend = vi.fn().mockResolvedValue(undefined);
      const i = interaction('end', { _group: 'season', _channel: { send: channelSend } });
      await handleAdminCommand(i);

      expect(adminEndSeason).toHaveBeenCalledWith(5);
      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'END_SEASON' }));
      expect(channelSend).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('encerrada com sucesso'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('<@u1>'));
    });

    it('should handle empty season gracefully', async () => {
      (getActiveSeason as any).mockResolvedValue({ id: 5, number: 2, name: null });
      (getSeasonPodium as any).mockResolvedValue([]);

      const i = interaction('end', { _group: 'season' });
      await handleAdminCommand(i);

      expect(adminEndSeason).toHaveBeenCalledWith(5);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('encerrada com sucesso'));
    });
  });

  // ─── /admin season create ─────────────────────────

  describe('season create', () => {
    it('should reject when active season already exists', async () => {
      (getActiveSeason as any).mockResolvedValue({ id: 1, number: 3 });
      const i = interaction('create', { _group: 'season' });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Já existe uma season ativa'));
    });

    it('should create season with name and custom duration', async () => {
      (getActiveSeason as any).mockResolvedValue(null);
      (adminCreateSeason as any).mockResolvedValue({
        id: 10,
        number: 4,
        name: 'Season X',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-04-15'),
        active: true,
      });

      const i = interaction('create', {
        _group: 'season',
        _options: { name: 'Season X', duration: 45 },
      });
      await handleAdminCommand(i);

      expect(adminCreateSeason).toHaveBeenCalledWith('Season X', 45);
      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE_SEASON' }));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Season 4'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Season X'));
    });

    it('should create season with defaults when no name or duration', async () => {
      (getActiveSeason as any).mockResolvedValue(null);
      (adminCreateSeason as any).mockResolvedValue({
        id: 11,
        number: 5,
        name: null,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        active: true,
      });

      const i = interaction('create', { _group: 'season' });
      await handleAdminCommand(i);

      expect(adminCreateSeason).toHaveBeenCalledWith(null, 30);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Season 5'));
    });
  });

  // ─── /admin search player ──────────────────────────

  describe('search player', () => {
    it('should reply no duels when player has none', async () => {
      (searchDuelsByPlayer as any).mockResolvedValue([]);
      const i = interaction('player', { _group: 'search', _winnerUser: { id: 'u1' } });
      await handleAdminCommand(i);
      expect(searchDuelsByPlayer).toHaveBeenCalledWith('u1');
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Nenhum duelo encontrado'));
    });

    it('should display duel list for player', async () => {
      (searchDuelsByPlayer as any).mockResolvedValue([
        {
          id: 5,
          status: 'CONFIRMED',
          createdAt: new Date('2026-02-20'),
          scoreWinner: 2,
          scoreLoser: 1,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
        },
        {
          id: 3,
          status: 'CANCELLED',
          createdAt: new Date('2026-02-18'),
          scoreWinner: null,
          scoreLoser: null,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u3' },
        },
      ]);

      const i = interaction('player', { _group: 'search', _winnerUser: { id: 'u1' } });
      await handleAdminCommand(i);

      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('#5'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('CONFIRMED'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('(2-1)'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('#3'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('CANCELLED'));
    });
  });

  // ─── /admin search status ─────────────────────────

  describe('search status', () => {
    it('should reject invalid status', async () => {
      const i = interaction('status', { _group: 'search', _options: { status: 'INVALID' } });
      await handleAdminCommand(i);
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Status inválido'));
    });

    it('should reply no duels when none match status', async () => {
      (searchDuelsByStatus as any).mockResolvedValue([]);
      const i = interaction('status', { _group: 'search', _options: { status: 'PROPOSED' } });
      await handleAdminCommand(i);
      expect(searchDuelsByStatus).toHaveBeenCalledWith('PROPOSED');
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Nenhum duelo com status'));
    });

    it('should display duels filtered by status', async () => {
      (searchDuelsByStatus as any).mockResolvedValue([
        {
          id: 7,
          status: 'IN_PROGRESS',
          createdAt: new Date('2026-02-25'),
          scoreWinner: null,
          scoreLoser: null,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
        },
      ]);

      const i = interaction('status', { _group: 'search', _options: { status: 'IN_PROGRESS' } });
      await handleAdminCommand(i);

      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('#7'));
      expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('IN_PROGRESS'));
    });
  });
});

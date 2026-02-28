import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminCommand } from './admin';
import { getDuelById, cancelDuel } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  cancelDuel: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof import('../config')>('../config');
  return {
    ...actual,
    ADMIN_ROLE_IDS: ['role-admin'],
  };
});

function interaction(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'admin1', tag: 'Admin#0001' },
    member: {
      roles: ['role-admin', 'other-role'],
    },
    options: {
      getSubcommand: vi.fn().mockReturnValue('cancel'),
      getInteger: vi.fn().mockReturnValue(10),
      getString: vi.fn().mockReturnValue('Duelo travado'),
    },
    client: {
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('commands/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when user has no admin role', async () => {
    const i = interaction({ member: { roles: ['regular-role'] } });

    await handleAdminCommand(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Você não tem permissão para usar comandos admin.',
      ephemeral: true,
    });
    expect(getDuelById).not.toHaveBeenCalled();
  });

  it('should reject when member has no roles', async () => {
    const i = interaction({ member: null });

    await handleAdminCommand(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Você não tem permissão para usar comandos admin.',
      ephemeral: true,
    });
  });

  it('should reply not found when duel does not exist', async () => {
    (getDuelById as any).mockResolvedValue(null);
    const i = interaction();

    await handleAdminCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Duelo #10 não encontrado.');
  });

  it('should reject when duel is already in terminal state', async () => {
    (getDuelById as any).mockResolvedValue({ id: 10, status: 'CONFIRMED' });
    const i = interaction();

    await handleAdminCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Duelo #10 já está em estado terminal (CONFIRMED).');
  });

  it('should reply error when cancelDuel fails', async () => {
    (getDuelById as any).mockResolvedValue({ id: 10, status: 'IN_PROGRESS' });
    (cancelDuel as any).mockResolvedValue(null);
    const i = interaction();

    await handleAdminCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Erro ao cancelar duelo #10.');
  });

  it('should cancel duel and log the action', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      channelId: null,
      messageId: null,
    });
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    const i = interaction();

    await handleAdminCommand(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);

    const { logger } = await import('../lib/logger');
    expect(logger.info).toHaveBeenCalledWith('Admin cancelou duelo', expect.objectContaining({
      duelId: 10,
      adminId: 'admin1',
      reason: 'Duelo travado',
      previousStatus: 'IN_PROGRESS',
    }));

    expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('cancelado com sucesso'));
    expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Duelo travado'));
  });

  it('should update original message when channelId and messageId exist', async () => {
    const messageEdit = vi.fn().mockResolvedValue(undefined);
    const messageFetch = vi.fn().mockResolvedValue({ edit: messageEdit });
    const channelFetch = vi.fn().mockResolvedValue({ messages: { fetch: messageFetch } });

    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      channelId: 'ch1',
      messageId: 'msg1',
    });
    const cancelled = { id: 10, status: 'CANCELLED' };
    (cancelDuel as any).mockResolvedValue(cancelled);
    (buildDuelEmbed as any).mockReturnValue({ embed: true });

    const i = interaction({
      client: { channels: { fetch: channelFetch } },
    });

    await handleAdminCommand(i);

    expect(channelFetch).toHaveBeenCalledWith('ch1');
    expect(messageFetch).toHaveBeenCalledWith('msg1');
    expect(messageEdit).toHaveBeenCalledWith({ embeds: [{ embed: true }], components: [] });
  });

  it('should work with GuildMemberRoleManager (cache.has)', async () => {
    const i = interaction({
      member: {
        roles: {
          cache: {
            has: vi.fn((id: string) => id === 'role-admin'),
          },
        },
      },
    });
    (getDuelById as any).mockResolvedValue(null);

    await handleAdminCommand(i);

    // Should pass permission check and reach deferReply
    expect(i.deferReply).toHaveBeenCalled();
  });
});

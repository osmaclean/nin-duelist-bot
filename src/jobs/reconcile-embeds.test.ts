import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileStaleEmbeds } from './reconcile-embeds';
import { prisma } from '../lib/prisma';
import { buildDuelEmbed } from '../lib/embeds';
import { TextChannel } from 'discord.js';

vi.mock('discord.js', () => ({
  TextChannel: class {
    messages: { fetch: any };
    constructor(fetchImpl: any) {
      this.messages = { fetch: fetchImpl };
    }
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../services/duel.service', () => ({
  DUEL_INCLUDE: { challenger: true, opponent: true, witness: true, winner: true },
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('jobs/reconcile-embeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when no stale duels found', async () => {
    (prisma.duel.findMany as any).mockResolvedValue([]);
    const client = { channels: { fetch: vi.fn() } } as any;

    await reconcileStaleEmbeds(client);

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('should update embed when terminal duel message still has buttons', async () => {
    const edit = vi.fn().mockResolvedValue({});
    const messageFetch = vi.fn().mockResolvedValue({
      components: [{ type: 1 }], // has action row
      edit,
    });
    const channel = new (TextChannel as any)(messageFetch);

    (prisma.duel.findMany as any).mockResolvedValue([
      {
        id: 1,
        status: 'CONFIRMED',
        channelId: 'ch-1',
        messageId: 'msg-1',
        challenger: { discordId: '1' },
        opponent: { discordId: '2' },
        witness: { discordId: '3' },
      },
    ]);
    (buildDuelEmbed as any).mockReturnValue({ title: 'confirmed' });

    const client = { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as any;

    await reconcileStaleEmbeds(client);

    expect(edit).toHaveBeenCalledWith({ embeds: [{ title: 'confirmed' }], components: [] });
    const { logger } = await import('../lib/logger');
    expect(logger.info).toHaveBeenCalledWith(
      'Embeds reconciliados no startup',
      expect.objectContaining({ reconciled: 1 }),
    );
  });

  it('should skip messages with no buttons', async () => {
    const messageFetch = vi.fn().mockResolvedValue({
      components: [], // already clean
      edit: vi.fn(),
    });
    const channel = new (TextChannel as any)(messageFetch);

    (prisma.duel.findMany as any).mockResolvedValue([
      { id: 2, status: 'EXPIRED', channelId: 'ch-1', messageId: 'msg-2' },
    ]);

    const client = { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as any;

    await reconcileStaleEmbeds(client);

    expect(buildDuelEmbed).not.toHaveBeenCalled();
  });

  it('should silently handle channel/message fetch errors', async () => {
    (prisma.duel.findMany as any).mockResolvedValue([
      { id: 3, status: 'CANCELLED', channelId: 'ch-1', messageId: 'msg-3' },
    ]);

    const client = { channels: { fetch: vi.fn().mockRejectedValue(new Error('not found')) } } as any;

    await expect(reconcileStaleEmbeds(client)).resolves.not.toThrow();
  });

  it('should log warning when prisma query fails', async () => {
    (prisma.duel.findMany as any).mockRejectedValue(new Error('db error'));

    const client = { channels: { fetch: vi.fn() } } as any;

    await reconcileStaleEmbeds(client);

    const { logger } = await import('../lib/logger');
    expect(logger.warn).toHaveBeenCalledWith(
      'Falha na reconciliação de embeds',
      expect.objectContaining({ error: 'Error: db error' }),
    );
  });
});

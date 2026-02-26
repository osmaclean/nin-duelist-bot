import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startExpireDuelsJob } from './expire-duels';
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

vi.mock('../config', () => ({
  DUEL_EXPIRY_MS: 30 * 60 * 1000,
  EXPIRE_CHECK_INTERVAL_MS: 1000,
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function makeDuel(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    status: 'PROPOSED',
    channelId: `channel-${id}`,
    messageId: `message-${id}`,
    challenger: { discordId: '1' },
    opponent: { discordId: '2' },
    witness: { discordId: '3' },
    winner: null,
    createdAt: new Date('2026-02-26T10:00:00.000Z'),
    ...extra,
  };
}

describe('jobs/expire-duels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start job and log startup message', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    startExpireDuelsJob({ channels: { fetch: vi.fn() } } as any);

    expect(logSpy).toHaveBeenCalledWith('Job expire-duels iniciado.');
    logSpy.mockRestore();
  });

  it('should do nothing when no duels are expiring', async () => {
    (prisma.duel.findMany as any).mockResolvedValue([]);
    const client = { channels: { fetch: vi.fn() } };

    startExpireDuelsJob(client as any);
    await vi.advanceTimersByTimeAsync(1000);

    expect(prisma.duel.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.duel.updateMany).not.toHaveBeenCalled();
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('should expire duels and update discord message when channel/message exist', async () => {
    const duel = makeDuel(1);
    const messageEdit = vi.fn().mockResolvedValue({});
    const messageFetch = vi.fn().mockResolvedValue({ edit: messageEdit });
    const channel = new (TextChannel as any)(messageFetch);
    const channelFetch = vi.fn().mockResolvedValue(channel);

    (prisma.duel.findMany as any).mockResolvedValue([duel]);
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (buildDuelEmbed as any).mockReturnValue({ title: 'expired' });

    startExpireDuelsJob({ channels: { fetch: channelFetch } } as any);
    await vi.advanceTimersByTimeAsync(1000);

    expect(prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, status: 'PROPOSED' },
      data: { status: 'EXPIRED' },
    });
    expect(channelFetch).toHaveBeenCalledWith('channel-1');
    expect(messageFetch).toHaveBeenCalledWith('message-1');
    expect(buildDuelEmbed).toHaveBeenCalledWith(expect.objectContaining({ id: 1, status: 'EXPIRED' }));
    expect(messageEdit).toHaveBeenCalledWith({ embeds: [{ title: 'expired' }], components: [] });
  });

  it('should skip discord update when channelId or messageId is missing', async () => {
    const duelA = makeDuel(1, { channelId: null });
    const duelB = makeDuel(2, { messageId: null });
    const channelFetch = vi.fn();
    (prisma.duel.findMany as any).mockResolvedValue([duelA, duelB]);
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 2 });

    startExpireDuelsJob({ channels: { fetch: channelFetch } } as any);
    await vi.advanceTimersByTimeAsync(1000);

    expect(prisma.duel.updateMany).toHaveBeenCalledTimes(1);
    expect(channelFetch).not.toHaveBeenCalled();
  });

  it('should skip discord update when fetched channel is not a TextChannel', async () => {
    const duel = makeDuel(3);
    const channelFetch = vi.fn().mockResolvedValue({ messages: { fetch: vi.fn() } });
    (prisma.duel.findMany as any).mockResolvedValue([duel]);
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });

    startExpireDuelsJob({ channels: { fetch: channelFetch } } as any);
    await vi.advanceTimersByTimeAsync(1000);

    expect(channelFetch).toHaveBeenCalledWith('channel-3');
    expect(buildDuelEmbed).not.toHaveBeenCalled();
  });

  it('should swallow per-duel errors when fetching/editing message fails', async () => {
    const duel = makeDuel(4);
    const channelFetch = vi.fn().mockRejectedValue(new Error('discord fetch failed'));
    (prisma.duel.findMany as any).mockResolvedValue([duel]);
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });

    startExpireDuelsJob({ channels: { fetch: channelFetch } } as any);

    await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow();
    expect(prisma.duel.updateMany).toHaveBeenCalledTimes(1);
  });

  it('should catch and log outer job errors', async () => {
    const error = new Error('db error');
    (prisma.duel.findMany as any).mockRejectedValue(error);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    startExpireDuelsJob({ channels: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(1000);

    expect(errorSpy).toHaveBeenCalledWith('Erro no job expire-duels:', error);
    errorSpy.mockRestore();
  });
});

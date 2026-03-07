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
  EXPIRY_WARNING_MS: 10 * 60 * 1000,
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    duel: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../services/duel.service', () => ({
  DUEL_INCLUDE: {
    challenger: true,
    opponent: true,
    witness: true,
    winner: true,
  },
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/notifications', () => ({
  notifyDuelExpired: vi.fn().mockResolvedValue(undefined),
  notifyDuelExpiringSoon: vi.fn().mockResolvedValue(undefined),
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
    // Default: no duels found (for both warning and expire queries)
    (prisma.duel.findMany as any).mockResolvedValue([]);
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start job and log startup message', async () => {
    startExpireDuelsJob({ channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);

    const { logger } = await import('../lib/logger');
    expect(logger.info).toHaveBeenCalledWith('Job expire-duels iniciado');
  });

  it('should run expire cycle immediately on startup', async () => {
    const client = { channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } };

    startExpireDuelsJob(client as any);
    await vi.advanceTimersByTimeAsync(0);

    // 1 warning findMany + 1 expire findMany from immediate run
    expect(prisma.duel.findMany).toHaveBeenCalledTimes(2);
  });

  it('should do nothing when no duels are expiring', async () => {
    const client = { channels: { fetch: vi.fn() } };

    startExpireDuelsJob(client as any);
    await vi.advanceTimersByTimeAsync(0); // immediate
    await vi.advanceTimersByTimeAsync(1000); // scheduled

    // 2 per cycle (warning + expire) x 2 cycles = 4
    expect(prisma.duel.findMany).toHaveBeenCalledTimes(4);
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('should expire duels and update discord message when channel/message exist', async () => {
    const duel = makeDuel(1);
    const messageEdit = vi.fn().mockResolvedValue({});
    const messageFetch = vi.fn().mockResolvedValue({ edit: messageEdit });
    const channel = new (TextChannel as any)(messageFetch);
    const channelFetch = vi.fn().mockResolvedValue(channel);

    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([]) // immediate: warning
      .mockResolvedValueOnce([]) // immediate: expire
      .mockResolvedValueOnce([]) // scheduled: warning
      .mockResolvedValue([duel]); // scheduled: expire
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });
    (buildDuelEmbed as any).mockReturnValue({ title: 'expired' });

    startExpireDuelsJob({ channels: { fetch: channelFetch }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);
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
    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([]) // immediate: warning
      .mockResolvedValueOnce([]) // immediate: expire
      .mockResolvedValueOnce([]) // scheduled: warning
      .mockResolvedValue([duelA, duelB]); // scheduled: expire
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 2 });

    startExpireDuelsJob({ channels: { fetch: channelFetch }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    expect(channelFetch).not.toHaveBeenCalled();
  });

  it('should log warning when embed update fails instead of silently catching', async () => {
    const duel = makeDuel(4);
    const channelFetch = vi.fn().mockRejectedValue(new Error('discord fetch failed'));
    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([]) // immediate: warning
      .mockResolvedValueOnce([]) // immediate: expire
      .mockResolvedValueOnce([]) // scheduled: warning
      .mockResolvedValue([duel]); // scheduled: expire
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });

    startExpireDuelsJob({ channels: { fetch: channelFetch }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);
    await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow();

    const { logger } = await import('../lib/logger');
    expect(logger.warn).toHaveBeenCalledWith(
      'Falha ao atualizar embed de duelo expirado',
      expect.objectContaining({ duelId: 4 }),
    );
  });

  it('should catch and log outer job errors', async () => {
    const error = new Error('db error');
    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([]) // immediate: warning
      .mockResolvedValueOnce([]) // immediate: expire
      .mockResolvedValueOnce([]) // scheduled: warning (succeeds)
      .mockRejectedValue(error); // scheduled: expire (fails)

    startExpireDuelsJob({ channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    const { logger } = await import('../lib/logger');
    expect(logger.error).toHaveBeenCalledWith('Erro no job expire-duels', { error: 'Error: db error' });
  });

  it('should schedule next cycle after current completes', async () => {
    const client = { channels: { fetch: vi.fn() } };

    startExpireDuelsJob(client as any);
    await vi.advanceTimersByTimeAsync(0); // immediate

    await vi.advanceTimersByTimeAsync(1000); // 1st scheduled
    await vi.advanceTimersByTimeAsync(1000); // 2nd scheduled

    // 2 per cycle x 3 cycles = 6
    expect(prisma.duel.findMany).toHaveBeenCalledTimes(6);
  });

  it('should call markJobSuccess after successful cycle', async () => {
    const client = { channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } };

    startExpireDuelsJob(client as any);
    await vi.advanceTimersByTimeAsync(0);

    const { markJobSuccess } = await import('../lib/job-health');
    expect(markJobSuccess).toHaveBeenCalledWith('expire-duels');
  });

  it('should not call markJobSuccess after failed cycle', async () => {
    const error = new Error('db error');
    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([]) // immediate: warning
      .mockResolvedValueOnce([]) // immediate: expire (success)
      .mockResolvedValueOnce([]) // scheduled: warning
      .mockRejectedValue(error); // scheduled: expire (fails)

    const { markJobSuccess } = await import('../lib/job-health');

    startExpireDuelsJob({ channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(markJobSuccess).mockClear();

    await vi.advanceTimersByTimeAsync(1000);
    expect(markJobSuccess).not.toHaveBeenCalled();
  });

  it('should send expiry warning and mark duels as warned', async () => {
    const duel = makeDuel(5, { expiryWarned: false });
    (prisma.duel.findMany as any)
      .mockResolvedValueOnce([duel]) // immediate: warning (finds duel to warn)
      .mockResolvedValueOnce([]); // immediate: expire (none to expire)
    (prisma.duel.updateMany as any).mockResolvedValue({ count: 1 });

    startExpireDuelsJob({ channels: { fetch: vi.fn() }, users: { fetch: vi.fn() } } as any);
    await vi.advanceTimersByTimeAsync(0);

    // updateMany called for warning flag
    expect(prisma.duel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [5] },
          expiryWarned: false,
        }),
        data: { expiryWarned: true },
      }),
    );

    const { notifyDuelExpiringSoon } = await import('../lib/notifications');
    expect(notifyDuelExpiringSoon).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 5 }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { getPendingDuels } from './pending.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findUnique: vi.fn(),
    },
    duel: {
      findMany: vi.fn(),
    },
  },
}));

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'PROPOSED',
    challengerId: 1,
    opponentId: 2,
    witnessId: 3,
    opponentAccepted: false,
    witnessAccepted: false,
    createdAt: new Date(),
    challenger: { discordId: 'u1' },
    opponent: { discordId: 'u2' },
    witness: { discordId: 'u3' },
    ...overrides,
  };
}

describe('pending.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should return empty array when player not found', async () => {
    (prisma.player.findUnique as any).mockResolvedValue(null);

    const result = await getPendingDuels('unknown', 1);

    expect(result).toEqual([]);
    expect(prisma.duel.findMany).not.toHaveBeenCalled();
  });

  it('should return empty array when no pending duels', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.duel.findMany as any).mockResolvedValue([]);

    const result = await getPendingDuels('u1', 1);

    expect(result).toEqual([]);
  });

  it('should assign urgency 2 for PROPOSED duels awaiting opponent acceptance', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 2 });
    (prisma.duel.findMany as any).mockResolvedValue([
      makeDuel({ opponentId: 2, opponentAccepted: false }),
    ]);

    const result = await getPendingDuels('u2', 1);

    expect(result).toHaveLength(1);
    expect(result[0].urgency).toBe(2);
  });

  it('should assign urgency 1 for AWAITING_VALIDATION when user is witness', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 3 });
    (prisma.duel.findMany as any).mockResolvedValue([
      makeDuel({ status: 'AWAITING_VALIDATION', witnessId: 3 }),
    ]);

    const result = await getPendingDuels('u3', 1);

    expect(result).toHaveLength(1);
    expect(result[0].urgency).toBe(1);
  });

  it('should assign urgency 0 for PROPOSED duels near expiry', async () => {
    vi.useFakeTimers();
    // Duel created 25 min ago (expiry is 30 min, warning at 20 min)
    const created = new Date(Date.now() - 25 * 60 * 1000);
    vi.setSystemTime(Date.now());

    (prisma.player.findUnique as any).mockResolvedValue({ id: 2 });
    (prisma.duel.findMany as any).mockResolvedValue([
      makeDuel({ opponentId: 2, opponentAccepted: false, createdAt: created }),
    ]);

    const result = await getPendingDuels('u2', 1);

    expect(result[0].urgency).toBe(0);
  });

  it('should assign urgency 3 for ACCEPTED duels', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.duel.findMany as any).mockResolvedValue([
      makeDuel({ status: 'ACCEPTED' }),
    ]);

    const result = await getPendingDuels('u1', 1);

    expect(result[0].urgency).toBe(3);
  });

  it('should sort by urgency ascending', async () => {
    (prisma.player.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.duel.findMany as any).mockResolvedValue([
      makeDuel({ id: 1, status: 'ACCEPTED' }),
      makeDuel({ id: 2, status: 'AWAITING_VALIDATION', witnessId: 1 }),
      makeDuel({ id: 3, status: 'IN_PROGRESS' }),
    ]);

    const result = await getPendingDuels('u1', 1);

    expect(result.map((d) => d.id)).toEqual([2, 1, 3]);
    expect(result.map((d) => d.urgency)).toEqual([1, 3, 4]);
  });
});

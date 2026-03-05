import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchDuelsByPlayer, searchDuelsByStatus } from './search.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: { findUnique: vi.fn() },
    duel: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';

describe('search.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchDuelsByPlayer', () => {
    it('should return empty array when player not found', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(null);
      const result = await searchDuelsByPlayer('unknown');
      expect(result).toEqual([]);
      expect(prisma.duel.findMany).not.toHaveBeenCalled();
    });

    it('should search duels where player is challenger, opponent or witness', async () => {
      (prisma.player.findUnique as any).mockResolvedValue({ id: 5, discordId: 'u1' });
      (prisma.duel.findMany as any).mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await searchDuelsByPlayer('u1');

      expect(prisma.player.findUnique).toHaveBeenCalledWith({ where: { discordId: 'u1' } });
      expect(prisma.duel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ challengerId: 5 }, { opponentId: 5 }, { witnessId: 5 }],
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('searchDuelsByStatus', () => {
    it('should search duels by status', async () => {
      (prisma.duel.findMany as any).mockResolvedValue([{ id: 3 }]);

      const result = await searchDuelsByStatus('IN_PROGRESS');

      expect(prisma.duel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'IN_PROGRESS' },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no duels match', async () => {
      (prisma.duel.findMany as any).mockResolvedValue([]);
      const result = await searchDuelsByStatus('PROPOSED');
      expect(result).toEqual([]);
    });
  });
});

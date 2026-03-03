import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logAdminAction, getAdminLogs } from './audit.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    adminActionLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('services/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAdminAction', () => {
    it('should create an audit log entry', async () => {
      mockCreate.mockResolvedValue({ id: 1 });

      await logAdminAction({
        action: 'CANCEL_DUEL',
        adminDiscordId: 'admin1',
        duelId: 10,
        reason: 'Duelo travado',
        previousStatus: 'IN_PROGRESS',
        newStatus: 'CANCELLED',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          action: 'CANCEL_DUEL',
          adminDiscordId: 'admin1',
          duelId: 10,
          reason: 'Duelo travado',
          previousStatus: 'IN_PROGRESS',
          newStatus: 'CANCELLED',
        },
      });
    });

    it('should handle missing optional fields with null', async () => {
      mockCreate.mockResolvedValue({ id: 2 });

      await logAdminAction({
        action: 'TEST_ACTION',
        adminDiscordId: 'admin2',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          action: 'TEST_ACTION',
          adminDiscordId: 'admin2',
          duelId: null,
          reason: null,
          previousStatus: null,
          newStatus: null,
        },
      });
    });

    it('should log error but not throw when create fails', async () => {
      mockCreate.mockRejectedValue(new Error('DB error'));

      await expect(
        logAdminAction({ action: 'FAIL', adminDiscordId: 'admin3' }),
      ).resolves.toBeUndefined();

      const { logger } = await import('../lib/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Falha ao gravar audit log',
        expect.objectContaining({ input: expect.any(Object) }),
      );
    });
  });

  describe('getAdminLogs', () => {
    it('should return logs for a duel ordered by createdAt desc', async () => {
      const logs = [{ id: 2 }, { id: 1 }];
      mockFindMany.mockResolvedValue(logs);

      const result = await getAdminLogs(10);

      expect(result).toEqual(logs);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { duelId: 10 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type LogAdminActionInput = {
  action: string;
  adminDiscordId: string;
  duelId?: number;
  reason?: string;
  previousStatus?: string;
  newStatus?: string;
};

export async function logAdminAction(input: LogAdminActionInput) {
  try {
    await prisma.adminActionLog.create({
      data: {
        action: input.action,
        adminDiscordId: input.adminDiscordId,
        duelId: input.duelId ?? null,
        reason: input.reason ?? null,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
      },
    });
  } catch (error) {
    logger.error('Falha ao gravar audit log', { input, error });
  }
}

export async function getAdminLogs(duelId: number) {
  return prisma.adminActionLog.findMany({
    where: { duelId },
    orderBy: { createdAt: 'desc' },
  });
}

import { Client, TextChannel } from 'discord.js';
import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { notifyDuelExpired, notifyDuelExpiringSoon } from '../lib/notifications';
import { DUEL_EXPIRY_MS, EXPIRE_CHECK_INTERVAL_MS, EXPIRY_WARNING_MS } from '../config';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { registerJob, markJobSuccess, checkJobHealth } from '../lib/job-health';

/**
 * Warn duels that are close to expiring (within EXPIRY_WARNING_MS)
 * but haven't been warned yet.
 */
async function runWarningCycle(client: Client) {
  try {
    const warningCutoff = new Date(Date.now() - (DUEL_EXPIRY_MS - EXPIRY_WARNING_MS));

    const duelsToWarn = await prisma.duel.findMany({
      where: {
        status: 'PROPOSED',
        expiryWarned: false,
        createdAt: { lt: warningCutoff },
      },
      include: DUEL_INCLUDE,
    });

    if (duelsToWarn.length === 0) return;

    await prisma.duel.updateMany({
      where: {
        id: { in: duelsToWarn.map((d) => d.id) },
        status: 'PROPOSED',
        expiryWarned: false,
      },
      data: { expiryWarned: true },
    });

    for (const duel of duelsToWarn) {
      notifyDuelExpiringSoon(client, duel).catch(() => {});
    }

    logger.info('Avisos de expiração enviados', {
      count: duelsToWarn.length,
      duelIds: duelsToWarn.map((d) => d.id),
    });
  } catch (error) {
    logger.warn('Falha no ciclo de aviso de expiração', { error: String(error) });
  }
}

async function runExpireCycle(client: Client) {
  checkJobHealth('expire-duels');
  const startTime = Date.now();
  let processed = 0;
  let embedFailures = 0;

  try {
    // Send warnings first, then expire
    await runWarningCycle(client);

    const cutoff = new Date(Date.now() - DUEL_EXPIRY_MS);

    const expiring = await withRetry(
      () =>
        prisma.duel.findMany({
          where: {
            status: 'PROPOSED',
            createdAt: { lt: cutoff },
          },
          include: DUEL_INCLUDE,
        }),
      'expire-duels:findMany',
    );

    if (expiring.length === 0) return;

    await withRetry(
      () =>
        prisma.duel.updateMany({
          where: {
            id: { in: expiring.map((d) => d.id) },
            status: 'PROPOSED',
          },
          data: { status: 'EXPIRED' },
        }),
      'expire-duels:updateMany',
    );

    processed = expiring.length;

    logger.info('Duelos expirados por timeout', {
      count: expiring.length,
      duelIds: expiring.map((d) => d.id),
    });

    for (const duel of expiring) {
      try {
        if (!duel.channelId || !duel.messageId) continue;

        const channel = await client.channels.fetch(duel.channelId);
        if (!channel || !(channel instanceof TextChannel)) continue;

        const message = await channel.messages.fetch(duel.messageId);
        const expiredDuel = { ...duel, status: 'EXPIRED' as const };
        const embed = buildDuelEmbed(expiredDuel);

        await message.edit({ embeds: [embed], components: [] });
      } catch (error) {
        embedFailures++;
        logger.warn('Falha ao atualizar embed de duelo expirado', {
          duelId: duel.id,
          channelId: duel.channelId,
          messageId: duel.messageId,
          error: String(error),
        });
      }

      notifyDuelExpired(client, { ...duel, status: 'EXPIRED' as const }).catch(() => {});
    }
  } catch (error) {
    logger.error('Erro no job expire-duels', { error: String(error) });
  } finally {
    const durationMs = Date.now() - startTime;
    if (processed > 0 || embedFailures > 0) {
      logger.info('Ciclo expire-duels concluído', { processed, embedFailures, durationMs });
    }
    markJobSuccess('expire-duels');
  }
}

export function startExpireDuelsJob(client: Client) {
  registerJob('expire-duels', EXPIRE_CHECK_INTERVAL_MS);

  // Run immediately on startup to catch duels that expired while bot was down
  runExpireCycle(client).catch(() => {});

  function scheduleNext() {
    setTimeout(async () => {
      await runExpireCycle(client);
      scheduleNext();
    }, EXPIRE_CHECK_INTERVAL_MS);
  }

  scheduleNext();
  logger.info('Job expire-duels iniciado');
}

import { Client, TextChannel } from 'discord.js';
import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { DUEL_EXPIRY_MS, EXPIRE_CHECK_INTERVAL_MS } from '../config';
import { logger } from '../lib/logger';

async function runExpireCycle(client: Client) {
  try {
    const cutoff = new Date(Date.now() - DUEL_EXPIRY_MS);

    const expiring = await prisma.duel.findMany({
      where: {
        status: 'PROPOSED',
        createdAt: { lt: cutoff },
      },
      include: DUEL_INCLUDE,
    });

    if (expiring.length === 0) return;

    await prisma.duel.updateMany({
      where: {
        id: { in: expiring.map((d) => d.id) },
        status: 'PROPOSED',
      },
      data: { status: 'EXPIRED' },
    });

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
      } catch {
        // Channel/message may have been deleted, ignore
      }
    }
  } catch (error) {
    logger.error('Erro no job expire-duels', { error: String(error) });
  }
}

export function startExpireDuelsJob(client: Client) {
  function scheduleNext() {
    setTimeout(async () => {
      await runExpireCycle(client);
      scheduleNext();
    }, EXPIRE_CHECK_INTERVAL_MS);
  }

  scheduleNext();
  logger.info('Job expire-duels iniciado');
}

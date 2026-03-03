import { Client, TextChannel } from 'discord.js';
import { prisma } from '../lib/prisma';
import { DUEL_INCLUDE } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { logger } from '../lib/logger';

const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Finds terminal duels from the last 24h and ensures their Discord embeds
 * have no action buttons. This catches cases where the bot went down
 * after transitioning a duel but before updating the message.
 */
export async function reconcileStaleEmbeds(client: Client): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RECONCILE_WINDOW_MS);

    const staleDuels = await prisma.duel.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CANCELLED', 'EXPIRED'] },
        updatedAt: { gte: cutoff },
        messageId: { not: null },
      },
      include: DUEL_INCLUDE,
    });

    if (staleDuels.length === 0) return;

    let reconciled = 0;

    for (const duel of staleDuels) {
      try {
        if (!duel.channelId || !duel.messageId) continue;

        const channel = await client.channels.fetch(duel.channelId);
        if (!channel || !(channel instanceof TextChannel)) continue;

        const message = await channel.messages.fetch(duel.messageId);

        // Only update if message still has action buttons
        if (message.components.length === 0) continue;

        const embed = buildDuelEmbed(duel);
        await message.edit({ embeds: [embed], components: [] });
        reconciled++;
      } catch {
        // Channel/message may have been deleted, skip
      }
    }

    if (reconciled > 0) {
      logger.info('Embeds reconciliados no startup', {
        checked: staleDuels.length,
        reconciled,
      });
    }
  } catch (error) {
    logger.warn('Falha na reconciliação de embeds', { error: String(error) });
  }
}

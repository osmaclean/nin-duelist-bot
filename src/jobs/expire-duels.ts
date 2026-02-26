import { Client, TextChannel } from 'discord.js';
import { prisma } from '../lib/prisma';
import { buildDuelEmbed } from '../lib/embeds';
import { DUEL_EXPIRY_MS, EXPIRE_CHECK_INTERVAL_MS } from '../config';

const DUEL_INCLUDE = {
  challenger: true,
  opponent: true,
  witness: true,
  winner: true,
} as const;

export function startExpireDuelsJob(client: Client) {
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - DUEL_EXPIRY_MS);

      // Find duels to expire (before updating) so we can update their messages
      const expiring = await prisma.duel.findMany({
        where: {
          status: 'PROPOSED',
          createdAt: { lt: cutoff },
        },
        include: DUEL_INCLUDE,
      });

      if (expiring.length === 0) return;

      // Expire them in the database
      await prisma.duel.updateMany({
        where: {
          id: { in: expiring.map((d) => d.id) },
          status: 'PROPOSED',
        },
        data: { status: 'EXPIRED' },
      });

      console.log(`Expirados ${expiring.length} duelo(s) por timeout.`);

      // Update Discord messages
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
      console.error('Erro no job expire-duels:', error);
    }
  }, EXPIRE_CHECK_INTERVAL_MS);

  console.log('Job expire-duels iniciado.');
}

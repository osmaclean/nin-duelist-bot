import { Client } from 'discord.js';
import { DuelWithPlayers } from '../services/duel.service';
import { logger } from './logger';

/**
 * Notifica a testemunha por DM que o resultado precisa de validação.
 * Se a DM falhar (privacidade), tenta fallback no canal do duelo.
 * Fire-and-forget — nunca lança exceção.
 */
export async function notifyWitnessValidation(client: Client, duel: DuelWithPlayers): Promise<void> {
  const witnessDiscordId = duel.witness.discordId;
  const message =
    `**Duelo #${duel.id}** — <@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `Placar enviado: **${duel.scoreWinner}-${duel.scoreLoser}**\n` +
    `Precisa da sua validação! Vá até o canal do duelo para confirmar ou rejeitar.`;

  try {
    const user = await client.users.fetch(witnessDiscordId);
    await user.send(message);
    logger.info('DM de validação enviada para testemunha', { duelId: duel.id, witnessId: witnessDiscordId });
  } catch {
    logger.warn('Falha ao enviar DM para testemunha, tentando fallback no canal', { duelId: duel.id, witnessId: witnessDiscordId });

    if (duel.channelId) {
      try {
        const channel = await client.channels.fetch(duel.channelId);
        if (channel && 'send' in channel) {
          await (channel as any).send(`<@${witnessDiscordId}> — ${message}`);
        }
      } catch {
        logger.error('Falha no fallback de notificação no canal', { duelId: duel.id, channelId: duel.channelId });
      }
    }
  }
}

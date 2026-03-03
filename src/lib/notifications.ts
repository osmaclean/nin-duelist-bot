import { Client } from 'discord.js';
import { DuelWithPlayers } from '../services/duel.service';
import { logger } from './logger';

/**
 * Envia DM para um usuário. Se falhar, tenta fallback no canal do duelo.
 * Fire-and-forget — nunca lança exceção.
 */
async function sendDmWithFallback(
  client: Client,
  discordId: string,
  message: string,
  duelId: number,
  channelId: string | null,
): Promise<void> {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(message);
  } catch {
    logger.warn('Falha ao enviar DM, tentando fallback no canal', { duelId, discordId });

    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && 'send' in channel) {
          await (channel as any).send(`<@${discordId}> — ${message}`);
        }
      } catch {
        logger.error('Falha no fallback de notificação no canal', { duelId, channelId });
      }
    }
  }
}

/**
 * Notifica oponente e testemunha que um novo duelo foi criado.
 */
export async function notifyDuelCreated(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Você foi convocado!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}> (${duel.format})\n` +
    `Aceite no canal do duelo antes que expire!`;

  await Promise.all([
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.witness.discordId,
      `**Duelo #${duel.id}** — Você foi escolhido como testemunha!\n` +
      `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}> (${duel.format})\n` +
      `Aceite no canal do duelo antes que expire!`,
      duel.id, duel.channelId),
  ]);

  logger.info('Notificação de duelo criado enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que o duelo foi aceito e está pronto para iniciar.
 */
export async function notifyDuelAccepted(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Todos aceitaram!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `O duelo está pronto para iniciar. Vá ao canal e clique em "Iniciar Duelo"!`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de duelo aceito enviada', { duelId: duel.id });
}

/**
 * Notifica a testemunha por DM que o resultado precisa de validação.
 */
export async function notifyWitnessValidation(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — <@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `Placar enviado: **${duel.scoreWinner}-${duel.scoreLoser}**\n` +
    `Precisa da sua validação! Vá até o canal do duelo para confirmar ou rejeitar.`;

  await sendDmWithFallback(client, duel.witness.discordId, message, duel.id, duel.channelId);
  logger.info('DM de validação enviada para testemunha', { duelId: duel.id, witnessId: duel.witness.discordId });
}

/**
 * Notifica ambos duelistas que o resultado foi confirmado.
 */
export async function notifyDuelConfirmed(client: Client, duel: DuelWithPlayers): Promise<void> {
  const winnerTag = duel.winnerId === duel.challengerId
    ? `<@${duel.challenger.discordId}>`
    : `<@${duel.opponent.discordId}>`;

  const message =
    `**Duelo #${duel.id}** — Resultado confirmado!\n` +
    `Vencedor: ${winnerTag} (**${duel.scoreWinner}-${duel.scoreLoser}**)\n` +
    `Pontos atualizados no ranking.`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de duelo confirmado enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que o resultado foi rejeitado pela testemunha.
 */
export async function notifyResultRejected(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Resultado rejeitado pela testemunha!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `Envie o resultado correto no canal do duelo.`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de resultado rejeitado enviada', { duelId: duel.id });
}

/**
 * Notifica todos os participantes que o duelo está prestes a expirar.
 */
export async function notifyDuelExpiringSoon(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Expirando em breve!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `Aceitem no canal do duelo antes que expire!`;

  await Promise.all([
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.witness.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de duelo expirando enviada', { duelId: duel.id });
}

/**
 * Notifica todos os participantes que o duelo expirou.
 */
export async function notifyDuelExpired(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Expirado!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `O duelo expirou por falta de aceitação a tempo.`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.witness.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de duelo expirado enviada', { duelId: duel.id });
}

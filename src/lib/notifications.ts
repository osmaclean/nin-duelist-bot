import { Client, TextChannel } from 'discord.js';
import { DuelWithPlayers } from '../services/duel.service';
import { logger } from './logger';
import { prisma } from './prisma';
import { checkCooldown } from './cooldown';
import { NOTIFICATION_COOLDOWN_MS } from '../config';
import {
  trackDmSent,
  trackDmFailed,
  trackChannelFallbackSent,
  trackChannelFallbackFailed,
  trackThrottled,
} from './notification-metrics';

/**
 * Checks if a user has DMs enabled. Returns true if player not found (new player, default on).
 */
async function isDmEnabled(discordId: string): Promise<boolean> {
  try {
    const player = await prisma.player.findUnique({ where: { discordId }, select: { dmEnabled: true } });
    return player?.dmEnabled ?? true;
  } catch {
    return true; // default to sending on error
  }
}

/**
 * Envia DM para um usuário. Se falhar ou DM desativada, tenta fallback no canal do duelo.
 * Fire-and-forget — nunca lança exceção.
 */
async function sendDmWithFallback(
  client: Client,
  discordId: string,
  message: string,
  duelId: number,
  channelId: string | null,
): Promise<void> {
  const dmEnabled = await isDmEnabled(discordId);

  if (dmEnabled) {
    try {
      const user = await client.users.fetch(discordId);
      await user.send(message);
      trackDmSent();
      return;
    } catch {
      trackDmFailed();
      logger.warn('Falha ao enviar DM, tentando fallback no canal', { duelId, discordId });
    }
  }

  // Fallback to channel (DM disabled or failed)
  if (channelId) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && 'send' in channel) {
        await (channel as TextChannel).send(`<@${discordId}> — ${message}`);
        trackChannelFallbackSent();
      }
    } catch {
      trackChannelFallbackFailed();
      logger.error('Falha no fallback de notificação no canal', { duelId, channelId });
    }
  }
}

/**
 * Sends notification with per-user per-event cooldown. Returns false if throttled.
 */
async function sendWithCooldown(
  client: Client,
  discordId: string,
  message: string,
  duelId: number,
  channelId: string | null,
  eventType: string,
): Promise<boolean> {
  const key = `notif:${discordId}:${eventType}`;
  if (!checkCooldown(key, NOTIFICATION_COOLDOWN_MS)) {
    trackThrottled();
    logger.info('Notificação throttled por cooldown', { duelId, discordId, eventType });
    return false;
  }
  await sendDmWithFallback(client, discordId, message, duelId, channelId);
  return true;
}

/**
 * Notifica oponente e testemunha que um novo duelo foi criado.
 */
export async function notifyDuelCreated(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Você foi desafiado!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}> (${duel.format})\n` +
    `Aceite no canal do duelo antes que expire!`;

  await Promise.all([
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'duel-created'),
    sendWithCooldown(
      client,
      duel.witness.discordId,
      `**Duelo #${duel.id}** — Você foi escolhido como testemunha!\n` +
        `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}> (${duel.format})\n` +
        `Você validará o resultado quando o duelo terminar.`,
      duel.id,
      duel.channelId,
      'duel-created',
    ),
  ]);

  logger.info('Notificação de duelo criado enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que o duelo foi aceito e está pronto para iniciar.
 */
export async function notifyDuelAccepted(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Oponente aceitou!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `O duelo está pronto para iniciar. Vá ao canal e clique em "Iniciar Duelo"!`;

  await Promise.all([
    sendWithCooldown(client, duel.challenger.discordId, message, duel.id, duel.channelId, 'duel-accepted'),
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'duel-accepted'),
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

  await sendWithCooldown(client, duel.witness.discordId, message, duel.id, duel.channelId, 'witness-validation');
  logger.info('DM de validação enviada para testemunha', { duelId: duel.id, witnessId: duel.witness.discordId });
}

/**
 * Notifica ambos duelistas que o resultado foi confirmado.
 */
export async function notifyDuelConfirmed(client: Client, duel: DuelWithPlayers): Promise<void> {
  const winnerTag =
    duel.winnerId === duel.challengerId ? `<@${duel.challenger.discordId}>` : `<@${duel.opponent.discordId}>`;

  const message =
    `**Duelo #${duel.id}** — Resultado confirmado!\n` +
    `Vencedor: ${winnerTag} (**${duel.scoreWinner}-${duel.scoreLoser}**)\n` +
    `Pontos atualizados no ranking.`;

  await Promise.all([
    sendWithCooldown(client, duel.challenger.discordId, message, duel.id, duel.channelId, 'duel-confirmed'),
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'duel-confirmed'),
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
    sendWithCooldown(client, duel.challenger.discordId, message, duel.id, duel.channelId, 'result-rejected'),
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'result-rejected'),
  ]);

  logger.info('Notificação de resultado rejeitado enviada', { duelId: duel.id });
}

/**
 * Notifica oponente e testemunha que o duelo está prestes a expirar.
 */
export async function notifyDuelExpiringSoon(client: Client, duel: DuelWithPlayers): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Expirando em breve!\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `Aceite no canal do duelo antes que expire!`;

  await Promise.all([
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'duel-expiring'),
    sendWithCooldown(client, duel.witness.discordId, message, duel.id, duel.channelId, 'duel-expiring'),
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
    sendWithCooldown(client, duel.challenger.discordId, message, duel.id, duel.channelId, 'duel-expired'),
    sendWithCooldown(client, duel.opponent.discordId, message, duel.id, duel.channelId, 'duel-expired'),
    sendWithCooldown(client, duel.witness.discordId, message, duel.id, duel.channelId, 'duel-expired'),
  ]);

  logger.info('Notificação de duelo expirado enviada', { duelId: duel.id });
}

// ─── Admin action notifications ─────────────────────────────────

/**
 * Notifica ambos duelistas que um admin cancelou o duelo.
 */
export async function notifyAdminCancel(client: Client, duel: DuelWithPlayers, reason: string): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Cancelado por um administrador.\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `**Motivo:** ${reason}`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de cancelamento admin enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que um admin reabriu o duelo.
 */
export async function notifyAdminReopen(client: Client, duel: DuelWithPlayers, reason: string): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Reaberto por um administrador.\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `O duelo voltou para IN_PROGRESS. Envie o resultado no canal do duelo.\n` +
    `**Motivo:** ${reason}`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de reabertura admin enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que um admin forçou a expiração do duelo.
 */
export async function notifyAdminForceExpire(client: Client, duel: DuelWithPlayers, reason: string): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Expirado por um administrador.\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `**Motivo:** ${reason}`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de expiração admin enviada', { duelId: duel.id });
}

/**
 * Notifica ambos duelistas que um admin corrigiu o resultado do duelo.
 */
export async function notifyAdminFixResult(
  client: Client,
  duel: DuelWithPlayers,
  newWinnerDiscordId: string,
  scoreWinner: number,
  scoreLoser: number,
  reason: string,
): Promise<void> {
  const message =
    `**Duelo #${duel.id}** — Resultado corrigido por um administrador.\n` +
    `<@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}>\n` +
    `**Novo resultado:** <@${newWinnerDiscordId}> venceu (${scoreWinner}-${scoreLoser})\n` +
    `**Motivo:** ${reason}`;

  await Promise.all([
    sendDmWithFallback(client, duel.challenger.discordId, message, duel.id, duel.channelId),
    sendDmWithFallback(client, duel.opponent.discordId, message, duel.id, duel.channelId),
  ]);

  logger.info('Notificação de correção admin enviada', { duelId: duel.id });
}

// ─── Season ending notification ─────────────────────────────────

/**
 * Notifica todos os jogadores ativos que a season está encerrando em 24h.
 * Destinatários: todos os jogadores com PlayerSeason na season ativa.
 */
export async function notifySeasonEnding(client: Client, seasonId: number, seasonNumber: number): Promise<void> {
  const playerSeasons = await prisma.playerSeason.findMany({
    where: { seasonId },
    include: { player: true },
  });

  const message =
    `**Season ${seasonNumber}** — Encerrando em menos de 24 horas!\n` +
    `Aproveite para jogar seus últimos duelos antes do fechamento.`;

  await Promise.all(
    playerSeasons.map((ps) => sendDmWithFallback(client, ps.player.discordId, message, 0, null)),
  );

  logger.info('Notificação de season encerrando enviada', { seasonId, recipients: playerSeasons.length });
}

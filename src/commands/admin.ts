import { ChatInputCommandInteraction, EmbedBuilder, Colors, GuildMemberRoleManager, TextChannel } from 'discord.js';
import { DuelStatus } from '@prisma/client';
import { getDuelById, cancelDuel, reopenDuel, forceExpireDuel, adminFixResult } from '../services/duel.service';
import { reverseResult, applyResult } from '../services/player.service';
import {
  getActiveSeason,
  getSeasonStatus,
  getSeasonPodium,
  adminEndSeason,
  adminCreateSeason,
  repairSeasonStats,
} from '../services/season.service';
import { searchDuelsByPlayer, searchDuelsByStatus } from '../services/search.service';
import { buildDuelEmbed } from '../lib/embeds';
import { ADMIN_ROLE_IDS, SEASON_DURATION_DAYS } from '../config';
import { logger } from '../lib/logger';
import { logAdminAction, getAdminLogs } from '../services/audit.service';
import { prisma } from '../lib/prisma';
import {
  notifyAdminCancel,
  notifyAdminReopen,
  notifyAdminForceExpire,
  notifyAdminFixResult,
} from '../lib/notifications';
import { sanitizeText, validateScore } from '../lib/validation';

function hasAdminRole(interaction: ChatInputCommandInteraction): boolean {
  if (ADMIN_ROLE_IDS.length === 0) return false;

  const roles = interaction.member?.roles;
  if (!roles) return false;

  // GuildMemberRoleManager (gateway interaction) has cache.has()
  if ('cache' in roles && typeof (roles as GuildMemberRoleManager).cache?.has === 'function') {
    return ADMIN_ROLE_IDS.some((id) => (roles as GuildMemberRoleManager).cache.has(id));
  }

  // API interaction: roles is string[]
  if (Array.isArray(roles)) {
    return ADMIN_ROLE_IDS.some((id) => roles.includes(id));
  }

  return false;
}

export async function handleAdminCommand(interaction: ChatInputCommandInteraction) {
  if (!hasAdminRole(interaction)) {
    await interaction.reply({ content: 'Você não tem permissão para usar comandos admin.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  const subcommandGroup = interaction.options.getSubcommandGroup(false);

  if (subcommandGroup === 'season') {
    switch (subcommand) {
      case 'status':
        return handleSeasonStatus(interaction);
      case 'end':
        return handleSeasonEnd(interaction);
      case 'create':
        return handleSeasonCreate(interaction);
      case 'repair':
        return handleSeasonRepair(interaction);
    }
    return;
  }

  if (subcommandGroup === 'search') {
    switch (subcommand) {
      case 'player':
        return handleSearchPlayer(interaction);
      case 'status':
        return handleSearchStatus(interaction);
    }
    return;
  }

  switch (subcommand) {
    case 'cancel':
      return handleAdminCancel(interaction);
    case 'reopen':
      return handleAdminReopen(interaction);
    case 'force-expire':
      return handleAdminForceExpire(interaction);
    case 'fix-result':
      return handleAdminFixResult(interaction);
    case 'logs':
      return handleAdminLogs(interaction);
  }
}

/** Update original duel embed (best-effort) */
async function updateOriginalEmbed(
  interaction: ChatInputCommandInteraction,
  duel: { channelId: string; messageId: string | null },
  updated: Parameters<typeof buildDuelEmbed>[0],
) {
  if (!duel.channelId || !duel.messageId) return;
  try {
    const channel = await interaction.client.channels.fetch(duel.channelId);
    if (channel && 'messages' in channel) {
      const message = await (channel as TextChannel).messages.fetch(duel.messageId);
      const embed = buildDuelEmbed(updated);
      await message.edit({ embeds: [embed], components: [] });
    }
  } catch {
    // Channel or message may be deleted
  }
}

// ─── /admin cancel ──────────────────────────────────────────────

async function handleAdminCancel(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);
  const reason = sanitizeText(interaction.options.getString('reason', true));

  await interaction.deferReply({ ephemeral: true });

  const duel = await getDuelById(duelId);
  if (!duel) {
    await interaction.editReply(`Duelo #${duelId} não encontrado.`);
    return;
  }

  const terminalStatuses = ['CONFIRMED', 'CANCELLED', 'EXPIRED'];
  if (terminalStatuses.includes(duel.status)) {
    await interaction.editReply(`Duelo #${duelId} já está em estado terminal (${duel.status}).`);
    return;
  }

  const cancelled = await cancelDuel(duelId);
  if (!cancelled) {
    await interaction.editReply(`Erro ao cancelar duelo #${duelId}.`);
    return;
  }

  logger.info('Admin cancelou duelo', {
    duelId,
    adminId: interaction.user.id,
    previousStatus: duel.status,
    reason,
  });

  await logAdminAction({
    action: 'CANCEL_DUEL',
    adminDiscordId: interaction.user.id,
    duelId,
    reason,
    previousStatus: duel.status,
    newStatus: 'CANCELLED',
  });

  await updateOriginalEmbed(interaction, duel, cancelled);

  notifyAdminCancel(interaction.client, cancelled, reason).catch(() => {});

  await interaction.editReply(
    `Duelo #${duelId} cancelado com sucesso.\n**Motivo:** ${reason}\n**Status anterior:** ${duel.status}`,
  );
}

// ─── /admin reopen ──────────────────────────────────────────────

async function handleAdminReopen(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);
  const reason = sanitizeText(interaction.options.getString('reason', true));

  await interaction.deferReply({ ephemeral: true });

  const duel = await getDuelById(duelId);
  if (!duel) {
    await interaction.editReply(`Duelo #${duelId} não encontrado.`);
    return;
  }

  const nonTerminalStatuses = ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_VALIDATION'];
  if (nonTerminalStatuses.includes(duel.status)) {
    await interaction.editReply(
      `Duelo #${duelId} não está em estado terminal (${duel.status}). Não é possível reabrir.`,
    );
    return;
  }

  // If the duel was CONFIRMED, we need to reverse the stats
  if (duel.status === 'CONFIRMED' && duel.winnerId) {
    const loserId = duel.winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
    await reverseResult(duel.winnerId, loserId, duel.seasonId);
  }

  const reopened = await reopenDuel(duelId);
  if (!reopened) {
    await interaction.editReply(`Erro ao reabrir duelo #${duelId}.`);
    return;
  }

  logger.info('Admin reabriu duelo', {
    duelId,
    adminId: interaction.user.id,
    previousStatus: duel.status,
    reason,
  });

  await logAdminAction({
    action: 'REOPEN_DUEL',
    adminDiscordId: interaction.user.id,
    duelId,
    reason,
    previousStatus: duel.status,
    newStatus: 'IN_PROGRESS',
  });

  await updateOriginalEmbed(interaction, duel, reopened);

  notifyAdminReopen(interaction.client, reopened, reason).catch(() => {});

  await interaction.editReply(
    `Duelo #${duelId} reaberto para IN_PROGRESS.\n**Motivo:** ${reason}\n**Status anterior:** ${duel.status}`,
  );
}

// ─── /admin force-expire ────────────────────────────────────────

async function handleAdminForceExpire(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);
  const reason = sanitizeText(interaction.options.getString('reason', true));

  await interaction.deferReply({ ephemeral: true });

  const duel = await getDuelById(duelId);
  if (!duel) {
    await interaction.editReply(`Duelo #${duelId} não encontrado.`);
    return;
  }

  const terminalStatuses = ['CONFIRMED', 'CANCELLED', 'EXPIRED'];
  if (terminalStatuses.includes(duel.status)) {
    await interaction.editReply(`Duelo #${duelId} já está em estado terminal (${duel.status}).`);
    return;
  }

  const expired = await forceExpireDuel(duelId);
  if (!expired) {
    await interaction.editReply(`Erro ao expirar duelo #${duelId}.`);
    return;
  }

  logger.info('Admin forçou expiração', {
    duelId,
    adminId: interaction.user.id,
    previousStatus: duel.status,
    reason,
  });

  await logAdminAction({
    action: 'FORCE_EXPIRE',
    adminDiscordId: interaction.user.id,
    duelId,
    reason,
    previousStatus: duel.status,
    newStatus: 'EXPIRED',
  });

  await updateOriginalEmbed(interaction, duel, expired);

  notifyAdminForceExpire(interaction.client, expired, reason).catch(() => {});

  await interaction.editReply(
    `Duelo #${duelId} expirado forçadamente.\n**Motivo:** ${reason}\n**Status anterior:** ${duel.status}`,
  );
}

// ─── /admin fix-result ──────────────────────────────────────────

async function handleAdminFixResult(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);
  const winnerUser = interaction.options.getUser('winner', true);
  const score = interaction.options.getString('score', true);
  const reason = sanitizeText(interaction.options.getString('reason', true));

  await interaction.deferReply({ ephemeral: true });

  const duel = await getDuelById(duelId);
  if (!duel) {
    await interaction.editReply(`Duelo #${duelId} não encontrado.`);
    return;
  }

  if (duel.status !== 'CONFIRMED') {
    await interaction.editReply(`Duelo #${duelId} não está confirmado (${duel.status}). Use reopen se necessário.`);
    return;
  }

  // Validate winner is a participant
  const newWinnerId =
    winnerUser.id === duel.challenger.discordId
      ? duel.challengerId
      : winnerUser.id === duel.opponent.discordId
        ? duel.opponentId
        : null;

  if (!newWinnerId) {
    await interaction.editReply(`<@${winnerUser.id}> não é participante do duelo #${duelId}.`);
    return;
  }

  // Parse score (format: "2-1" or "1-0")
  const scoreParts = score.split('-').map(Number);
  if (scoreParts.length !== 2 || scoreParts.some(isNaN)) {
    await interaction.editReply('Placar inválido. Use o formato `W-L` (ex: `2-1`, `1-0`).');
    return;
  }
  const [scoreWinner, scoreLoser] = scoreParts;

  if (!validateScore(duel.format, scoreWinner, scoreLoser)) {
    const validScores = duel.format === 'MD1' ? '1-0' : '2-0 ou 2-1';
    await interaction.editReply(`Placar inválido para ${duel.format}. Placares válidos: ${validScores}.`);
    return;
  }

  // Reverse old result, apply new result, update duel — all in one transaction
  const oldWinnerId = duel.winnerId;
  const oldLoserId = oldWinnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
  const newLoserId = newWinnerId === duel.challengerId ? duel.opponentId : duel.challengerId;

  const fixed = await prisma.$transaction(async (tx) => {
    // Reverse old stats
    if (oldWinnerId) {
      await reverseResult(oldWinnerId, oldLoserId, duel.seasonId, tx);
    }

    // Apply new stats
    await applyResult(newWinnerId, newLoserId, duel.seasonId, tx);

    // Update duel record
    return adminFixResult(duelId, newWinnerId, scoreWinner, scoreLoser, tx);
  }, { timeout: 10_000 });

  if (!fixed) {
    await interaction.editReply(`Erro ao corrigir resultado do duelo #${duelId}.`);
    return;
  }

  logger.info('Admin corrigiu resultado', {
    duelId,
    adminId: interaction.user.id,
    oldWinnerId,
    newWinnerId,
    score: `${scoreWinner}-${scoreLoser}`,
    reason,
  });

  await logAdminAction({
    action: 'FIX_RESULT',
    adminDiscordId: interaction.user.id,
    duelId,
    reason,
    previousStatus: 'CONFIRMED',
    newStatus: 'CONFIRMED',
  });

  await updateOriginalEmbed(interaction, duel, fixed);

  notifyAdminFixResult(interaction.client, fixed!, winnerUser.id, scoreWinner, scoreLoser, reason).catch(() => {});

  await interaction.editReply(
    `Resultado do duelo #${duelId} corrigido.\n**Novo vencedor:** <@${winnerUser.id}> (${scoreWinner}-${scoreLoser})\n**Motivo:** ${reason}`,
  );
}

// ─── /admin logs ────────────────────────────────────────────────

async function handleAdminLogs(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);

  await interaction.deferReply({ ephemeral: true });

  const logs = await getAdminLogs(duelId);

  if (logs.length === 0) {
    await interaction.editReply(`Nenhuma ação admin registrada para o duelo #${duelId}.`);
    return;
  }

  const lines = logs.map((log) => {
    const date = log.createdAt.toISOString().slice(0, 16).replace('T', ' ');
    const status = log.previousStatus && log.newStatus ? ` (${log.previousStatus} → ${log.newStatus})` : '';
    return `\`${date}\` **${log.action}**${status} por <@${log.adminDiscordId}>${log.reason ? `\n> ${log.reason}` : ''}`;
  });

  await interaction.editReply(`**Histórico admin — Duelo #${duelId}**\n\n${lines.join('\n\n')}`);
}

// ─── /admin season status ───────────────────────────────────────

async function handleSeasonStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const stats = await getSeasonStatus(season.id);
  if (!stats) {
    await interaction.editReply('Erro ao buscar dados da season.');
    return;
  }

  const daysLeft = Math.max(0, Math.ceil((stats.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const name = stats.name ? ` — ${stats.name}` : '';

  const embed = new EmbedBuilder()
    .setTitle(`Season ${stats.number}${name}`)
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Início', value: stats.startDate.toISOString().slice(0, 10), inline: true },
      { name: 'Término', value: stats.endDate.toISOString().slice(0, 10), inline: true },
      { name: 'Dias restantes', value: `${daysLeft}`, inline: true },
      { name: 'Total de duelos', value: `${stats.totalDuels}`, inline: true },
      { name: 'Jogadores ativos', value: `${stats.activePlayers}`, inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

// ─── /admin season end ──────────────────────────────────────────

async function handleSeasonEnd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa para encerrar.');
    return;
  }

  // Get podium before closing
  const podium = await getSeasonPodium(season.id);

  await adminEndSeason(season.id);

  await logAdminAction({
    action: 'END_SEASON',
    adminDiscordId: interaction.user.id,
    reason: `Season ${season.number} encerrada manualmente`,
  });

  logger.info('Admin encerrou season', {
    seasonId: season.id,
    seasonNumber: season.number,
    adminId: interaction.user.id,
  });

  // Build podium embed
  const medals = ['🥇', '🥈', '🥉'];
  const podiumLines = podium.map(
    (p) => `${medals[p.rank - 1]} <@${p.discordId}> — ${p.points}pts | ${p.wins}V ${p.losses}D | Peak: ${p.peakStreak}`,
  );

  const seasonName = season.name ? ` — ${season.name}` : '';
  const embed = new EmbedBuilder()
    .setTitle(`Season ${season.number}${seasonName} — Encerrada`)
    .setColor(Colors.Gold)
    .setDescription(
      podiumLines.length ? `**Pódio**\n\n${podiumLines.join('\n')}` : 'Nenhum jogador participou desta season.',
    );

  // Send podium in the channel (public, not ephemeral)
  try {
    const channel = interaction.channel;
    if (channel && 'send' in channel) {
      await (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch {
    // Channel may not be available
  }

  await interaction.editReply(
    `Season ${season.number} encerrada com sucesso.${podium.length ? `\nCampeão: <@${podium[0].discordId}>` : ''}`,
  );
}

// ─── /admin season create ───────────────────────────────────────

async function handleSeasonCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if there's already an active season
  const existing = await getActiveSeason();
  if (existing) {
    await interaction.editReply(
      `Já existe uma season ativa (Season ${existing.number}). Encerre-a primeiro com \`/admin season end\`.`,
    );
    return;
  }

  const name = interaction.options.getString('name') ?? null;
  const duration = interaction.options.getInteger('duration') ?? SEASON_DURATION_DAYS;

  const season = await adminCreateSeason(name, duration);

  await logAdminAction({
    action: 'CREATE_SEASON',
    adminDiscordId: interaction.user.id,
    reason: `Season ${season.number} criada${name ? ` (${name})` : ''}, duração: ${duration} dias`,
  });

  logger.info('Admin criou season', {
    seasonId: season.id,
    seasonNumber: season.number,
    name,
    duration,
    adminId: interaction.user.id,
  });

  const seasonName = name ? ` — ${name}` : '';
  await interaction.editReply(
    `Season ${season.number}${seasonName} criada com sucesso.\n**Início:** ${season.startDate.toISOString().slice(0, 10)}\n**Término:** ${season.endDate.toISOString().slice(0, 10)}`,
  );
}

// ─── /admin search player ──────────────────────────────────────

async function handleSearchPlayer(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('player', true);

  await interaction.deferReply({ ephemeral: true });

  const duels = await searchDuelsByPlayer(user.id);

  if (duels.length === 0) {
    await interaction.editReply(`Nenhum duelo encontrado para <@${user.id}>.`);
    return;
  }

  const lines = duels.map((d) => {
    const date = d.createdAt.toISOString().slice(0, 10);
    const score = d.scoreWinner !== null ? ` (${d.scoreWinner}-${d.scoreLoser})` : '';
    return `\`#${d.id}\` ${d.status} — <@${d.challenger.discordId}> vs <@${d.opponent.discordId}>${score} — ${date}`;
  });

  await interaction.editReply(`**Duelos de <@${user.id}>** (últimos ${duels.length})\n\n${lines.join('\n')}`);
}

// ─── /admin search status ──────────────────────────────────────

const VALID_STATUSES = [
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'AWAITING_VALIDATION',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
];

async function handleSearchStatus(interaction: ChatInputCommandInteraction) {
  const status = interaction.options.getString('status', true);

  await interaction.deferReply({ ephemeral: true });

  if (!VALID_STATUSES.includes(status)) {
    await interaction.editReply(`Status inválido: \`${status}\`. Válidos: ${VALID_STATUSES.join(', ')}`);
    return;
  }

  const duels = await searchDuelsByStatus(status as DuelStatus);

  if (duels.length === 0) {
    await interaction.editReply(`Nenhum duelo com status \`${status}\`.`);
    return;
  }

  const lines = duels.map((d) => {
    const date = d.createdAt.toISOString().slice(0, 10);
    const score = d.scoreWinner !== null ? ` (${d.scoreWinner}-${d.scoreLoser})` : '';
    return `\`#${d.id}\` <@${d.challenger.discordId}> vs <@${d.opponent.discordId}>${score} — ${date}`;
  });

  await interaction.editReply(`**Duelos com status \`${status}\`** (${duels.length})\n\n${lines.join('\n')}`);
}

// ─── /admin season repair ──────────────────────────────────────

async function handleSeasonRepair(interaction: ChatInputCommandInteraction) {
  const seasonId = interaction.options.getInteger('season_id', true);

  await interaction.deferReply({ ephemeral: true });

  const result = await repairSeasonStats(seasonId);

  if (!result) {
    await interaction.editReply(`Season #${seasonId} não encontrada.`);
    return;
  }

  await logAdminAction({
    action: 'REPAIR_SEASON',
    adminDiscordId: interaction.user.id,
    reason: `Recalculados stats de ${result.playersUpdated} jogadores na season #${seasonId}`,
  });

  logger.info('Admin reparou season', {
    seasonId,
    playersUpdated: result.playersUpdated,
    adminId: interaction.user.id,
  });

  await interaction.editReply(
    `Season #${seasonId} reparada.\n**Jogadores recalculados:** ${result.playersUpdated}`,
  );
}

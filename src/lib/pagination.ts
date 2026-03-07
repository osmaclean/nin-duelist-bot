import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getLeaderboard } from '../services/ranking.service';
import { getPlayerHistory, HistoryFilters } from '../services/history.service';
import { buildRankEmbed } from './embeds';
import { buildHistoryEmbed } from '../commands/history';
import { RANK_PAGE_SIZE } from '../config';

export function calcStartRank(page: number): number {
  return (page - 1) * RANK_PAGE_SIZE + 1;
}

export function buildPaginationRow(currentPage: number, totalPages: number) {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`rank-page-${currentPage - 1}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`rank-page-${currentPage + 1}`)
      .setLabel('Próxima')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
  );

  return row;
}

export async function handleRankPagination(interaction: ButtonInteraction) {
  await interaction.deferUpdate();

  const page = parseInt(interaction.customId.replace('rank-page-', ''), 10);
  if (isNaN(page) || page < 1) {
    await interaction.followUp({ content: 'Página inválida.', ephemeral: true });
    return;
  }

  const season = await getActiveSeason();
  if (!season) {
    await interaction.followUp({ content: 'Nenhuma season ativa.', ephemeral: true });
    return;
  }

  const result = await getLeaderboard(season.id, page);

  const safePage = Math.min(page, result.totalPages || 1);
  const startRank = calcStartRank(safePage);
  const embed = buildRankEmbed(season.number, result.players, safePage, result.totalPages, startRank);
  const row = buildPaginationRow(safePage, result.totalPages);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ─── History pagination ────────────────────────────

/**
 * CustomId format: hist:{targetDiscordId}:{page}:{vsId|_}:{from|_}:{to|_}
 */
export function buildHistoryPaginationRow(
  targetId: string,
  currentPage: number,
  totalPages: number,
  filters: HistoryFilters = {},
) {
  const vs = filters.vsDiscordId ?? '_';
  const from = filters.from ? filters.from.toISOString().slice(0, 10) : '_';
  const to = filters.to ? filters.to.toISOString().slice(0, 10) : '_';

  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`hist:${targetId}:${currentPage - 1}:${vs}:${from}:${to}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`hist:${targetId}:${currentPage + 1}:${vs}:${from}:${to}`)
      .setLabel('Proxima')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
  );

  return row;
}

export async function handleHistoryPagination(interaction: ButtonInteraction) {
  await interaction.deferUpdate();

  // hist:{targetId}:{page}:{vs}:{from}:{to}
  const parts = interaction.customId.split(':');
  if (parts.length < 6) {
    await interaction.followUp({ content: 'Interacao invalida.', ephemeral: true });
    return;
  }

  const [, targetId, pageStr, vsId, fromStr, toStr] = parts;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) {
    await interaction.followUp({ content: 'Pagina invalida.', ephemeral: true });
    return;
  }

  const season = await getActiveSeason();
  if (!season) {
    await interaction.followUp({ content: 'Nenhuma season ativa.', ephemeral: true });
    return;
  }

  const filters: HistoryFilters = {};
  if (vsId !== '_') filters.vsDiscordId = vsId;
  if (fromStr !== '_') filters.from = new Date(fromStr);
  if (toStr !== '_') filters.to = new Date(toStr);

  const history = await getPlayerHistory(targetId, season.id, page, filters);

  if (!history.stats) {
    await interaction.followUp({ content: 'Jogador nao encontrado.', ephemeral: true });
    return;
  }

  const safePage = Math.min(page, history.totalPages);
  const safeHistory = page !== safePage ? await getPlayerHistory(targetId, season.id, safePage, filters) : history;

  const embed = buildHistoryEmbed(season.number, targetId, safeHistory, filters);
  if (!embed) {
    await interaction.followUp({ content: 'Jogador nao encontrado.', ephemeral: true });
    return;
  }

  const components =
    safeHistory.totalPages > 1
      ? [buildHistoryPaginationRow(targetId, safeHistory.page, safeHistory.totalPages, filters)]
      : [];

  await interaction.editReply({ embeds: [embed], components });
}

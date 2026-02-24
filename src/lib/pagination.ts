import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getLeaderboard } from '../services/ranking.service';
import { buildRankEmbed } from './embeds';
import { RANK_PAGE_SIZE } from '../config';

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
  const page = parseInt(interaction.customId.replace('rank-page-', ''), 10);
  if (isNaN(page) || page < 1) return;

  const season = await getActiveSeason();
  if (!season) {
    await interaction.reply({ content: 'Nenhuma season ativa.', ephemeral: true });
    return;
  }

  const result = await getLeaderboard(season.id, page);
  const startRank = (page - 1) * RANK_PAGE_SIZE + 1;
  const embed = buildRankEmbed(season.number, result.players, result.page, result.totalPages, startRank);
  const row = buildPaginationRow(result.page, result.totalPages);

  await interaction.update({ embeds: [embed], components: [row] });
}

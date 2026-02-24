import { ChatInputCommandInteraction } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getLeaderboard } from '../services/ranking.service';
import { buildRankEmbed } from '../lib/embeds';
import { buildPaginationRow } from '../lib/pagination';
import { RANK_PAGE_SIZE } from '../config';

export async function handleRankCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply({ content: 'Nenhuma season ativa no momento.' });
    return;
  }

  const page = interaction.options.getInteger('page') ?? 1;
  const result = await getLeaderboard(season.id, page);

  if (page > result.totalPages) {
    await interaction.editReply({ content: `Página inválida. Total: ${result.totalPages}` });
    return;
  }

  const startRank = (page - 1) * RANK_PAGE_SIZE + 1;
  const embed = buildRankEmbed(season.number, result.players, result.page, result.totalPages, startRank);
  const row = buildPaginationRow(result.page, result.totalPages);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

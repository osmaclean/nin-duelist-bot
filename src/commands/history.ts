import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getPlayerHistory, HistoryFilters } from '../services/history.service';
import { DuelWithPlayers } from '../services/duel.service';
import { buildHistoryPaginationRow } from '../lib/pagination';

function formatDuelLine(duel: DuelWithPlayers, discordId: string): string {
  const isWinner = duel.winner?.discordId === discordId;
  const result = isWinner ? 'V' : 'D';
  const opponentId = duel.challenger.discordId === discordId ? duel.opponent.discordId : duel.challenger.discordId;
  const score = isWinner ? `${duel.scoreWinner}-${duel.scoreLoser}` : `${duel.scoreLoser}-${duel.scoreWinner}`;
  const date = duel.updatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  return `\`${date}\` **${result}** ${score} vs <@${opponentId}>`;
}

function parseDate(value: string): Date | undefined {
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export function buildHistoryEmbed(
  seasonNumber: number,
  targetId: string,
  history: Awaited<ReturnType<typeof getPlayerHistory>>,
  filters: HistoryFilters,
) {
  const { stats } = history;
  if (!stats) return null;

  const total = stats.wins + stats.losses;

  const embed = new EmbedBuilder()
    .setTitle(`Historico \u2014 Season ${seasonNumber}`)
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Jogador', value: `<@${targetId}>`, inline: true },
      { name: 'Pontos', value: `${stats.points}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Duelos', value: `${total}`, inline: true },
      { name: 'V/D', value: `${stats.wins}V ${stats.losses}D`, inline: true },
      { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
      { name: 'Streak Atual', value: `${stats.streak}`, inline: true },
      { name: 'Peak Streak', value: `${stats.peakStreak}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    );

  // Filter info
  const filterParts: string[] = [];
  if (filters.vsDiscordId) filterParts.push(`vs <@${filters.vsDiscordId}>`);
  if (filters.from) filterParts.push(`desde ${filters.from.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
  if (filters.to) filterParts.push(`ate ${filters.to.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
  if (filterParts.length > 0) {
    embed.addFields({ name: 'Filtros', value: filterParts.join(' | ') });
  }

  if (history.recentDuels.length > 0) {
    const lines = history.recentDuels.map((d) => formatDuelLine(d, targetId));
    embed.addFields({ name: `Duelos (${history.total} total)`, value: lines.join('\n') });
  } else {
    embed.addFields({ name: 'Duelos recentes', value: 'Nenhum duelo confirmado encontrado.' });
  }

  if (history.totalPages > 1) {
    embed.setFooter({ text: `Pagina ${history.page}/${history.totalPages}` });
  }

  return embed;
}

export async function handleHistoryCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const targetUser = interaction.options.getUser('player') ?? interaction.user;
  const vsUser = interaction.options.getUser('vs');
  const fromStr = interaction.options.getString('from');
  const toStr = interaction.options.getString('to');
  const page = interaction.options.getInteger('page') ?? 1;

  const filters: HistoryFilters = {};
  if (vsUser) filters.vsDiscordId = vsUser.id;
  if (fromStr) filters.from = parseDate(fromStr);
  if (toStr) filters.to = parseDate(toStr);

  const history = await getPlayerHistory(targetUser.id, season.id, page, filters);

  if (!history.stats) {
    await interaction.editReply(`<@${targetUser.id}> nao tem historico nesta season.`);
    return;
  }

  const embed = buildHistoryEmbed(season.number, targetUser.id, history, filters);
  if (!embed) {
    await interaction.editReply(`<@${targetUser.id}> nao tem historico nesta season.`);
    return;
  }

  const components =
    history.totalPages > 1
      ? [buildHistoryPaginationRow(targetUser.id, history.page, history.totalPages, filters)]
      : [];

  await interaction.editReply({ embeds: [embed], components });
}

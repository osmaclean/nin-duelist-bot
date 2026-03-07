import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason, getSeasonStatus, getSeasonPodium } from '../services/season.service';

export async function handleSeasonCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const [status, podium] = await Promise.all([getSeasonStatus(season.id), getSeasonPodium(season.id)]);

  if (!status) {
    await interaction.editReply('Erro ao buscar dados da season.');
    return;
  }

  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((status.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const seasonName = status.name ? `${status.name} (Season ${status.number})` : `Season ${status.number}`;

  const embed = new EmbedBuilder()
    .setTitle(seasonName)
    .setColor(Colors.Gold)
    .addFields(
      { name: 'Inicio', value: status.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }), inline: true },
      { name: 'Termino', value: status.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }), inline: true },
      { name: 'Dias restantes', value: `${daysLeft}`, inline: true },
      { name: 'Total de duelos', value: `${status.totalDuels}`, inline: true },
      { name: 'Jogadores ativos', value: `${status.activePlayers}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    );

  if (podium.length > 0) {
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    const lines = podium.map(
      (e, i) => `${medals[i] ?? `${i + 1}.`} <@${e.discordId}> \u2014 ${e.points}pts | ${e.wins}V ${e.losses}D`,
    );
    embed.addFields({ name: 'Top 3 parcial', value: lines.join('\n') });
  } else {
    embed.addFields({ name: 'Top 3 parcial', value: 'Nenhum jogador ainda.' });
  }

  await interaction.editReply({ embeds: [embed] });
}

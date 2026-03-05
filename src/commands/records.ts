import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getSeasonRecords } from '../services/records.service';

export async function handleRecordsCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const records = await getSeasonRecords(season.id);

  const hasAny = records.bestStreak || records.bestWinRate || records.mostDuels;
  if (!hasAny) {
    await interaction.editReply('Nenhum recorde registrado nesta season ainda.');
    return;
  }

  const embed = new EmbedBuilder().setTitle(`Recordes — Season ${season.number}`).setColor(Colors.Purple);

  if (records.bestStreak && records.bestStreak.value > 0) {
    embed.addFields({
      name: 'Maior Streak',
      value: `<@${records.bestStreak.discordId}> — ${records.bestStreak.value} vitórias seguidas`,
    });
  }

  if (records.bestWinRate) {
    embed.addFields({
      name: 'Melhor Win Rate (min. 5 jogos)',
      value: `<@${records.bestWinRate.discordId}> — ${records.bestWinRate.value}% (${records.bestWinRate.wins}/${records.bestWinRate.total})`,
    });
  }

  if (records.mostDuels && records.mostDuels.value > 0) {
    embed.addFields({
      name: 'Mais Duelos',
      value: `<@${records.mostDuels.discordId}> — ${records.mostDuels.value} duelos (${records.mostDuels.wins}V ${records.mostDuels.losses}D)`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getMostActive } from '../services/activity.service';

export async function handleActivityCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const entries = await getMostActive(season.id);

  if (entries.length === 0) {
    await interaction.editReply('Nenhum jogador ativo nesta season ainda.');
    return;
  }

  const lines = entries.map((e, i) => {
    const rank = i + 1;
    const medal = rank <= 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][rank - 1] : `**${rank}.**`;
    return `${medal} <@${e.discordId}> — ${e.totalDuels} duelos (${e.wins}V ${e.losses}D)`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Mais Ativos — Season ${season.number}`)
    .setColor(Colors.Orange)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Top ${entries.length} jogadores por total de duelos` });

  await interaction.editReply({ embeds: [embed] });
}

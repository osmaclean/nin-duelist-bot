import { ChatInputCommandInteraction } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getTopPlayers } from '../services/ranking.service';
import { buildMvpEmbed } from '../lib/embeds';

export async function handleMvpCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply({ content: 'Nenhuma season ativa no momento.' });
    return;
  }

  const top = await getTopPlayers(season.id, 5);
  const embed = buildMvpEmbed(season.number, top);

  await interaction.editReply({ embeds: [embed] });
}

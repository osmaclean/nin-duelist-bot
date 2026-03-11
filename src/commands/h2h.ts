import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getHeadToHead } from '../services/h2h.service';
import { DuelWithPlayers } from '../services/duel.service';

function formatDuelLine(duel: DuelWithPlayers, discordIdA: string): string {
  const aWon = duel.winner?.discordId === discordIdA;
  const result = aWon ? 'V' : 'D';
  const score = aWon ? `${duel.scoreWinner}-${duel.scoreLoser}` : `${duel.scoreLoser}-${duel.scoreWinner}`;
  const date = duel.updatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  return `\`${date}\` **${result}** ${score}`;
}

export async function handleH2hCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const userA = interaction.options.getUser('player_a', true);
  const userB = interaction.options.getUser('player_b', true);

  if (userA.id === userB.id) {
    await interaction.editReply('Selecione dois jogadores diferentes.');
    return;
  }

  if (userA.bot || userB.bot) {
    await interaction.editReply('Bots não participam de duelos.');
    return;
  }

  const h2h = await getHeadToHead(userA.id, userB.id, season.id);

  if (h2h.totalDuels === 0) {
    await interaction.editReply(`Nenhum confronto entre <@${userA.id}> e <@${userB.id}> nesta season.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`H2H — Season ${season.number}`)
    .setColor(Colors.Gold)
    .addFields(
      { name: 'Jogador A', value: `<@${userA.id}>`, inline: true },
      { name: 'vs', value: '\u200b', inline: true },
      { name: 'Jogador B', value: `<@${userB.id}>`, inline: true },
      { name: 'Duelos', value: `${h2h.totalDuels}`, inline: true },
      { name: 'Vitórias A', value: `${h2h.winsA} (${h2h.winRateA}%)`, inline: true },
      { name: 'Vitórias B', value: `${h2h.winsB} (${h2h.winRateB}%)`, inline: true },
    );

  if (h2h.recentDuels.length > 0) {
    const lines = h2h.recentDuels.map((d) => formatDuelLine(d, userA.id));
    embed.addFields({ name: `Últimos ${h2h.recentDuels.length} duelos (perspectiva A)`, value: lines.join('\n') });
  }

  await interaction.editReply({ embeds: [embed] });
}

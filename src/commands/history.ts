import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getPlayerHistory } from '../services/history.service';

function formatDuelLine(duel: any, discordId: string): string {
  const isWinner = duel.winner?.discordId === discordId;
  const result = isWinner ? 'V' : 'D';
  const opponentId = duel.challenger.discordId === discordId ? duel.opponent.discordId : duel.challenger.discordId;
  const score = isWinner ? `${duel.scoreWinner}-${duel.scoreLoser}` : `${duel.scoreLoser}-${duel.scoreWinner}`;
  const date = duel.updatedAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  return `\`${date}\` **${result}** ${score} vs <@${opponentId}>`;
}

export async function handleHistoryCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const targetUser = interaction.options.getUser('player') ?? interaction.user;
  const history = await getPlayerHistory(targetUser.id, season.id);

  if (!history.stats) {
    await interaction.editReply(`<@${targetUser.id}> não tem histórico nesta season.`);
    return;
  }

  const { stats } = history;
  const total = stats.wins + stats.losses;

  const embed = new EmbedBuilder()
    .setTitle(`Histórico — Season ${season.number}`)
    .setColor(Colors.Blue)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'Jogador', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Pontos', value: `${stats.points}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Duelos', value: `${total}`, inline: true },
      { name: 'V/D', value: `${stats.wins}V ${stats.losses}D`, inline: true },
      { name: 'Win Rate', value: `${stats.winRate}%`, inline: true },
      { name: 'Streak Atual', value: `${stats.streak}`, inline: true },
      { name: 'Peak Streak', value: `${stats.peakStreak}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    );

  if (history.recentDuels.length > 0) {
    const lines = history.recentDuels.map((d) => formatDuelLine(d, targetUser.id));
    embed.addFields({ name: `Últimos ${history.recentDuels.length} duelos`, value: lines.join('\n') });
  } else {
    embed.addFields({ name: 'Duelos recentes', value: 'Nenhum duelo confirmado ainda.' });
  }

  await interaction.editReply({ embeds: [embed] });
}

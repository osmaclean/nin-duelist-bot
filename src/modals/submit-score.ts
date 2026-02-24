import { ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDuelById, submitResult } from '../services/duel.service';
import { applyResult } from '../services/player.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleSubmitScoreModal(interaction: ModalSubmitInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'IN_PROGRESS') {
    await interaction.reply({ content: 'Este duelo não está em andamento.', ephemeral: true });
    return;
  }

  const winnerRaw = interaction.fields.getTextInputValue('winner').replace(/[<@!>]/g, '').trim();
  const scoreWinner = parseInt(interaction.fields.getTextInputValue('score-winner'), 10);
  const scoreLoser = parseInt(interaction.fields.getTextInputValue('score-loser'), 10);

  // Validate winner ID
  const validIds = [duel.challenger.discordId, duel.opponent.discordId];
  if (!validIds.includes(winnerRaw)) {
    await interaction.reply({
      content: `ID de vencedor inválido. Use: ${validIds.join(' ou ')}`,
      ephemeral: true,
    });
    return;
  }

  // Validate score
  if (isNaN(scoreWinner) || isNaN(scoreLoser)) {
    await interaction.reply({ content: 'Placar inválido. Use números inteiros.', ephemeral: true });
    return;
  }

  const validScores =
    duel.format === 'MD1'
      ? scoreWinner === 1 && scoreLoser === 0
      : (scoreWinner === 2 && scoreLoser === 0) || (scoreWinner === 2 && scoreLoser === 1);

  if (!validScores) {
    const hint = duel.format === 'MD1' ? '1-0' : '2-0 ou 2-1';
    await interaction.reply({
      content: `Placar inválido para ${duel.format}. Placares válidos: ${hint}`,
      ephemeral: true,
    });
    return;
  }

  // Resolve winner player ID
  const winnerId =
    winnerRaw === duel.challenger.discordId ? duel.challengerId : duel.opponentId;
  const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;

  await interaction.deferUpdate();

  const updated = await submitResult(duelId, winnerId, scoreWinner, scoreLoser);
  if (!updated) {
    await interaction.followUp({ content: 'Erro ao enviar resultado.', ephemeral: true });
    return;
  }

  // If confirmed directly (casual without witness), apply result
  if (updated.status === 'CONFIRMED' && updated.mode === 'RANKED') {
    await applyResult(winnerId, loserId, duel.seasonId);
  }

  const embed = buildDuelEmbed(updated);
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (updated.status === 'AWAITING_VALIDATION' && duel.witness) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm-result:${duel.id}`)
          .setLabel('Confirmar Resultado')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject-result:${duel.id}`)
          .setLabel('Rejeitar Resultado')
          .setStyle(ButtonStyle.Danger),
      ),
    );
  }

  await interaction.editReply({ embeds: [embed], components });
}

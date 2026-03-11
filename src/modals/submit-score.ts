import { ModalSubmitInteraction } from 'discord.js';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { notifyWitnessValidation, notifyResultSubmitted } from '../lib/notifications';
import { validateScore } from '../lib/validation';
import { logger } from '../lib/logger';

export async function handleSubmitScoreModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(':');
  const duelId = parseInt(parts[1], 10);
  const winnerId = parseInt(parts[2], 10);

  if (isNaN(duelId) || isNaN(winnerId)) {
    await interaction.reply({ content: 'Interação inválida.', ephemeral: true });
    return;
  }

  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'IN_PROGRESS') {
    await interaction.reply({ content: 'Este duelo não está em andamento.', ephemeral: true });
    return;
  }

  // Only the witness can report results
  if (interaction.user.id !== duel.witness.discordId) {
    await interaction.reply({ content: 'Apenas a testemunha pode reportar o resultado.', ephemeral: true });
    return;
  }

  // Validate winnerId
  if (winnerId !== duel.challengerId && winnerId !== duel.opponentId) {
    await interaction.reply({ content: 'Vencedor inválido.', ephemeral: true });
    return;
  }

  const scoreWinner = parseInt(interaction.fields.getTextInputValue('score-winner'), 10);
  const scoreLoser = parseInt(interaction.fields.getTextInputValue('score-loser'), 10);

  if (isNaN(scoreWinner) || isNaN(scoreLoser)) {
    await interaction.reply({ content: 'Placar inválido. Use números inteiros.', ephemeral: true });
    return;
  }

  if (!validateScore(duel.format, scoreWinner, scoreLoser)) {
    const validScores = duel.format === 'MD1' ? '1-0' : '2-0 ou 2-1';
    await interaction.reply({
      content: `Placar inválido para ${duel.format}. Placares válidos: ${validScores}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const updated = await submitResult(duelId, winnerId, scoreWinner, scoreLoser);
  if (!updated) {
    await interaction.followUp({ content: 'Erro ao enviar resultado.', ephemeral: true });
    return;
  }

  // Update the original duel message
  try {
    if (duel.channelId && duel.messageId) {
      const channel = await interaction.client.channels.fetch(duel.channelId);
      if (channel?.isTextBased() && 'messages' in channel) {
        const message = await channel.messages.fetch(duel.messageId);
        const embed = buildDuelEmbed(updated);
        const components = buildDuelComponents(updated);
        await message.edit({ embeds: [embed], components });
      }
    }
  } catch (err) {
    logger.warn('Falha ao atualizar embed do duelo após reportar resultado', {
      duelId: duel.id,
      channelId: duel.channelId,
      messageId: duel.messageId,
      error: String(err),
    });
  }

  await interaction.editReply({
    content: 'Resultado reportado! Confirme ou rejeite o resultado no embed do duelo.',
    components: [],
  });

  if (updated.status === 'AWAITING_VALIDATION') {
    notifyWitnessValidation(interaction.client, updated).catch(() => {});
    notifyResultSubmitted(interaction.client, updated).catch(() => {});
  }
}

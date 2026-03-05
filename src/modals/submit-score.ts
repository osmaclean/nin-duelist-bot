import { ModalSubmitInteraction } from 'discord.js';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { notifyWitnessValidation } from '../lib/notifications';

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

  // MD3 validation: 2-0 or 2-1
  const validScores = (scoreWinner === 2 && scoreLoser === 0) || (scoreWinner === 2 && scoreLoser === 1);

  if (!validScores) {
    await interaction.reply({
      content: 'Placar inválido para MD3. Placares válidos: 2-0 ou 2-1',
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
      if (channel && 'messages' in channel) {
        const message = await (channel as any).messages.fetch(duel.messageId);
        const embed = buildDuelEmbed(updated);
        const components = buildDuelComponents(updated);
        await message.edit({ embeds: [embed], components });
      }
    }
  } catch {
    // Channel or message may be deleted
  }

  if (updated.status === 'AWAITING_VALIDATION') {
    notifyWitnessValidation(interaction.client, updated).catch(() => {});
  }
}

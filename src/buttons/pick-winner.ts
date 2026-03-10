import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { notifyWitnessValidation } from '../lib/notifications';

export async function handlePickWinner(interaction: ButtonInteraction) {
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

  // Validate winnerId matches one of the players
  if (winnerId !== duel.challengerId && winnerId !== duel.opponentId) {
    await interaction.reply({ content: 'Vencedor inválido.', ephemeral: true });
    return;
  }

  // MD1: auto-submit 1-0
  if (duel.format === 'MD1') {
    await interaction.deferUpdate();

    const updated = await submitResult(duelId, winnerId, 1, 0);
    if (!updated) {
      await interaction.followUp({ content: 'Erro ao enviar resultado.', ephemeral: true });
      return;
    }

    // Update the original duel message (not the ephemeral)
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
    } catch {
      // Channel or message may be deleted
    }

    await interaction.editReply({
      content: 'Resultado enviado! Aguardando validação da testemunha.',
      components: [],
    });

    if (updated.status === 'AWAITING_VALIDATION') {
      notifyWitnessValidation(interaction.client, updated).catch(() => {});
    }
    return;
  }

  // MD3: open modal asking only for score
  const modal = new ModalBuilder().setCustomId(`submit-score:${duelId}:${winnerId}`).setTitle('Placar do Duelo');

  const scoreWinnerInput = new TextInputBuilder()
    .setCustomId('score-winner')
    .setLabel('Pontos do vencedor')
    .setPlaceholder('2')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const scoreLoserInput = new TextInputBuilder()
    .setCustomId('score-loser')
    .setLabel('Pontos do perdedor')
    .setPlaceholder('0 ou 1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(scoreWinnerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(scoreLoserInput),
  );

  await interaction.showModal(modal);
}

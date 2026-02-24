import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDuelById, rejectResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleRejectResult(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'AWAITING_VALIDATION') {
    await interaction.reply({ content: 'Este duelo não está aguardando validação.', ephemeral: true });
    return;
  }

  if (!duel.witness || interaction.user.id !== duel.witness.discordId) {
    await interaction.reply({ content: 'Apenas a testemunha pode rejeitar o resultado.', ephemeral: true });
    return;
  }

  const updated = await rejectResult(duelId);
  if (!updated) {
    await interaction.reply({ content: 'Erro ao rejeitar resultado.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);

  // Back to IN_PROGRESS — show submit button again
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`submit-result:${duel.id}`)
      .setLabel('Enviar Resultado')
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

import { ButtonInteraction } from 'discord.js';
import { getDuelById, confirmAndApplyResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleConfirmResult(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  await interaction.deferUpdate();

  if (isNaN(duelId)) {
    await interaction.followUp({ content: 'Interação inválida.', ephemeral: true });
    return;
  }

  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'AWAITING_VALIDATION') {
    await interaction.followUp({ content: 'Este duelo não está aguardando validação.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== duel.witness.discordId) {
    await interaction.followUp({ content: 'Apenas a testemunha pode confirmar o resultado.', ephemeral: true });
    return;
  }

  const updated = await confirmAndApplyResult(duelId);

  if (!updated) {
    await interaction.followUp({ content: 'Erro ao confirmar resultado.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);
  await interaction.editReply({ embeds: [embed], components: [] });
}

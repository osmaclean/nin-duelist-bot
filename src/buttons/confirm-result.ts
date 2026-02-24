import { ButtonInteraction } from 'discord.js';
import { getDuelById, confirmResult } from '../services/duel.service';
import { applyResult } from '../services/player.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleConfirmResult(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'AWAITING_VALIDATION') {
    await interaction.reply({ content: 'Este duelo não está aguardando validação.', ephemeral: true });
    return;
  }

  if (!duel.witness || interaction.user.id !== duel.witness.discordId) {
    await interaction.reply({ content: 'Apenas a testemunha pode confirmar o resultado.', ephemeral: true });
    return;
  }

  const updated = await confirmResult(duelId);
  if (!updated) {
    await interaction.reply({ content: 'Erro ao confirmar resultado.', ephemeral: true });
    return;
  }

  // Apply ranking result for ranked duels
  if (updated.mode === 'RANKED' && updated.winnerId) {
    const loserId =
      updated.winnerId === updated.challengerId ? updated.opponentId : updated.challengerId;
    await applyResult(updated.winnerId, loserId, updated.seasonId);
  }

  const embed = buildDuelEmbed(updated);
  await interaction.update({ embeds: [embed], components: [] });
}

import { ButtonInteraction } from 'discord.js';
import { getDuelById, cancelDuel } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleCancelDuel(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel) {
    await interaction.reply({ content: 'Duelo não encontrado.', ephemeral: true });
    return;
  }

  const allowedStatuses = ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'];
  if (!allowedStatuses.includes(duel.status)) {
    await interaction.reply({ content: 'Este duelo não pode mais ser cancelado.', ephemeral: true });
    return;
  }

  // Qualquer participante (challenger, opponent, witness) pode cancelar
  const participantIds = [duel.challenger.discordId, duel.opponent.discordId, duel.witness.discordId];
  if (!participantIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'Apenas os participantes do duelo podem cancelá-lo.', ephemeral: true });
    return;
  }

  const updated = await cancelDuel(duelId);
  if (!updated) {
    await interaction.reply({ content: 'Erro ao cancelar duelo.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);
  await interaction.update({ embeds: [embed], components: [] });
}

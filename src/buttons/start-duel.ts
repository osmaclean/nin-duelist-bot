import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDuelById, startDuel } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleStartDuel(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  await interaction.deferUpdate();
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'ACCEPTED') {
    await interaction.followUp({ content: 'Este duelo não pode ser iniciado.', ephemeral: true });
    return;
  }

  // Only challenger or opponent can start
  const isParticipant =
    interaction.user.id === duel.challenger.discordId ||
    interaction.user.id === duel.opponent.discordId;

  if (!isParticipant) {
    await interaction.followUp({ content: 'Apenas os duelistas podem iniciar o duelo.', ephemeral: true });
    return;
  }

  const updated = await startDuel(duelId);
  if (!updated) {
    await interaction.followUp({ content: 'Erro ao iniciar duelo.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`submit-result:${duel.id}`)
      .setLabel('Enviar Resultado')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cancel-duel:${duel.id}`)
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

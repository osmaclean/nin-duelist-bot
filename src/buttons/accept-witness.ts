import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDuelById, acceptWitness } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleAcceptWitness(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'PROPOSED') {
    await interaction.reply({ content: 'Este duelo não está mais disponível.', ephemeral: true });
    return;
  }

  if (!duel.witness || interaction.user.id !== duel.witness.discordId) {
    await interaction.reply({ content: 'Apenas a testemunha designada pode aceitar.', ephemeral: true });
    return;
  }

  const updated = await acceptWitness(duelId);
  if (!updated) {
    await interaction.reply({ content: 'Erro ao aceitar como testemunha.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (updated.status === 'PROPOSED' && !updated.opponentAccepted) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept-duel:${duel.id}`)
          .setLabel('Aceitar Duelo')
          .setStyle(ButtonStyle.Success),
      ),
    );
  }

  if (updated.status === 'ACCEPTED') {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`start-duel:${duel.id}`)
          .setLabel('Iniciar Duelo')
          .setStyle(ButtonStyle.Success),
      ),
    );
  }

  await interaction.update({ embeds: [embed], components });
}

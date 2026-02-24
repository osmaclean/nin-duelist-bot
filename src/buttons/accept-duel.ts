import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDuelById, acceptOpponent } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleAcceptDuel(interaction: ButtonInteraction) {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  const duel = await getDuelById(duelId);

  if (!duel || duel.status !== 'PROPOSED') {
    await interaction.reply({ content: 'Este duelo não está mais disponível.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== duel.opponent.discordId) {
    await interaction.reply({ content: 'Apenas o oponente pode aceitar o duelo.', ephemeral: true });
    return;
  }

  const updated = await acceptOpponent(duelId);
  if (!updated) {
    await interaction.reply({ content: 'Erro ao aceitar duelo.', ephemeral: true });
    return;
  }

  const embed = buildDuelEmbed(updated);
  const components = buildDuelButtons(updated);

  await interaction.update({ embeds: [embed], components });
}

function buildDuelButtons(duel: { id: number; status: string; witnessId: number | null }) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (duel.status === 'PROPOSED') {
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (duel.witnessId) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`accept-witness:${duel.id}`)
          .setLabel('Aceitar (Testemunha)')
          .setStyle(ButtonStyle.Primary),
      );
    }
    rows.push(row);
  }

  if (duel.status === 'ACCEPTED') {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`start-duel:${duel.id}`)
          .setLabel('Iniciar Duelo')
          .setStyle(ButtonStyle.Success),
      ),
    );
  }

  return rows;
}

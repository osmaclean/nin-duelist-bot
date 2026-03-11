import { ButtonInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { validateDuelButton } from './handler';

export async function handleSubmitResult(interaction: ButtonInteraction) {
  const result = await validateDuelButton(interaction, {
    expectedStatus: 'IN_PROGRESS',
    permissionCheck: (i, duel) => {
      const isWitness = i.user.id === duel.witness.discordId;
      return isWitness ? null : 'Apenas a testemunha pode reportar o resultado do duelo.';
    },
    errorMessage: 'Este duelo não está em andamento.',
  });

  if ('error' in result) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const { duel } = result;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pick-winner:${duel.id}:${duel.challengerId}`)
      .setLabel(`${duel.challenger.username}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pick-winner:${duel.id}:${duel.opponentId}`)
      .setLabel(`${duel.opponent.username}`)
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({
    content: '**Quem venceu o duelo?**',
    components: [row],
    ephemeral: true,
  });
}

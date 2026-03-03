import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { validateDuelButton } from './handler';

export async function handleSubmitResult(interaction: ButtonInteraction) {
  const result = await validateDuelButton(interaction, {
    expectedStatus: 'IN_PROGRESS',
    permissionCheck: (i, duel) => {
      const isParticipant =
        i.user.id === duel.challenger.discordId ||
        i.user.id === duel.opponent.discordId;
      return isParticipant ? null : 'Apenas os duelistas podem enviar o resultado.';
    },
    errorMessage: 'Este duelo não está em andamento.',
  });

  if ('error' in result) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const { duel } = result;
  const formatHint = duel.format === 'MD1' ? '1-0' : '2-0 ou 2-1';

  const modal = new ModalBuilder()
    .setCustomId(`submit-score:${duel.id}`)
    .setTitle('Enviar Resultado do Duelo');

  const winnerInput = new TextInputBuilder()
    .setCustomId('winner')
    .setLabel('Quem venceu? (ID Discord ou @menção)')
    .setPlaceholder(`${duel.challenger.discordId} ou ${duel.opponent.discordId}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const scoreWinnerInput = new TextInputBuilder()
    .setCustomId('score-winner')
    .setLabel('Pontos do vencedor')
    .setPlaceholder(duel.format === 'MD1' ? '1' : '2')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const scoreLoserInput = new TextInputBuilder()
    .setCustomId('score-loser')
    .setLabel('Pontos do perdedor')
    .setPlaceholder(duel.format === 'MD1' ? '0' : '0 ou 1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(winnerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(scoreWinnerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(scoreLoserInput),
  );

  await interaction.showModal(modal);
}

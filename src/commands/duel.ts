import { ChatInputCommandInteraction } from 'discord.js';
import { DuelFormat } from '@prisma/client';
import { getActiveSeason } from '../services/season.service';
import { getOrCreatePlayer } from '../services/player.service';
import { createDuel, setMessageId, hasActiveDuel } from '../services/duel.service';
import { canDuelToday } from '../services/antifarm.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { notifyDuelCreated } from '../lib/notifications';

export async function handleDuelCommand(interaction: ChatInputCommandInteraction) {
  const season = await getActiveSeason();
  if (!season) {
    await interaction.reply({ content: 'Nenhuma season ativa no momento.', ephemeral: true });
    return;
  }

  const opponentUser = interaction.options.getUser('opponent', true);
  const format = interaction.options.getString('format', true) as DuelFormat;
  const witnessUser = interaction.options.getUser('witness', true);

  // Validations
  if (opponentUser.id === interaction.user.id) {
    await interaction.reply({ content: 'Você não pode duelar contra si mesmo.', ephemeral: true });
    return;
  }

  if (opponentUser.bot) {
    await interaction.reply({ content: 'Você não pode duelar contra um bot.', ephemeral: true });
    return;
  }

  if (witnessUser.bot) {
    await interaction.reply({ content: 'A testemunha não pode ser um bot.', ephemeral: true });
    return;
  }

  if (witnessUser.id === interaction.user.id || witnessUser.id === opponentUser.id) {
    await interaction.reply({
      content: 'A testemunha não pode ser um dos duelistas.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Get or create players
  const challenger = await getOrCreatePlayer(interaction.user.id, interaction.user.username);
  const opponent = await getOrCreatePlayer(opponentUser.id, opponentUser.username);
  const witness = await getOrCreatePlayer(witnessUser.id, witnessUser.username);

  // Check active duels
  if (await hasActiveDuel(challenger.id)) {
    await interaction.editReply('Você já tem um duelo ativo. Finalize-o antes de criar outro.');
    return;
  }

  if (await hasActiveDuel(opponent.id)) {
    await interaction.editReply(`<@${opponentUser.id}> já tem um duelo ativo.`);
    return;
  }

  // Anti-farm check
  const allowed = await canDuelToday(challenger.id, opponent.id);
  if (!allowed) {
    await interaction.editReply(
      'Vocês já tiveram um duelo confirmado hoje. Tente novamente amanhã.',
    );
    return;
  }

  // Create duel
  const duel = await createDuel({
    challengerId: challenger.id,
    opponentId: opponent.id,
    witnessId: witness.id,
    seasonId: season.id,
    format,
    channelId: interaction.channelId,
  });

  const embed = buildDuelEmbed(duel);
  const components = buildDuelComponents(duel);

  // Mention relevant users
  const reply = await interaction.editReply({
    content: `<@${opponentUser.id}> <@${witnessUser.id}> — Novo desafio de duelo!`,
    embeds: [embed],
    components,
  });

  await setMessageId(duel.id, reply.id);

  notifyDuelCreated(interaction.client, duel).catch(() => {});
}

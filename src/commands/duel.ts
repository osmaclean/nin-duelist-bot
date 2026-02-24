import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { DuelMode, DuelFormat } from '@prisma/client';
import { getActiveSeason } from '../services/season.service';
import { getOrCreatePlayer } from '../services/player.service';
import { createDuel, setMessageId, hasActiveDuel } from '../services/duel.service';
import { canDuelToday } from '../services/antifarm.service';
import { buildDuelEmbed } from '../lib/embeds';

export async function handleDuelCommand(interaction: ChatInputCommandInteraction) {
  const season = await getActiveSeason();
  if (!season) {
    await interaction.reply({ content: 'Nenhuma season ativa no momento.', ephemeral: true });
    return;
  }

  const opponentUser = interaction.options.getUser('opponent', true);
  const format = interaction.options.getString('format', true) as DuelFormat;
  const mode = interaction.options.getString('mode', true) as DuelMode;
  const witnessUser = interaction.options.getUser('witness');

  // Validations
  if (opponentUser.id === interaction.user.id) {
    await interaction.reply({ content: 'Você não pode duelar contra si mesmo.', ephemeral: true });
    return;
  }

  if (opponentUser.bot) {
    await interaction.reply({ content: 'Você não pode duelar contra um bot.', ephemeral: true });
    return;
  }

  if (witnessUser && witnessUser.bot) {
    await interaction.reply({ content: 'A testemunha não pode ser um bot.', ephemeral: true });
    return;
  }

  if (witnessUser && (witnessUser.id === interaction.user.id || witnessUser.id === opponentUser.id)) {
    await interaction.reply({
      content: 'A testemunha não pode ser um dos duelistas.',
      ephemeral: true,
    });
    return;
  }

  if (mode === 'RANKED' && !witnessUser) {
    await interaction.reply({
      content: 'Duelos ranked precisam de uma testemunha. Use a opção `witness`.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Get or create players
  const challenger = await getOrCreatePlayer(interaction.user.id, interaction.user.username);
  const opponent = await getOrCreatePlayer(opponentUser.id, opponentUser.username);
  const witness = witnessUser
    ? await getOrCreatePlayer(witnessUser.id, witnessUser.username)
    : null;

  // Check active duels
  if (await hasActiveDuel(challenger.id)) {
    await interaction.editReply('Você já tem um duelo ativo. Finalize-o antes de criar outro.');
    return;
  }

  if (await hasActiveDuel(opponent.id)) {
    await interaction.editReply(`<@${opponentUser.id}> já tem um duelo ativo.`);
    return;
  }

  // Anti-farm check (ranked only)
  if (mode === 'RANKED') {
    const allowed = await canDuelToday(challenger.id, opponent.id);
    if (!allowed) {
      await interaction.editReply(
        'Vocês já tiveram um duelo ranked confirmado hoje. Tente novamente amanhã.',
      );
      return;
    }
  }

  // Create duel
  const duel = await createDuel({
    challengerId: challenger.id,
    opponentId: opponent.id,
    witnessId: witness?.id,
    seasonId: season.id,
    mode,
    format,
    channelId: interaction.channelId,
  });

  const embed = buildDuelEmbed(duel);

  // Build buttons
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`accept-duel:${duel.id}`)
      .setLabel('Aceitar Duelo')
      .setStyle(ButtonStyle.Success),
  );

  if (witness) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`accept-witness:${duel.id}`)
        .setLabel('Aceitar (Testemunha)')
        .setStyle(ButtonStyle.Primary),
    );
  }

  // Mention relevant users
  const mentions = [`<@${opponentUser.id}>`];
  if (witnessUser) mentions.push(`<@${witnessUser.id}>`);

  const reply = await interaction.editReply({
    content: `${mentions.join(' ')} — Novo desafio de duelo!`,
    embeds: [embed],
    components: [row],
  });

  await setMessageId(duel.id, reply.id);
}

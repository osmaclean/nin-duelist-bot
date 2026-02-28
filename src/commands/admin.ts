import { ChatInputCommandInteraction } from 'discord.js';
import { getDuelById, cancelDuel } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { ADMIN_ROLE_IDS } from '../config';
import { logger } from '../lib/logger';

function hasAdminRole(interaction: ChatInputCommandInteraction): boolean {
  if (ADMIN_ROLE_IDS.length === 0) return false;

  const roles = interaction.member?.roles;
  if (!roles) return false;

  // GuildMemberRoleManager (gateway interaction) has cache.has()
  if ('cache' in roles && typeof (roles as any).cache?.has === 'function') {
    return ADMIN_ROLE_IDS.some((id) => (roles as any).cache.has(id));
  }

  // API interaction: roles is string[]
  if (Array.isArray(roles)) {
    return ADMIN_ROLE_IDS.some((id) => (roles as string[]).includes(id));
  }

  return false;
}

export async function handleAdminCommand(interaction: ChatInputCommandInteraction) {
  if (!hasAdminRole(interaction)) {
    await interaction.reply({ content: 'Você não tem permissão para usar comandos admin.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'cancel') {
    await handleAdminCancel(interaction);
  }
}

async function handleAdminCancel(interaction: ChatInputCommandInteraction) {
  const duelId = interaction.options.getInteger('duel_id', true);
  const reason = interaction.options.getString('reason', true);

  await interaction.deferReply({ ephemeral: true });

  const duel = await getDuelById(duelId);
  if (!duel) {
    await interaction.editReply(`Duelo #${duelId} não encontrado.`);
    return;
  }

  const terminalStatuses = ['CONFIRMED', 'CANCELLED', 'EXPIRED'];
  if (terminalStatuses.includes(duel.status)) {
    await interaction.editReply(`Duelo #${duelId} já está em estado terminal (${duel.status}).`);
    return;
  }

  const cancelled = await cancelDuel(duelId);
  if (!cancelled) {
    await interaction.editReply(`Erro ao cancelar duelo #${duelId}.`);
    return;
  }

  logger.info('Admin cancelou duelo', {
    duelId,
    adminId: interaction.user.id,
    adminTag: interaction.user.tag,
    previousStatus: duel.status,
    reason,
  });

  // Update original message if possible
  if (duel.channelId && duel.messageId) {
    try {
      const channel = await interaction.client.channels.fetch(duel.channelId);
      if (channel && 'messages' in channel) {
        const message = await (channel as any).messages.fetch(duel.messageId);
        const embed = buildDuelEmbed(cancelled);
        await message.edit({ embeds: [embed], components: [] });
      }
    } catch {
      // Channel or message may be deleted
    }
  }

  await interaction.editReply(
    `Duelo #${duelId} cancelado com sucesso.\n**Motivo:** ${reason}\n**Status anterior:** ${duel.status}`,
  );
}

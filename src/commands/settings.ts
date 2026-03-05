import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../lib/prisma';
import { getOrCreatePlayer } from '../services/player.service';

export async function handleSettingsCommand(interaction: ChatInputCommandInteraction) {
  const toggle = interaction.options.getString('notifications', true);
  const enabled = toggle === 'on';

  await interaction.deferReply({ ephemeral: true });

  const player = await getOrCreatePlayer(interaction.user.id, interaction.user.username);

  await prisma.player.update({
    where: { id: player.id },
    data: { dmEnabled: enabled },
  });

  await interaction.editReply(
    enabled
      ? 'Notificações por DM **ativadas**. Você receberá avisos por mensagem privada.'
      : 'Notificações por DM **desativadas**. Você será mencionado no canal do duelo quando necessário.',
  );
}

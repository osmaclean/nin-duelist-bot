import { ButtonInteraction } from 'discord.js';
import { getDuelById, DuelWithPlayers } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { DuelStatus } from '@prisma/client';

type HandlerConfig = {
  expectedStatus: DuelStatus | DuelStatus[];
  permissionCheck: (interaction: ButtonInteraction, duel: DuelWithPlayers) => string | null;
  execute: (duelId: number, interaction: ButtonInteraction, duel: DuelWithPlayers) => Promise<DuelWithPlayers | null>;
  errorMessage: string;
};

export function createDuelButtonHandler(config: HandlerConfig) {
  return async function (interaction: ButtonInteraction) {
    const duelId = parseInt(interaction.customId.split(':')[1], 10);
    await interaction.deferUpdate();

    if (isNaN(duelId)) {
      await interaction.followUp({ content: 'Interação inválida.', ephemeral: true });
      return;
    }

    const duel = await getDuelById(duelId);

    const expectedStatuses = Array.isArray(config.expectedStatus)
      ? config.expectedStatus
      : [config.expectedStatus];

    if (!duel || !expectedStatuses.includes(duel.status)) {
      await interaction.followUp({ content: config.errorMessage, ephemeral: true });
      return;
    }

    const permissionError = config.permissionCheck(interaction, duel);
    if (permissionError) {
      await interaction.followUp({ content: permissionError, ephemeral: true });
      return;
    }

    const updated = await config.execute(duelId, interaction, duel);
    if (!updated) {
      await interaction.followUp({ content: config.errorMessage, ephemeral: true });
      return;
    }

    const embed = buildDuelEmbed(updated);
    const components = buildDuelComponents(updated);
    await interaction.editReply({ embeds: [embed], components });
  };
}

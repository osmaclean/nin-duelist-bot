import { ButtonInteraction, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { getDuelById, DuelWithPlayers } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { buildDuelComponents } from '../lib/components';
import { DuelStatus } from '@prisma/client';
import { checkCooldown } from '../lib/cooldown';
import { BUTTON_COOLDOWN_MS } from '../config';

export type ValidationConfig = {
  expectedStatus: DuelStatus | DuelStatus[];
  permissionCheck: (interaction: ButtonInteraction, duel: DuelWithPlayers) => string | null;
  errorMessage: string;
};

export type ValidationSuccess = { duelId: number; duel: DuelWithPlayers };
export type ValidationFailure = { error: string };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export async function validateDuelButton(
  interaction: ButtonInteraction,
  config: ValidationConfig,
): Promise<ValidationResult> {
  const duelId = parseInt(interaction.customId.split(':')[1], 10);
  if (isNaN(duelId)) return { error: 'Interação inválida.' };

  const duel = await getDuelById(duelId);
  const expectedStatuses = Array.isArray(config.expectedStatus)
    ? config.expectedStatus
    : [config.expectedStatus];

  if (!duel || !expectedStatuses.includes(duel.status)) return { error: config.errorMessage };

  const permissionError = config.permissionCheck(interaction, duel);
  if (permissionError) return { error: permissionError };

  return { duelId, duel };
}

/** Disables all buttons in the current message to show immediate feedback */
function disableAllButtons(interaction: ButtonInteraction): void {
  const message = interaction.message;
  if (!message?.components?.length) return;

  const disabledRows = message.components.map((row) => {
    const newRow = new ActionRowBuilder<ButtonBuilder>();
    for (const component of row.components) {
      newRow.addComponents(
        ButtonBuilder.from(component as any).setDisabled(true),
      );
    }
    return newRow;
  });

  interaction.editReply({ components: disabledRows }).catch(() => {});
}

type HandlerConfig = ValidationConfig & {
  execute: (duelId: number, interaction: ButtonInteraction, duel: DuelWithPlayers) => Promise<DuelWithPlayers | null>;
};

export function createDuelButtonHandler(config: HandlerConfig) {
  return async function (interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    // Immediate visual feedback: disable all buttons
    disableAllButtons(interaction);

    // Debounce: prevent rapid double-clicks
    const cooldownKey = `btn:${interaction.user.id}:${interaction.customId}`;
    if (!checkCooldown(cooldownKey, BUTTON_COOLDOWN_MS)) {
      return;
    }

    const result = await validateDuelButton(interaction, config);
    if ('error' in result) {
      await interaction.followUp({ content: result.error, ephemeral: true });
      return;
    }

    const updated = await config.execute(result.duelId, interaction, result.duel);
    if (!updated) {
      await interaction.followUp({ content: config.errorMessage, ephemeral: true });
      return;
    }

    const embed = buildDuelEmbed(updated);
    const components = buildDuelComponents(updated);
    await interaction.editReply({ embeds: [embed], components });
  };
}

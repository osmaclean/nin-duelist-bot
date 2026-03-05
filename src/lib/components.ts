import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DuelStatus } from '@prisma/client';

type DuelInfo = {
  id: number;
  status: DuelStatus;
  opponentAccepted: boolean;
  witnessAccepted: boolean;
};

export function buildDuelComponents(duel: DuelInfo): ActionRowBuilder<ButtonBuilder>[] {
  const { id, status } = duel;

  if (status === 'PROPOSED') {
    const buttons: ButtonBuilder[] = [];

    if (!duel.opponentAccepted) {
      buttons.push(
        new ButtonBuilder().setCustomId(`accept-duel:${id}`).setLabel('Aceitar Duelo').setStyle(ButtonStyle.Success),
      );
    }

    buttons.push(
      new ButtonBuilder().setCustomId(`cancel-duel:${id}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger),
    );

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
  }

  if (status === 'ACCEPTED') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`start-duel:${id}`).setLabel('Iniciar Duelo').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel-duel:${id}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  if (status === 'IN_PROGRESS') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`submit-result:${id}`)
          .setLabel('Enviar Resultado')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`cancel-duel:${id}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  if (status === 'AWAITING_VALIDATION') {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm-result:${id}`)
          .setLabel('Confirmar Resultado')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject-result:${id}`)
          .setLabel('Rejeitar Resultado')
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  return [];
}

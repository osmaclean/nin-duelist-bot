import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getPendingDuels, PendingDuel } from '../services/pending.service';
import { DUEL_EXPIRY_MS } from '../config';

const ACTION_LABELS: Record<number, string> = {
  0: 'Expirando em breve!',
  1: 'Aguardando sua validação',
  2: 'Aguardando sua aceitação',
  3: 'Pronto para iniciar',
  4: 'Em andamento',
};

function formatTimeLeft(duel: PendingDuel): string {
  if (duel.status !== 'PROPOSED') return '';
  const elapsed = Date.now() - duel.createdAt.getTime();
  const remaining = DUEL_EXPIRY_MS - elapsed;
  if (remaining <= 0) return ' (expirando)';
  const min = Math.ceil(remaining / 60_000);
  return ` (${min}min restantes)`;
}

function formatDuelLine(duel: PendingDuel): string {
  const action = ACTION_LABELS[duel.urgency] ?? 'Pendente';
  const time = formatTimeLeft(duel);
  return `**#${duel.id}** — <@${duel.challenger.discordId}> vs <@${duel.opponent.discordId}> | ${action}${time}`;
}

export async function handlePendingCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const allDuels = await getPendingDuels(interaction.user.id, season.id);

  if (allDuels.length === 0) {
    await interaction.editReply('Nenhum duelo pendente de a\u00e7\u00e3o sua.');
    return;
  }

  const limit = interaction.options.getInteger('limit');
  const duels = limit ? allDuels.slice(0, limit) : allDuels;
  const lines = duels.map(formatDuelLine);

  const embed = new EmbedBuilder()
    .setTitle('Suas Pendências')
    .setColor(Colors.Orange)
    .setDescription(lines.join('\n'))
    .setFooter({
      text: limit && allDuels.length > limit
        ? `Mostrando ${duels.length} de ${allDuels.length} duelo(s) pendente(s)`
        : `${duels.length} duelo(s) pendente(s)`,
    });

  await interaction.editReply({ embeds: [embed] });
}

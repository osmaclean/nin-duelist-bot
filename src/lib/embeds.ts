import { EmbedBuilder, Colors } from 'discord.js';
import { Duel, Player, DuelStatus, DuelMode, DuelFormat } from '@prisma/client';

type DuelWithPlayers = Duel & {
  challenger: Player;
  opponent: Player;
  witness?: Player | null;
  winner?: Player | null;
};

const STATUS_LABELS: Record<DuelStatus, string> = {
  PROPOSED: 'Aguardando aceitação',
  ACCEPTED: 'Aceito — Pronto para iniciar',
  IN_PROGRESS: 'Em andamento',
  RESULT_SUBMITTED: 'Resultado enviado',
  AWAITING_VALIDATION: 'Aguardando validação da testemunha',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<DuelStatus, number> = {
  PROPOSED: Colors.Yellow,
  ACCEPTED: Colors.Blue,
  IN_PROGRESS: Colors.Orange,
  RESULT_SUBMITTED: Colors.Purple,
  AWAITING_VALIDATION: Colors.Purple,
  CONFIRMED: Colors.Green,
  CANCELLED: Colors.Red,
  EXPIRED: Colors.DarkGrey,
};

export function buildDuelEmbed(duel: DuelWithPlayers): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Duelo')
    .setColor(STATUS_COLORS[duel.status])
    .addFields(
      { name: 'Desafiante', value: `<@${duel.challenger.discordId}>`, inline: true },
      { name: 'Oponente', value: `<@${duel.opponent.discordId}>`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Formato', value: duel.format === 'MD1' ? 'Melhor de 1' : 'Melhor de 3', inline: true },
      { name: 'Modo', value: duel.mode === 'RANKED' ? 'Ranked' : 'Casual', inline: true },
      { name: 'Status', value: STATUS_LABELS[duel.status], inline: true },
    );

  if (duel.witness) {
    embed.addFields({ name: 'Testemunha', value: `<@${duel.witness.discordId}>`, inline: true });
  }

  // Acceptance status
  if (duel.status === 'PROPOSED') {
    const parts: string[] = [];
    parts.push(`Oponente: ${duel.opponentAccepted ? 'Aceito' : 'Pendente'}`);
    if (duel.witness) {
      parts.push(`Testemunha: ${duel.witnessAccepted ? 'Aceito' : 'Pendente'}`);
    }
    embed.addFields({ name: 'Aceitação', value: parts.join('\n') });
  }

  // Score
  if (duel.scoreWinner !== null && duel.scoreLoser !== null && duel.winner) {
    embed.addFields({
      name: 'Placar',
      value: `<@${duel.winner.discordId}> venceu ${duel.scoreWinner}-${duel.scoreLoser}`,
    });
  }

  embed.setFooter({ text: `Duelo #${duel.id}` });
  embed.setTimestamp(duel.createdAt);

  return embed;
}

export function buildRankEmbed(
  seasonNumber: number,
  entries: Array<{ player: Player; points: number; wins: number; losses: number; streak: number; peakStreak: number }>,
  page: number,
  totalPages: number,
  startRank: number,
) {
  const lines = entries.map((e, i) => {
    const rank = startRank + i;
    const medal = rank <= 3 ? ['', '', ''][rank - 1] : `**${rank}.**`;
    return `${medal} <@${e.player.discordId}> — ${e.points}pts | ${e.wins}V ${e.losses}D | Streak: ${e.streak} (max ${e.peakStreak})`;
  });

  return new EmbedBuilder()
    .setTitle(`Ranking — Season ${seasonNumber}`)
    .setColor(Colors.Gold)
    .setDescription(lines.length ? lines.join('\n') : 'Nenhum jogador nesta season ainda.')
    .setFooter({ text: `Página ${page}/${totalPages}` });
}

export function buildMvpEmbed(
  seasonNumber: number,
  entries: Array<{ player: Player; points: number; wins: number; losses: number; streak: number; peakStreak: number }>,
) {
  const lines = entries.map((e, i) => {
    const medal = ['', '', '', '4.', '5.'][i] ?? `${i + 1}.`;
    return `${medal} <@${e.player.discordId}> — ${e.points}pts | ${e.wins}V ${e.losses}D | Peak Streak: ${e.peakStreak}`;
  });

  return new EmbedBuilder()
    .setTitle(`MVP — Season ${seasonNumber}`)
    .setColor(Colors.Gold)
    .setDescription(lines.length ? lines.join('\n') : 'Nenhum jogador nesta season ainda.');
}

import { EmbedBuilder, Colors } from 'discord.js';
import { Player, DuelStatus } from '@prisma/client';
import { DuelWithPlayers } from '../services/duel.service';

const STATUS_LABELS: Record<DuelStatus, string> = {
  PROPOSED: 'Aguardando aceitação',
  ACCEPTED: 'Aceito — Pronto para iniciar',
  IN_PROGRESS: 'Em andamento',
  AWAITING_VALIDATION: 'Aguardando validação da testemunha',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<DuelStatus, number> = {
  PROPOSED: Colors.Yellow,
  ACCEPTED: Colors.Blue,
  IN_PROGRESS: Colors.Orange,
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
      { name: 'Status', value: STATUS_LABELS[duel.status], inline: true },
      { name: 'Testemunha', value: `<@${duel.witness.discordId}>`, inline: true },
    );

  // Acceptance status
  if (duel.status === 'PROPOSED') {
    embed.addFields({
      name: 'Aceitação',
      value: `Oponente: ${duel.opponentAccepted ? 'Aceito' : 'Pendente'}`,
    });
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

function isTied(
  a: { points: number; wins: number; peakStreak: number },
  b: { points: number; wins: number; peakStreak: number },
): boolean {
  return a.points === b.points && a.wins === b.wins && a.peakStreak === b.peakStreak;
}

function rankLabel(rank: number): string {
  if (rank <= 3) return ['\u{1F947}', '\u{1F948}', '\u{1F949}'][rank - 1];
  return `**${rank}.**`;
}

export function buildRankEmbed(
  seasonNumber: number,
  entries: Array<{ player: Player; points: number; wins: number; losses: number; streak: number; peakStreak: number }>,
  page: number,
  totalPages: number,
  startRank: number,
) {
  let currentRank = startRank;
  const lines = entries.map((e, i) => {
    if (i > 0) {
      currentRank = isTied(e, entries[i - 1]) ? currentRank : startRank + i;
    }
    return `${rankLabel(currentRank)} <@${e.player.discordId}> • ${e.points}pts | ${e.wins}V ${e.losses}D | Streak: ${e.streak} (max ${e.peakStreak})`;
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
  let currentRank = 1;
  const lines = entries.map((e, i) => {
    if (i > 0) {
      currentRank = isTied(e, entries[i - 1]) ? currentRank : i + 1;
    }
    return `${rankLabel(currentRank)} <@${e.player.discordId}> • ${e.points}pts | ${e.wins}V ${e.losses}D | Peak Streak: ${e.peakStreak}`;
  });

  return new EmbedBuilder()
    .setTitle(`MVP — Season ${seasonNumber}`)
    .setColor(Colors.Gold)
    .setDescription(lines.length ? lines.join('\n') : 'Nenhum jogador nesta season ainda.');
}

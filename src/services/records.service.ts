import { prisma } from '../lib/prisma';

const MIN_GAMES_FOR_WINRATE = 5;

export type RecordEntry = {
  discordId: string;
  value: number;
};

export type SeasonRecords = {
  bestStreak: RecordEntry | null;
  bestWinRate: (RecordEntry & { wins: number; total: number }) | null;
  mostDuels: (RecordEntry & { wins: number; losses: number }) | null;
};

export async function getSeasonRecords(seasonId: number): Promise<SeasonRecords> {
  const players = await prisma.playerSeason.findMany({
    where: { seasonId },
    include: { player: true },
  });

  let bestStreak: RecordEntry | null = null;
  let bestWinRate: (RecordEntry & { wins: number; total: number }) | null = null;
  let mostDuels: (RecordEntry & { wins: number; losses: number }) | null = null;

  for (const ps of players) {
    const total = ps.wins + ps.losses;

    // Best peak streak
    if (!bestStreak || ps.peakStreak > bestStreak.value) {
      bestStreak = { discordId: ps.player.discordId, value: ps.peakStreak };
    }

    // Best win rate (min games)
    if (total >= MIN_GAMES_FOR_WINRATE) {
      const winRate = Math.round((ps.wins / total) * 100);
      if (!bestWinRate || winRate > bestWinRate.value) {
        bestWinRate = { discordId: ps.player.discordId, value: winRate, wins: ps.wins, total };
      }
    }

    // Most duels
    if (!mostDuels || total > mostDuels.value) {
      mostDuels = { discordId: ps.player.discordId, value: total, wins: ps.wins, losses: ps.losses };
    }
  }

  return { bestStreak, bestWinRate, mostDuels };
}

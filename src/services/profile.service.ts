import { prisma } from '../lib/prisma';
import { getPlayerRank } from './ranking.service';

export type ProfileResult = {
  points: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  peakStreak: number;
  rank: number | null;
  seasonsPlayed: number;
} | null;

export async function getPlayerProfile(discordId: string, seasonId: number): Promise<ProfileResult> {
  const player = await prisma.player.findUnique({ where: { discordId } });
  if (!player) return null;

  const [playerSeason, seasonsPlayed] = await Promise.all([
    prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId: player.id, seasonId } },
    }),
    prisma.playerSeason.count({ where: { playerId: player.id } }),
  ]);

  if (!playerSeason) return null;

  const total = playerSeason.wins + playerSeason.losses;
  const winRate = total > 0 ? Math.round((playerSeason.wins / total) * 100) : 0;
  const rank = await getPlayerRank(player.id, seasonId);

  return {
    points: playerSeason.points,
    wins: playerSeason.wins,
    losses: playerSeason.losses,
    winRate,
    streak: playerSeason.streak,
    peakStreak: playerSeason.peakStreak,
    rank,
    seasonsPlayed,
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRankCommand } from './rank';
import { getActiveSeason } from '../services/season.service';
import { getLeaderboard } from '../services/ranking.service';
import { buildRankEmbed } from '../lib/embeds';
import { buildPaginationRow } from '../lib/pagination';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/ranking.service', () => ({
  getLeaderboard: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildRankEmbed: vi.fn(),
}));

vi.mock('../lib/pagination', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pagination')>()),
  buildPaginationRow: vi.fn(),
}));

describe('commands/rank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply with no active season message', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: { getInteger: vi.fn().mockReturnValue(1) },
    } as any;

    await handleRankCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: 'Nenhuma season ativa no momento.',
    });
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it('should use page=1 when option is omitted', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 9, number: 1 });
    (getLeaderboard as any).mockResolvedValue({
      players: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
    (buildRankEmbed as any).mockReturnValue({ rank: true });
    (buildPaginationRow as any).mockReturnValue({ row: true });
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: { getInteger: vi.fn().mockReturnValue(null) },
    } as any;

    await handleRankCommand(interaction);

    expect(getLeaderboard).toHaveBeenCalledWith(9, 1);
  });

  it('should reject invalid page above total pages', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 9, number: 1 });
    (getLeaderboard as any).mockResolvedValue({
      players: [],
      total: 0,
      page: 9,
      totalPages: 2,
    });
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: { getInteger: vi.fn().mockReturnValue(9) },
    } as any;

    await handleRankCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: 'Página inválida. Total: 2',
    });
    expect(buildRankEmbed).not.toHaveBeenCalled();
    expect(buildPaginationRow).not.toHaveBeenCalled();
  });

  it('should render leaderboard and pagination for valid page', async () => {
    const embed = { embed: true };
    const row = { row: true };
    (getActiveSeason as any).mockResolvedValue({ id: 10, number: 5 });
    (getLeaderboard as any).mockResolvedValue({
      players: [{ player: { discordId: '1' }, points: 2, wins: 2, losses: 0, streak: 2, peakStreak: 2 }],
      total: 1,
      page: 2,
      totalPages: 3,
    });
    (buildRankEmbed as any).mockReturnValue(embed);
    (buildPaginationRow as any).mockReturnValue(row);
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: { getInteger: vi.fn().mockReturnValue(2) },
    } as any;

    await handleRankCommand(interaction);

    expect(buildRankEmbed).toHaveBeenCalledWith(
      5,
      expect.any(Array),
      2,
      3,
      21,
    );
    expect(buildPaginationRow).toHaveBeenCalledWith(2, 3);
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [embed], components: [row] });
  });

  it('should propagate errors from dependencies', async () => {
    (getActiveSeason as any).mockRejectedValue(new Error('rank fail'));
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: { getInteger: vi.fn().mockReturnValue(1) },
    } as any;

    await expect(handleRankCommand(interaction)).rejects.toThrow('rank fail');
  });
});

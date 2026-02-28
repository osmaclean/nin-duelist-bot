import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPaginationRow, handleRankPagination } from './pagination';
import { getActiveSeason } from '../services/season.service';
import { getLeaderboard } from '../services/ranking.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/ranking.service', () => ({
  getLeaderboard: vi.fn(),
}));

describe('lib/pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildPaginationRow should disable prev on first page and next on last page', () => {
    const first = buildPaginationRow(1, 3).toJSON();
    const last = buildPaginationRow(3, 3).toJSON();

    const firstButtons = first.components as any[];
    const lastButtons = last.components as any[];

    expect(firstButtons[0].disabled).toBe(true);
    expect(firstButtons[1].disabled).toBe(false);
    expect(lastButtons[0].disabled).toBe(false);
    expect(lastButtons[1].disabled).toBe(true);
  });

  it('handleRankPagination should followUp with error on invalid page id', async () => {
    const interaction = {
      customId: 'rank-page-abc',
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn(),
    } as any;

    await handleRankPagination(interaction);

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'Página inválida.',
      ephemeral: true,
    });
    expect(getActiveSeason).not.toHaveBeenCalled();
  });

  it('handleRankPagination should reply ephemeral when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const interaction = {
      customId: 'rank-page-2',
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn(),
    } as any;

    await handleRankPagination(interaction);

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'Nenhuma season ativa.',
      ephemeral: true,
    });
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it('handleRankPagination should update message with embed and row on success', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, number: 4 });
    (getLeaderboard as any).mockResolvedValue({
      players: [
        {
          player: { discordId: '1' },
          points: 5,
          wins: 3,
          losses: 1,
          streak: 2,
          peakStreak: 2,
        },
      ],
      total: 1,
      page: 2,
      totalPages: 5,
    });

    const interaction = {
      customId: 'rank-page-2',
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn(),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await handleRankPagination(interaction);

    expect(getLeaderboard).toHaveBeenCalledWith(10, 2);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.components).toHaveLength(1);
  });

  it('handleRankPagination should propagate errors from dependencies', async () => {
    (getActiveSeason as any).mockRejectedValue(new Error('season boom'));
    const interaction = {
      customId: 'rank-page-1',
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn(),
      editReply: vi.fn(),
    } as any;

    await expect(handleRankPagination(interaction)).rejects.toThrow('season boom');
  });
});

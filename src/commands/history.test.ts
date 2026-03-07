import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleHistoryCommand } from './history';
import { getActiveSeason } from '../services/season.service';
import { getPlayerHistory } from '../services/history.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/history.service', () => ({
  getPlayerHistory: vi.fn(),
}));

vi.mock('../lib/pagination', () => ({
  buildHistoryPaginationRow: vi.fn().mockReturnValue({ type: 1, components: [] }),
}));

function interaction(opts: { targetUser?: any; vs?: any; from?: string | null; to?: string | null; page?: number | null } = {}) {
  return {
    user: { id: 'u1', displayAvatarURL: () => 'https://avatar/u1' },
    options: {
      getUser: vi.fn((name: string) => {
        if (name === 'player') return opts.targetUser ?? null;
        if (name === 'vs') return opts.vs ?? null;
        return null;
      }),
      getString: vi.fn((name: string) => {
        if (name === 'from') return opts.from ?? null;
        if (name === 'to') return opts.to ?? null;
        return null;
      }),
      getInteger: vi.fn((name: string) => {
        if (name === 'page') return opts.page ?? null;
        return null;
      }),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handleHistoryCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reply no history when player has no stats', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 3 });
    (getPlayerHistory as any).mockResolvedValue({ stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 });
    const i = interaction();

    await handleHistoryCommand(i);

    expect(getPlayerHistory).toHaveBeenCalledWith('u1', 1, 1, {});
    expect(i.editReply).toHaveBeenCalledWith('<@u1> nao tem historico nesta season.');
  });

  it('should show embed with stats and recent duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5, number: 2 });
    (getPlayerHistory as any).mockResolvedValue({
      stats: { points: 7, wins: 9, losses: 3, streak: 2, peakStreak: 5, winRate: 75 },
      recentDuels: [
        {
          id: 1,
          updatedAt: new Date('2026-02-20T10:00:00Z'),
          scoreWinner: 2,
          scoreLoser: 1,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
          winner: { discordId: 'u1' },
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();

    const fieldNames = embed.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('Pontos');
    expect(fieldNames).toContain('V/D');
    expect(fieldNames).toContain('Win Rate');

    const vd = embed.fields.find((f: any) => f.name === 'V/D');
    expect(vd.value).toBe('9V 3D');
  });

  it('should use target user when player option is provided', async () => {
    const target = { id: 'u9', displayAvatarURL: () => 'https://avatar/u9' };
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({ stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 });
    const i = interaction({ targetUser: target });

    await handleHistoryCommand(i);

    expect(getPlayerHistory).toHaveBeenCalledWith('u9', 1, 1, {});
  });

  it('should pass filters to service when vs/from/to provided', async () => {
    const vsUser = { id: 'u5' };
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({ stats: null, recentDuels: [], total: 0, page: 1, totalPages: 1 });
    const i = interaction({ vs: vsUser, from: '2026-01-01', to: '2026-01-31', page: 2 });

    await handleHistoryCommand(i);

    expect(getPlayerHistory).toHaveBeenCalledWith('u1', 1, 2, {
      vsDiscordId: 'u5',
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
  });

  it('should include pagination buttons when totalPages > 1', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({
      stats: { points: 5, wins: 5, losses: 0, streak: 5, peakStreak: 5, winRate: 100 },
      recentDuels: [
        {
          id: 1,
          updatedAt: new Date('2026-02-20T10:00:00Z'),
          scoreWinner: 1,
          scoreLoser: 0,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
          winner: { discordId: 'u1' },
        },
      ],
      total: 25,
      page: 1,
      totalPages: 3,
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toHaveLength(1);
  });

  it('should not include pagination buttons when totalPages is 1', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({
      stats: { points: 1, wins: 1, losses: 0, streak: 1, peakStreak: 1, winRate: 100 },
      recentDuels: [
        {
          id: 1,
          updatedAt: new Date('2026-02-20T10:00:00Z'),
          scoreWinner: 1,
          scoreLoser: 0,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
          winner: { discordId: 'u1' },
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toHaveLength(0);
  });
});

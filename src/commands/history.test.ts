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

function interaction(targetUser: any = null) {
  return {
    user: { id: 'u1', displayAvatarURL: () => 'https://avatar/u1' },
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
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
    (getPlayerHistory as any).mockResolvedValue({ stats: null, recentDuels: [] });
    const i = interaction();

    await handleHistoryCommand(i);

    expect(getPlayerHistory).toHaveBeenCalledWith('u1', 1);
    expect(i.editReply).toHaveBeenCalledWith('<@u1> não tem histórico nesta season.');
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
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Histórico — Season 2');

    const fieldNames = embed.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('Pontos');
    expect(fieldNames).toContain('V/D');
    expect(fieldNames).toContain('Win Rate');
    expect(fieldNames).toContain('Streak Atual');
    expect(fieldNames).toContain('Peak Streak');

    const vd = embed.fields.find((f: any) => f.name === 'V/D');
    expect(vd.value).toBe('9V 3D');

    const wr = embed.fields.find((f: any) => f.name === 'Win Rate');
    expect(wr.value).toBe('75%');

    const recentField = embed.fields.find((f: any) => f.name.includes('Últimos'));
    expect(recentField.value).toContain('V');
    expect(recentField.value).toContain('2-1');
    expect(recentField.value).toContain('<@u2>');
  });

  it('should use target user when player option is provided', async () => {
    const target = { id: 'u9', displayAvatarURL: () => 'https://avatar/u9' };
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({ stats: null, recentDuels: [] });
    const i = interaction(target);

    await handleHistoryCommand(i);

    expect(getPlayerHistory).toHaveBeenCalledWith('u9', 1);
    expect(i.editReply).toHaveBeenCalledWith('<@u9> não tem histórico nesta season.');
  });

  it('should show no duels message when stats exist but no confirmed duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({
      stats: { points: 0, wins: 0, losses: 0, streak: 0, peakStreak: 0, winRate: 0 },
      recentDuels: [],
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    const recentField = embed.fields.find((f: any) => f.name === 'Duelos recentes');
    expect(recentField.value).toBe('Nenhum duelo confirmado ainda.');
  });

  it('should show defeat correctly when player lost', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerHistory as any).mockResolvedValue({
      stats: { points: -1, wins: 0, losses: 1, streak: 0, peakStreak: 0, winRate: 0 },
      recentDuels: [
        {
          id: 5,
          updatedAt: new Date('2026-01-15T10:00:00Z'),
          scoreWinner: 1,
          scoreLoser: 0,
          challenger: { discordId: 'u1' },
          opponent: { discordId: 'u2' },
          winner: { discordId: 'u2' },
        },
      ],
    });
    const i = interaction();

    await handleHistoryCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    const recentField = embed.fields.find((f: any) => f.name.includes('Últimos'));
    expect(recentField.value).toContain('D');
    expect(recentField.value).toContain('0-1');
  });
});

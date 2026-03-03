import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRecordsCommand } from './records';
import { getActiveSeason } from '../services/season.service';
import { getSeasonRecords } from '../services/records.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/records.service', () => ({
  getSeasonRecords: vi.fn(),
}));

function interaction() {
  return {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handleRecordsCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reply no records when all null', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getSeasonRecords as any).mockResolvedValue({
      bestStreak: null,
      bestWinRate: null,
      mostDuels: null,
    });
    const i = interaction();

    await handleRecordsCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Nenhum recorde registrado nesta season ainda.');
  });

  it('should show embed with all records', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5, number: 3 });
    (getSeasonRecords as any).mockResolvedValue({
      bestStreak: { discordId: 'u1', value: 7 },
      bestWinRate: { discordId: 'u2', value: 85, wins: 17, total: 20 },
      mostDuels: { discordId: 'u3', value: 25, wins: 15, losses: 10 },
    });
    const i = interaction();

    await handleRecordsCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Recordes — Season 3');

    const streak = embed.fields.find((f: any) => f.name === 'Maior Streak');
    expect(streak.value).toContain('<@u1>');
    expect(streak.value).toContain('7 vitórias seguidas');

    const wr = embed.fields.find((f: any) => f.name.includes('Win Rate'));
    expect(wr.value).toContain('<@u2>');
    expect(wr.value).toContain('85%');

    const duels = embed.fields.find((f: any) => f.name === 'Mais Duelos');
    expect(duels.value).toContain('<@u3>');
    expect(duels.value).toContain('25 duelos');
  });

  it('should show partial records when only some exist', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getSeasonRecords as any).mockResolvedValue({
      bestStreak: { discordId: 'u1', value: 3 },
      bestWinRate: null,
      mostDuels: { discordId: 'u1', value: 4, wins: 3, losses: 1 },
    });
    const i = interaction();

    await handleRecordsCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    const fieldNames = embed.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('Maior Streak');
    expect(fieldNames).toContain('Mais Duelos');
    expect(fieldNames).not.toContain('Melhor Win Rate (min. 5 jogos)');
  });
});

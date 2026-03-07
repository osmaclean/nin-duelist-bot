import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSeasonCommand } from './season';
import { getActiveSeason, getSeasonStatus, getSeasonPodium } from '../services/season.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
  getSeasonStatus: vi.fn(),
  getSeasonPodium: vi.fn(),
}));

function interaction() {
  return {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/season', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handleSeasonCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should show season status with podium', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));

    (getActiveSeason as any).mockResolvedValue({ id: 10 });
    (getSeasonStatus as any).mockResolvedValue({
      id: 10,
      number: 3,
      name: null,
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-03-03T00:00:00Z'),
      active: true,
      championId: null,
      totalDuels: 42,
      activePlayers: 15,
    });
    (getSeasonPodium as any).mockResolvedValue([
      { rank: 1, playerId: 1, discordId: 'u1', points: 10, wins: 12, losses: 2, peakStreak: 5 },
      { rank: 2, playerId: 2, discordId: 'u2', points: 8, wins: 9, losses: 1, peakStreak: 4 },
    ]);

    const i = interaction();
    await handleSeasonCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Season 3');

    const daysField = embed.fields.find((f: any) => f.name === 'Dias restantes');
    expect(daysField.value).toBe('2');

    const duelsField = embed.fields.find((f: any) => f.name === 'Total de duelos');
    expect(duelsField.value).toBe('42');

    const topField = embed.fields.find((f: any) => f.name === 'Top 3 parcial');
    expect(topField.value).toContain('<@u1>');
    expect(topField.value).toContain('<@u2>');

    vi.useRealTimers();
  });

  it('should show season name when set', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5 });
    (getSeasonStatus as any).mockResolvedValue({
      id: 5,
      number: 2,
      name: 'Torneio de Verao',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2099-01-01T00:00:00Z'),
      active: true,
      championId: null,
      totalDuels: 0,
      activePlayers: 0,
    });
    (getSeasonPodium as any).mockResolvedValue([]);

    const i = interaction();
    await handleSeasonCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toBe('Torneio de Verao (Season 2)');

    const topField = embed.fields.find((f: any) => f.name === 'Top 3 parcial');
    expect(topField.value).toBe('Nenhum jogador ainda.');
  });

  it('should show error when status returns null', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1 });
    (getSeasonStatus as any).mockResolvedValue(null);
    (getSeasonPodium as any).mockResolvedValue([]);

    const i = interaction();
    await handleSeasonCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Erro ao buscar dados da season.');
  });
});

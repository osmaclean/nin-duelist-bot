import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleActivityCommand } from './activity';
import { getActiveSeason } from '../services/season.service';
import { getMostActive } from '../services/activity.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/activity.service', () => ({
  getMostActive: vi.fn(),
}));

function interaction() {
  return {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handleActivityCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reply no players when list is empty', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getMostActive as any).mockResolvedValue([]);
    const i = interaction();

    await handleActivityCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Nenhum jogador ativo nesta season ainda.');
  });

  it('should show embed with ranked activity list', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5, number: 2 });
    (getMostActive as any).mockResolvedValue([
      { discordId: 'u1', totalDuels: 10, wins: 7, losses: 3 },
      { discordId: 'u2', totalDuels: 6, wins: 3, losses: 3 },
    ]);
    const i = interaction();

    await handleActivityCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Mais Ativos — Season 2');
    expect(embed.description).toContain('<@u1> — 10 duelos (7V 3D)');
    expect(embed.description).toContain('<@u2> — 6 duelos (3V 3D)');
  });
});

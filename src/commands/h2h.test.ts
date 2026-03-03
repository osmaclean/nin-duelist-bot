import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleH2hCommand } from './h2h';
import { getActiveSeason } from '../services/season.service';
import { getHeadToHead } from '../services/h2h.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/h2h.service', () => ({
  getHeadToHead: vi.fn(),
}));

function mockUser(id: string, bot = false) {
  return { id, bot, displayAvatarURL: () => `https://avatar/${id}` };
}

function interaction(userA: any = null, userB: any = null) {
  return {
    user: { id: 'caller' },
    options: {
      getUser: vi.fn((name: string) => (name === 'player_a' ? userA : userB)),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/h2h', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction(mockUser('a'), mockUser('b'));

    await handleH2hCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reject same user', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    const i = interaction(mockUser('u1'), mockUser('u1'));

    await handleH2hCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Selecione dois jogadores diferentes.');
  });

  it('should reject bots', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    const i = interaction(mockUser('u1'), mockUser('bot1', true));

    await handleH2hCommand(i);

    expect(i.editReply).toHaveBeenCalledWith('Bots não participam de duelos.');
  });

  it('should show simple message when no duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getHeadToHead as any).mockResolvedValue({
      totalDuels: 0, winsA: 0, winsB: 0, winRateA: 0, winRateB: 0, recentDuels: [],
    });
    const i = interaction(mockUser('a'), mockUser('b'));

    await handleH2hCommand(i);

    expect(getHeadToHead).toHaveBeenCalledWith('a', 'b', 1);
    expect(i.editReply).toHaveBeenCalledWith('Nenhum confronto entre <@a> e <@b> nesta season.');
  });

  it('should show embed with stats and recent duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5, number: 2 });
    (getHeadToHead as any).mockResolvedValue({
      totalDuels: 3,
      winsA: 2,
      winsB: 1,
      winRateA: 67,
      winRateB: 33,
      recentDuels: [
        {
          id: 1,
          updatedAt: new Date('2026-02-20T10:00:00Z'),
          scoreWinner: 2,
          scoreLoser: 1,
          winner: { discordId: 'a' },
        },
      ],
    });
    const i = interaction(mockUser('a'), mockUser('b'));

    await handleH2hCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('H2H — Season 2');

    const fieldNames = embed.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('Jogador A');
    expect(fieldNames).toContain('Jogador B');
    expect(fieldNames).toContain('Duelos');
    expect(fieldNames).toContain('Vitórias A');
    expect(fieldNames).toContain('Vitórias B');

    const duelos = embed.fields.find((f: any) => f.name === 'Duelos');
    expect(duelos.value).toBe('3');

    const winsA = embed.fields.find((f: any) => f.name === 'Vitórias A');
    expect(winsA.value).toBe('2 (67%)');

    const winsB = embed.fields.find((f: any) => f.name === 'Vitórias B');
    expect(winsB.value).toBe('1 (33%)');

    const recentField = embed.fields.find((f: any) => f.name.includes('Últimos'));
    expect(recentField).toBeDefined();
    expect(recentField.value).toContain('V');
    expect(recentField.value).toContain('2-1');
  });
});

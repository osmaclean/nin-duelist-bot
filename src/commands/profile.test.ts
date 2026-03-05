import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleProfileCommand } from './profile';
import { getActiveSeason } from '../services/season.service';
import { getPlayerProfile } from '../services/profile.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/profile.service', () => ({
  getPlayerProfile: vi.fn(),
}));

function interaction(targetUser: any = null) {
  return {
    user: { id: 'u1', username: 'Ninja', displayAvatarURL: () => 'https://avatar/u1' },
    options: {
      getUser: vi.fn().mockReturnValue(targetUser),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply no season when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handleProfileCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reply no profile when player has no data', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerProfile as any).mockResolvedValue(null);
    const i = interaction();

    await handleProfileCommand(i);

    expect(getPlayerProfile).toHaveBeenCalledWith('u1', 1);
    expect(i.editReply).toHaveBeenCalledWith('<@u1> não tem perfil nesta season.');
  });

  it('should show profile embed with rank and stats', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5, number: 3 });
    (getPlayerProfile as any).mockResolvedValue({
      points: 10,
      wins: 12,
      losses: 2,
      winRate: 86,
      streak: 4,
      peakStreak: 7,
      rank: 1,
      seasonsPlayed: 3,
    });
    const i = interaction();

    await handleProfileCommand(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toContain('Perfil');
    expect(embed.title).toContain('Ninja');

    const rank = embed.fields.find((f: any) => f.name === 'Ranking');
    expect(rank.value).toBe('#1');

    const vd = embed.fields.find((f: any) => f.name === 'V/D');
    expect(vd.value).toBe('12V 2D');

    const seasons = embed.fields.find((f: any) => f.name === 'Seasons');
    expect(seasons.value).toBe('3');

    expect(embed.footer.text).toBe('Season 3');
  });

  it('should use target user when player option is provided', async () => {
    const target = { id: 'u9', username: 'Rival', displayAvatarURL: () => 'https://avatar/u9' };
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerProfile as any).mockResolvedValue(null);
    const i = interaction(target);

    await handleProfileCommand(i);

    expect(getPlayerProfile).toHaveBeenCalledWith('u9', 1);
  });

  it('should show medal emoji for top 3 ranks', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerProfile as any).mockResolvedValue({
      points: 5,
      wins: 5,
      losses: 0,
      winRate: 100,
      streak: 5,
      peakStreak: 5,
      rank: 2,
      seasonsPlayed: 1,
    });
    const i = interaction();

    await handleProfileCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain('\u{1F948}'); // silver medal
  });

  it('should not show medal for rank > 3', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1, number: 1 });
    (getPlayerProfile as any).mockResolvedValue({
      points: 1,
      wins: 1,
      losses: 0,
      winRate: 100,
      streak: 1,
      peakStreak: 1,
      rank: 5,
      seasonsPlayed: 1,
    });
    const i = interaction();

    await handleProfileCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).not.toContain('\u{1F947}');
    expect(embed.title).not.toContain('\u{1F948}');
    expect(embed.title).not.toContain('\u{1F949}');
  });
});

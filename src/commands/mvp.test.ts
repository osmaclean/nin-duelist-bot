import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMvpCommand } from './mvp';
import { getActiveSeason } from '../services/season.service';
import { getTopPlayers } from '../services/ranking.service';
import { buildMvpEmbed } from '../lib/embeds';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/ranking.service', () => ({
  getTopPlayers: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildMvpEmbed: vi.fn(),
}));

describe('commands/mvp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply with no active season message', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await handleMvpCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: 'Nenhuma season ativa no momento.',
    });
    expect(getTopPlayers).not.toHaveBeenCalled();
  });

  it('should render top 5 MVP for active season', async () => {
    const embed = { data: 'embed' };
    (getActiveSeason as any).mockResolvedValue({ id: 10, number: 3 });
    (getTopPlayers as any).mockResolvedValue([{ player: { discordId: '1' } }]);
    (buildMvpEmbed as any).mockReturnValue(embed);
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await handleMvpCommand(interaction);

    expect(getTopPlayers).toHaveBeenCalledWith(10, 5);
    expect(buildMvpEmbed).toHaveBeenCalledWith(3, [{ player: { discordId: '1' } }]);
    expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [embed] });
  });

  it('should propagate errors from dependencies', async () => {
    (getActiveSeason as any).mockRejectedValue(new Error('season fail'));
    const interaction = {
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as any;

    await expect(handleMvpCommand(interaction)).rejects.toThrow('season fail');
  });
});

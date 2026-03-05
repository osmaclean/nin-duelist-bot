import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSettingsCommand } from './settings';
import { getOrCreatePlayer } from '../services/player.service';

vi.mock('../services/player.service', () => ({
  getOrCreatePlayer: vi.fn().mockResolvedValue({ id: 1, discordId: 'u1', username: 'User1' }),
}));

const mockUpdate = vi.fn().mockResolvedValue({});
vi.mock('../lib/prisma', () => ({
  prisma: {
    player: { update: (...args: any[]) => mockUpdate(...args) },
  },
}));

function interaction(toggle: string) {
  return {
    user: { id: 'u1', username: 'User1' },
    options: {
      getString: vi.fn().mockReturnValue(toggle),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enable DM notifications', async () => {
    const i = interaction('on');
    await handleSettingsCommand(i);

    expect(getOrCreatePlayer).toHaveBeenCalledWith('u1', 'User1');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { dmEnabled: true },
    });
    expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('ativadas'));
  });

  it('should disable DM notifications', async () => {
    const i = interaction('off');
    await handleSettingsCommand(i);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { dmEnabled: false },
    });
    expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('desativadas'));
  });
});

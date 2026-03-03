import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStartDuel } from './start-duel';
import { getDuelById, startDuel } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  startDuel: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
}));

function interaction(customId = 'start-duel:10', userId = 'u1') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/start-duel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not ACCEPTED', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'PROPOSED' });
    const i = interaction();

    await handleStartDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode ser iniciado.',
      ephemeral: true,
    });
  });

  it('should reject when user is not a duelist', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'ACCEPTED',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
    });
    const i = interaction('start-duel:10', 'u9');

    await handleStartDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas os duelistas podem iniciar o duelo.',
      ephemeral: true,
    });
  });

  it('should return error when service fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'ACCEPTED',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
    });
    (startDuel as any).mockResolvedValue(null);
    const i = interaction();

    await handleStartDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode ser iniciado.',
      ephemeral: true,
    });
  });

  it('should update message with submit-result and cancel buttons on success', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'ACCEPTED',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
    });
    (startDuel as any).mockResolvedValue({ id: 10, status: 'IN_PROGRESS' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleStartDuel(i);

    expect(i.editReply).toHaveBeenCalledTimes(1);
    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toEqual([{ embed: true }]);
    expect(payload.components).toHaveLength(1);
  });
});

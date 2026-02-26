import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCancelDuel } from './cancel-duel';
import { cancelDuel, getDuelById } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  cancelDuel: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function interaction(customId = 'cancel-duel:10', userId = 'u1') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/cancel-duel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not found', async () => {
    (getDuelById as any).mockResolvedValue(null);
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Duelo não encontrado.',
      ephemeral: true,
    });
  });

  it('should reject when status is not cancelable', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'CONFIRMED',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      witness: { discordId: 'u3' },
    });
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode mais ser cancelado.',
      ephemeral: true,
    });
  });

  it('should reject when user is not participant', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      witness: { discordId: 'u3' },
    });
    const i = interaction('cancel-duel:10', 'u9');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas os participantes do duelo podem cancelá-lo.',
      ephemeral: true,
    });
  });

  it('should return error when cancel service fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      witness: { discordId: 'u3' },
    });
    (cancelDuel as any).mockResolvedValue(null);
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Erro ao cancelar duelo.',
      ephemeral: true,
    });
  });

  it('should cancel duel and clear buttons on success', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      witness: { discordId: 'u3' },
    });
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.editReply).toHaveBeenCalledWith({
      embeds: [{ embed: true }],
      components: [],
    });
  });
});

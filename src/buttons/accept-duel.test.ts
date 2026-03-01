import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAcceptDuel } from './accept-duel';
import { acceptOpponent, getDuelById } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  acceptOpponent: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  notifyDuelAccepted: vi.fn().mockResolvedValue(undefined),
}));

function interaction(customId = 'accept-duel:10', userId = 'u2') {
  return {
    customId,
    user: { id: userId },
    client: { users: { fetch: vi.fn() }, channels: { fetch: vi.fn() } },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/accept-duel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when customId has invalid duelId (NaN)', async () => {
    const i = interaction('accept-duel:abc');

    await handleAcceptDuel(i);

    expect(i.deferUpdate).toHaveBeenCalledTimes(1);
    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Interação inválida.',
      ephemeral: true,
    });
    expect(getDuelById).not.toHaveBeenCalled();
  });

  it('should reject when duel does not exist', async () => {
    (getDuelById as any).mockResolvedValue(null);
    const i = interaction();

    await handleAcceptDuel(i);

    expect(i.deferUpdate).toHaveBeenCalledTimes(1);
    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está mais disponível.',
      ephemeral: true,
    });
  });

  it('should reject when duel is not PROPOSED', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'ACCEPTED' });
    const i = interaction();

    await handleAcceptDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está mais disponível.',
      ephemeral: true,
    });
  });

  it('should reject when user is not the opponent', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponent: { discordId: 'u2' },
    });
    const i = interaction('accept-duel:10', 'u9');

    await handleAcceptDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas o oponente pode aceitar o duelo.',
      ephemeral: true,
    });
  });

  it('should return error when service fails to accept duel', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponent: { discordId: 'u2' },
    });
    (acceptOpponent as any).mockResolvedValue(null);
    const i = interaction();

    await handleAcceptDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está mais disponível.',
      ephemeral: true,
    });
  });

  it('should update message with PROPOSED buttons when still waiting witness', async () => {
    const updated = { id: 10, status: 'PROPOSED' };
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponent: { discordId: 'u2' },
    });
    (acceptOpponent as any).mockResolvedValue(updated);
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleAcceptDuel(i);

    expect(i.editReply).toHaveBeenCalledTimes(1);
    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toEqual([{ embed: true }]);
    expect(payload.components).toHaveLength(1);
  });

  it('should update message with ACCEPTED buttons when both accepted', async () => {
    const updated = { id: 10, status: 'ACCEPTED' };
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponent: { discordId: 'u2' },
    });
    (acceptOpponent as any).mockResolvedValue(updated);
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleAcceptDuel(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toHaveLength(1);
  });
});

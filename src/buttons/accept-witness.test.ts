import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAcceptWitness } from './accept-witness';
import { acceptWitness, getDuelById } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  acceptWitness: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function interaction(customId = 'accept-witness:10', userId = 'u3') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/accept-witness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is unavailable', async () => {
    (getDuelById as any).mockResolvedValue(null);
    const i = interaction();

    await handleAcceptWitness(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está mais disponível.',
      ephemeral: true,
    });
  });

  it('should reject when user is not designated witness', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      witness: { discordId: 'u3' },
    });
    const i = interaction('accept-witness:10', 'u9');

    await handleAcceptWitness(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha designada pode aceitar.',
      ephemeral: true,
    });
  });

  it('should return error when service fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      witness: { discordId: 'u3' },
    });
    (acceptWitness as any).mockResolvedValue(null);
    const i = interaction();

    await handleAcceptWitness(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Erro ao aceitar como testemunha.',
      ephemeral: true,
    });
  });

  it('should show accept-duel + cancel when still PROPOSED and opponent pending', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      witness: { discordId: 'u3' },
    });
    (acceptWitness as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponentAccepted: false,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleAcceptWitness(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toHaveLength(1);
  });

  it('should show no buttons when still PROPOSED and opponent already accepted', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      witness: { discordId: 'u3' },
    });
    (acceptWitness as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      opponentAccepted: true,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleAcceptWitness(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('should show start-duel + cancel when ACCEPTED', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'PROPOSED',
      witness: { discordId: 'u3' },
    });
    (acceptWitness as any).mockResolvedValue({
      id: 10,
      status: 'ACCEPTED',
      opponentAccepted: true,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleAcceptWitness(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toHaveLength(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleConfirmResult } from './confirm-result';
import { confirmResult, getDuelById } from '../services/duel.service';
import { applyResult } from '../services/player.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  confirmResult: vi.fn(),
}));

vi.mock('../services/player.service', () => ({
  applyResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function interaction(customId = 'confirm-result:10', userId = 'u3') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/confirm-result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not awaiting validation', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'IN_PROGRESS' });
    const i = interaction();

    await handleConfirmResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está aguardando validação.',
      ephemeral: true,
    });
  });

  it('should reject when user is not witness', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    const i = interaction('confirm-result:10', 'u9');

    await handleConfirmResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha pode confirmar o resultado.',
      ephemeral: true,
    });
  });

  it('should return error when confirmResult fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmResult as any).mockResolvedValue(null);
    const i = interaction();

    await handleConfirmResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Erro ao confirmar resultado.',
      ephemeral: true,
    });
  });

  it('should confirm and apply result when winner is challenger', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmResult as any).mockResolvedValue({
      id: 10,
      status: 'CONFIRMED',
      winnerId: 1,
      challengerId: 1,
      opponentId: 2,
      seasonId: 5,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleConfirmResult(i);

    expect(applyResult).toHaveBeenCalledWith(1, 2, 5);
    expect(i.editReply).toHaveBeenCalledWith({ embeds: [{ embed: true }], components: [] });
  });

  it('should confirm and apply result when winner is opponent', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmResult as any).mockResolvedValue({
      id: 10,
      status: 'CONFIRMED',
      winnerId: 2,
      challengerId: 1,
      opponentId: 2,
      seasonId: 5,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleConfirmResult(i);

    expect(applyResult).toHaveBeenCalledWith(2, 1, 5);
  });

  it('should not apply result when winnerId is missing', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmResult as any).mockResolvedValue({
      id: 10,
      status: 'CONFIRMED',
      winnerId: null,
      challengerId: 1,
      opponentId: 2,
      seasonId: 5,
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleConfirmResult(i);

    expect(applyResult).not.toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledTimes(1);
  });
});

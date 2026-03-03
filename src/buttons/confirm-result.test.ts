import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleConfirmResult } from './confirm-result';
import { confirmAndApplyResult, getDuelById } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  confirmAndApplyResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  notifyDuelConfirmed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
}));

function interaction(customId = 'confirm-result:10', userId = 'u3') {
  return {
    customId,
    user: { id: userId },
    client: { users: { fetch: vi.fn() }, channels: { fetch: vi.fn() } },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/confirm-result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when customId has invalid duelId (NaN)', async () => {
    const i = interaction('confirm-result:abc');

    await handleConfirmResult(i);

    expect(i.deferUpdate).toHaveBeenCalledTimes(1);
    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Interação inválida.',
      ephemeral: true,
    });
    expect(getDuelById).not.toHaveBeenCalled();
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

  it('should return error when confirmAndApplyResult fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmAndApplyResult as any).mockResolvedValue(null);
    const i = interaction();

    await handleConfirmResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Erro ao confirmar resultado.',
      ephemeral: true,
    });
  });

  it('should confirm result and update embed', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (confirmAndApplyResult as any).mockResolvedValue({
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

    expect(confirmAndApplyResult).toHaveBeenCalledWith(10);
    expect(i.editReply).toHaveBeenCalledWith({ embeds: [{ embed: true }], components: [] });
  });
});

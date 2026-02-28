import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRejectResult } from './reject-result';
import { getDuelById, rejectResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  rejectResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function interaction(customId = 'reject-result:10', userId = 'u3') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/reject-result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not awaiting validation', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'IN_PROGRESS' });
    const i = interaction();

    await handleRejectResult(i);

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
    const i = interaction('reject-result:10', 'u9');

    await handleRejectResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha pode rejeitar o resultado.',
      ephemeral: true,
    });
  });

  it('should reject when duel.witness is missing', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: null,
    });
    const i = interaction();

    await handleRejectResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha pode rejeitar o resultado.',
      ephemeral: true,
    });
  });

  it('should return error when rejectResult fails', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (rejectResult as any).mockResolvedValue(null);
    const i = interaction();

    await handleRejectResult(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não está aguardando validação.',
      ephemeral: true,
    });
  });

  it('should update message back to IN_PROGRESS with submit button', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
      witness: { discordId: 'u3' },
    });
    (rejectResult as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction();

    await handleRejectResult(i);

    expect(i.editReply).toHaveBeenCalledTimes(1);
    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toEqual([{ embed: true }]);
    expect(payload.components).toHaveLength(1);
  });
});

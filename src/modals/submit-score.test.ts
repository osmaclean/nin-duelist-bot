import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubmitScoreModal } from './submit-score';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  submitResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

function modalInteraction(values: Record<string, string>) {
  return {
    customId: 'submit-score:10',
    fields: {
      getTextInputValue: vi.fn((k: string) => values[k]),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function duelBase(extra: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 'IN_PROGRESS',
    format: 'MD3',
    challengerId: 1,
    opponentId: 2,
    challenger: { discordId: '111' },
    opponent: { discordId: '222' },
    ...extra,
  };
}

describe('modals/submit-score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not in progress', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'ACCEPTED' });
    const i = modalInteraction({
      winner: '111',
      'score-winner': '2',
      'score-loser': '1',
    });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Este duelo não está em andamento.',
      ephemeral: true,
    });
  });

  it('should reject invalid winner id', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({
      winner: '999',
      'score-winner': '2',
      'score-loser': '1',
    });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'ID de vencedor inválido. Use: 111 ou 222',
      ephemeral: true,
    });
  });

  it('should reject non-numeric score', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({
      winner: '111',
      'score-winner': 'x',
      'score-loser': '1',
    });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Placar inválido. Use números inteiros.',
      ephemeral: true,
    });
  });

  it('should reject invalid score for MD1', async () => {
    (getDuelById as any).mockResolvedValue(duelBase({ format: 'MD1' }));
    const i = modalInteraction({
      winner: '111',
      'score-winner': '2',
      'score-loser': '0',
    });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Placar inválido para MD1. Placares válidos: 1-0',
      ephemeral: true,
    });
  });

  it('should reject invalid score for MD3', async () => {
    (getDuelById as any).mockResolvedValue(duelBase({ format: 'MD3' }));
    const i = modalInteraction({
      winner: '111',
      'score-winner': '1',
      'score-loser': '0',
    });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Placar inválido para MD3. Placares válidos: 2-0 ou 2-1',
      ephemeral: true,
    });
  });

  it('should followUp with error when submitResult fails', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue(null);
    const i = modalInteraction({
      winner: '<@111>',
      'score-winner': '2',
      'score-loser': '1',
    });

    await handleSubmitScoreModal(i);

    expect(i.deferUpdate).toHaveBeenCalledTimes(1);
    expect(submitResult).toHaveBeenCalledWith(10, 1, 2, 1);
    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Erro ao enviar resultado.',
      ephemeral: true,
    });
  });

  it('should update message with validation buttons when awaiting validation', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = modalInteraction({
      winner: '222',
      'score-winner': '2',
      'score-loser': '0',
    });

    await handleSubmitScoreModal(i);

    expect(submitResult).toHaveBeenCalledWith(10, 2, 2, 0);
    expect(i.editReply).toHaveBeenCalledTimes(1);
    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toEqual([{ embed: true }]);
    expect(payload.components).toHaveLength(1);
  });

  it('should update message without buttons when status is not awaiting validation', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = modalInteraction({
      winner: '111',
      'score-winner': '2',
      'score-loser': '1',
    });

    await handleSubmitScoreModal(i);

    const payload = i.editReply.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('should accept valid MD1 score and resolve winner id correctly', async () => {
    (getDuelById as any).mockResolvedValue(
      duelBase({
        format: 'MD1',
      }),
    );
    (submitResult as any).mockResolvedValue({
      id: 10,
      status: 'AWAITING_VALIDATION',
    });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = modalInteraction({
      winner: '111',
      'score-winner': '1',
      'score-loser': '0',
    });

    await handleSubmitScoreModal(i);

    expect(submitResult).toHaveBeenCalledWith(10, 1, 1, 0);
    expect(i.editReply).toHaveBeenCalledTimes(1);
  });
});

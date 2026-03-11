import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubmitScoreModal } from './submit-score';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';
import { notifyWitnessValidation, notifyResultSubmitted } from '../lib/notifications';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  submitResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  notifyWitnessValidation: vi.fn().mockResolvedValue(undefined),
  notifyResultSubmitted: vi.fn().mockResolvedValue(undefined),
}));

function modalInteraction(values: Record<string, string>, customId = 'submit-score:10:1', userId = 'w1') {
  const channelMessages = { fetch: vi.fn().mockResolvedValue({ edit: vi.fn() }) };
  const channel = { messages: channelMessages, isTextBased: () => true };
  return {
    customId,
    user: { id: userId },
    client: {
      users: { fetch: vi.fn() },
      channels: { fetch: vi.fn().mockResolvedValue(channel) },
    },
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
    witness: { discordId: 'w1' },
    channelId: 'ch1',
    messageId: 'msg1',
    ...extra,
  };
}

describe('modals/submit-score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when customId has invalid duelId (NaN)', async () => {
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' }, 'submit-score:abc:1');

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Interação inválida.', ephemeral: true });
    expect(getDuelById).not.toHaveBeenCalled();
  });

  it('should reject when duel is not in progress', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'ACCEPTED' });
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Este duelo não está em andamento.', ephemeral: true });
  });

  it('should reject when user is not the witness', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' }, 'submit-score:10:1', '111');

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Apenas a testemunha pode reportar o resultado.', ephemeral: true });
  });

  it('should reject when winnerId does not match players', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' }, 'submit-score:10:999');

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Vencedor inválido.', ephemeral: true });
  });

  it('should reject non-numeric score', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({ 'score-winner': 'x', 'score-loser': '1' });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Placar inválido. Use números inteiros.', ephemeral: true });
  });

  it('should reject invalid score for MD3', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = modalInteraction({ 'score-winner': '1', 'score-loser': '0' });

    await handleSubmitScoreModal(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Placar inválido para MD3. Placares válidos: 2-0 ou 2-1',
      ephemeral: true,
    });
  });

  it('should followUp with error when submitResult fails', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue(null);
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' });

    await handleSubmitScoreModal(i);

    expect(i.deferUpdate).toHaveBeenCalledTimes(1);
    expect(submitResult).toHaveBeenCalledWith(10, 1, 2, 1);
    expect(i.followUp).toHaveBeenCalledWith({ content: 'Erro ao enviar resultado.', ephemeral: true });
  });

  it('should submit result and notify witness when AWAITING_VALIDATION', async () => {
    const updated = { id: 10, status: 'AWAITING_VALIDATION', channelId: 'ch1', messageId: 'msg1' };
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue(updated);
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '0' });

    await handleSubmitScoreModal(i);

    expect(submitResult).toHaveBeenCalledWith(10, 1, 2, 0);
    expect(notifyWitnessValidation).toHaveBeenCalledWith(i.client, updated);
    expect(notifyResultSubmitted).toHaveBeenCalledWith(i.client, updated);
  });

  it('should accept valid MD3 score 2-1', async () => {
    const updated = { id: 10, status: 'AWAITING_VALIDATION', channelId: 'ch1', messageId: 'msg1' };
    (getDuelById as any).mockResolvedValue(duelBase());
    (submitResult as any).mockResolvedValue(updated);
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = modalInteraction({ 'score-winner': '2', 'score-loser': '1' }, 'submit-score:10:2');

    await handleSubmitScoreModal(i);

    expect(submitResult).toHaveBeenCalledWith(10, 2, 2, 1);
  });
});

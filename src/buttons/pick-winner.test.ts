import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePickWinner } from './pick-winner';
import { getDuelById, submitResult } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  submitResult: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  notifyWitnessValidation: vi.fn().mockResolvedValue(undefined),
}));

function interaction(customId = 'pick-winner:10:1', userId = 'w1') {
  const channelMessages = { fetch: vi.fn().mockResolvedValue({ edit: vi.fn() }) };
  const channel = { messages: channelMessages, isTextBased: () => true };
  return {
    customId,
    user: { id: userId },
    client: {
      users: { fetch: vi.fn() },
      channels: { fetch: vi.fn().mockResolvedValue(channel) },
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function duelBase(format = 'MD1' as string) {
  return {
    id: 10,
    status: 'IN_PROGRESS',
    format,
    challengerId: 1,
    opponentId: 2,
    challenger: { discordId: 'u1', username: 'PlayerA' },
    opponent: { discordId: 'u2', username: 'PlayerB' },
    witness: { discordId: 'w1' },
    channelId: 'ch1',
    messageId: 'msg1',
  };
}

describe('buttons/pick-winner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when customId has invalid ids', async () => {
    const i = interaction('pick-winner:abc:xyz');

    await handlePickWinner(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Interação inválida.', ephemeral: true });
  });

  it('should reject when duel is not in progress', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'ACCEPTED' });
    const i = interaction();

    await handlePickWinner(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Este duelo não está em andamento.', ephemeral: true });
  });

  it('should reject when user is not the witness', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = interaction('pick-winner:10:1', 'u1');

    await handlePickWinner(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Apenas a testemunha pode reportar o resultado.', ephemeral: true });
  });

  it('should reject when winnerId does not match players', async () => {
    (getDuelById as any).mockResolvedValue(duelBase());
    const i = interaction('pick-winner:10:999');

    await handlePickWinner(i);

    expect(i.reply).toHaveBeenCalledWith({ content: 'Vencedor inválido.', ephemeral: true });
  });

  it('should auto-submit 1-0 for MD1', async () => {
    (getDuelById as any).mockResolvedValue(duelBase('MD1'));
    (submitResult as any).mockResolvedValue({ id: 10, status: 'AWAITING_VALIDATION' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('pick-winner:10:1');

    await handlePickWinner(i);

    expect(submitResult).toHaveBeenCalledWith(10, 1, 1, 0);
    expect(i.deferUpdate).toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledWith({
      content: 'Resultado enviado! Aguardando validação da testemunha.',
      components: [],
    });
  });

  it('should show error when MD1 submitResult fails', async () => {
    (getDuelById as any).mockResolvedValue(duelBase('MD1'));
    (submitResult as any).mockResolvedValue(null);
    const i = interaction('pick-winner:10:1');

    await handlePickWinner(i);

    expect(i.followUp).toHaveBeenCalledWith({ content: 'Erro ao enviar resultado.', ephemeral: true });
  });

  it('should show score modal for MD3', async () => {
    (getDuelById as any).mockResolvedValue(duelBase('MD3'));
    const i = interaction('pick-winner:10:2');

    await handlePickWinner(i);

    expect(i.showModal).toHaveBeenCalledTimes(1);
    const modal = i.showModal.mock.calls[0][0].toJSON();
    expect(modal.custom_id).toBe('submit-score:10:2');
    expect(modal.components).toHaveLength(2);
    const labels = modal.components.map((r: any) => r.components[0].label);
    expect(labels).toEqual(['Pontos do vencedor', 'Pontos do perdedor']);
  });
});

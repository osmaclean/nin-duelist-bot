import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubmitResult } from './submit-result';
import { getDuelById } from '../services/duel.service';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
}));

function interaction(customId = 'submit-result:10', userId = 'u1') {
  return {
    customId,
    user: { id: userId },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/submit-result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when customId has invalid duelId (NaN)', async () => {
    const i = interaction('submit-result:abc');

    await handleSubmitResult(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Interação inválida.',
      ephemeral: true,
    });
    expect(getDuelById).not.toHaveBeenCalled();
  });

  it('should reject when duel is not IN_PROGRESS', async () => {
    (getDuelById as any).mockResolvedValue({ status: 'ACCEPTED' });
    const i = interaction();

    await handleSubmitResult(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Este duelo não está em andamento.',
      ephemeral: true,
    });
  });

  it('should reject when user is not one of the duelists', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1', username: 'PlayerA' },
      opponent: { discordId: 'u2', username: 'PlayerB' },
      format: 'MD3',
      challengerId: 1,
      opponentId: 2,
    });
    const i = interaction('submit-result:10', 'u9');

    await handleSubmitResult(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Apenas os duelistas podem enviar o resultado.',
      ephemeral: true,
    });
  });

  it('should reply with winner selection buttons', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1', username: 'PlayerA' },
      opponent: { discordId: 'u2', username: 'PlayerB' },
      format: 'MD3',
      challengerId: 1,
      opponentId: 2,
    });
    const i = interaction();

    await handleSubmitResult(i);

    expect(i.reply).toHaveBeenCalledTimes(1);
    const payload = i.reply.mock.calls[0][0];
    expect(payload.content).toBe('**Quem venceu o duelo?**');
    expect(payload.ephemeral).toBe(true);
    expect(payload.components).toHaveLength(1);

    const buttons = payload.components[0].toJSON().components;
    expect(buttons).toHaveLength(2);
    expect(buttons[0].custom_id).toBe('pick-winner:10:1');
    expect(buttons[0].label).toBe('PlayerA');
    expect(buttons[1].custom_id).toBe('pick-winner:10:2');
    expect(buttons[1].label).toBe('PlayerB');
  });
});

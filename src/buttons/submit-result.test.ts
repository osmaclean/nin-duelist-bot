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
    showModal: vi.fn().mockResolvedValue(undefined),
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
    expect(i.showModal).not.toHaveBeenCalled();
  });

  it('should reject when user is not one of the duelists', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      format: 'MD3',
    });
    const i = interaction('submit-result:10', 'u9');

    await handleSubmitResult(i);

    expect(i.reply).toHaveBeenCalledWith({
      content: 'Apenas os duelistas podem enviar o resultado.',
      ephemeral: true,
    });
    expect(i.showModal).not.toHaveBeenCalled();
  });

  it('should show modal with MD1 placeholders', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 10,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      format: 'MD1',
    });
    const i = interaction();

    await handleSubmitResult(i);

    expect(i.showModal).toHaveBeenCalledTimes(1);
    const modal = i.showModal.mock.calls[0][0].toJSON();
    expect(modal.custom_id).toBe('submit-score:10');
    expect(modal.components).toHaveLength(3);
    const labels = modal.components.map((r: any) => r.components[0].label);
    expect(labels).toEqual([
      'Quem venceu? (ID Discord ou @menção)',
      'Pontos do vencedor',
      'Pontos do perdedor',
    ]);
    const placeholders = modal.components.map((r: any) => r.components[0].placeholder);
    expect(placeholders[1]).toBe('1');
    expect(placeholders[2]).toBe('0');
  });

  it('should show modal with MD3 placeholders', async () => {
    (getDuelById as any).mockResolvedValue({
      id: 11,
      status: 'IN_PROGRESS',
      challenger: { discordId: 'u1' },
      opponent: { discordId: 'u2' },
      format: 'MD3',
    });
    const i = interaction('submit-result:11');

    await handleSubmitResult(i);

    const modal = i.showModal.mock.calls[0][0].toJSON();
    const placeholders = modal.components.map((r: any) => r.components[0].placeholder);
    expect(placeholders[1]).toBe('2');
    expect(placeholders[2]).toBe('0 ou 1');
  });
});

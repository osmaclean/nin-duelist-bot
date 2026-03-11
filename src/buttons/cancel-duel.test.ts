import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCancelDuel } from './cancel-duel';
import { cancelDuel, getDuelById } from '../services/duel.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  cancelDuel: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
}));

function interaction(customId = 'cancel-duel:10', userId = 'u1') {
  return {
    customId,
    user: { id: userId },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 'IN_PROGRESS',
    challenger: { discordId: 'u1' },
    opponent: { discordId: 'u2' },
    witness: { discordId: 'u3' },
    ...overrides,
  };
}

describe('buttons/cancel-duel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when duel is not found', async () => {
    (getDuelById as any).mockResolvedValue(null);
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode mais ser cancelado.',
      ephemeral: true,
    });
  });

  it('should reject when status is not cancelable', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'CONFIRMED' }));
    const i = interaction();

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode mais ser cancelado.',
      ephemeral: true,
    });
  });

  // ─── PROPOSED/ACCEPTED: duelists can cancel ──────────

  it('should allow challenger to cancel in PROPOSED', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'PROPOSED' }));
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('cancel-duel:10', 'u1');

    await handleCancelDuel(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);
  });

  it('should allow opponent to cancel in PROPOSED', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'PROPOSED' }));
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('cancel-duel:10', 'u2');

    await handleCancelDuel(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);
  });

  it('should reject witness cancel in PROPOSED', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'PROPOSED' }));
    const i = interaction('cancel-duel:10', 'u3');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas os duelistas podem cancelar nesta fase.',
      ephemeral: true,
    });
  });

  it('should allow challenger to cancel in ACCEPTED', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'ACCEPTED' }));
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('cancel-duel:10', 'u1');

    await handleCancelDuel(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);
  });

  // ─── IN_PROGRESS/AWAITING_VALIDATION: only witness ───

  it('should allow witness to cancel in IN_PROGRESS', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('cancel-duel:10', 'u3');

    await handleCancelDuel(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);
    expect(i.editReply).toHaveBeenCalledWith({
      embeds: [{ embed: true }],
      components: [],
    });
  });

  it('should reject duelist cancel in IN_PROGRESS', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
    const i = interaction('cancel-duel:10', 'u1');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha pode cancelar duelos em andamento.',
      ephemeral: true,
    });
  });

  it('should reject duelist cancel in AWAITING_VALIDATION', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'AWAITING_VALIDATION' }));
    const i = interaction('cancel-duel:10', 'u2');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas a testemunha pode cancelar duelos em validação.',
      ephemeral: true,
    });
  });

  it('should allow witness to cancel in AWAITING_VALIDATION', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'AWAITING_VALIDATION' }));
    (cancelDuel as any).mockResolvedValue({ id: 10, status: 'CANCELLED' });
    (buildDuelEmbed as any).mockReturnValue({ embed: true });
    const i = interaction('cancel-duel:10', 'u3');

    await handleCancelDuel(i);

    expect(cancelDuel).toHaveBeenCalledWith(10);
    expect(i.editReply).toHaveBeenCalledWith({
      embeds: [{ embed: true }],
      components: [],
    });
  });

  it('should reject random user in any status', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'PROPOSED' }));
    const i = interaction('cancel-duel:10', 'u9');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Apenas os duelistas podem cancelar nesta fase.',
      ephemeral: true,
    });
  });

  it('should return error when cancel service fails', async () => {
    (getDuelById as any).mockResolvedValue(makeDuel({ status: 'IN_PROGRESS' }));
    (cancelDuel as any).mockResolvedValue(null);
    const i = interaction('cancel-duel:10', 'u3');

    await handleCancelDuel(i);

    expect(i.followUp).toHaveBeenCalledWith({
      content: 'Este duelo não pode mais ser cancelado.',
      ephemeral: true,
    });
  });
});

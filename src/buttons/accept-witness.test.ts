import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAcceptWitness } from './accept-witness';
import { getDuelById } from '../services/duel.service';

vi.mock('../services/duel.service', () => ({
  getDuelById: vi.fn(),
  acceptWitness: vi.fn(),
}));

vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));

vi.mock('../lib/notifications', () => ({
  notifyDuelAccepted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
}));

function interaction(customId = 'accept-witness:10', userId = 'u3') {
  return {
    customId,
    user: { id: userId },
    client: { users: { fetch: vi.fn() }, channels: { fetch: vi.fn() } },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('buttons/accept-witness (legacy)', () => {
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
});

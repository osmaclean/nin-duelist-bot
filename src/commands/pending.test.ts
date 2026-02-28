import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePendingCommand } from './pending';
import { getActiveSeason } from '../services/season.service';
import { getPendingDuels } from '../services/pending.service';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));

vi.mock('../services/pending.service', () => ({
  getPendingDuels: vi.fn(),
}));

function interaction(userId = 'u1') {
  return {
    user: { id: userId },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reply with no season message when no active season', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const i = interaction();

    await handlePendingCommand(i);

    expect(i.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(i.editReply).toHaveBeenCalledWith('Nenhuma season ativa no momento.');
  });

  it('should reply with no pending message when no duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1 });
    (getPendingDuels as any).mockResolvedValue([]);
    const i = interaction();

    await handlePendingCommand(i);

    expect(getPendingDuels).toHaveBeenCalledWith('u1', 1);
    expect(i.editReply).toHaveBeenCalledWith('Nenhum duelo pendente de ação sua.');
  });

  it('should reply with embed listing pending duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 5 });
    (getPendingDuels as any).mockResolvedValue([
      {
        id: 10,
        status: 'AWAITING_VALIDATION',
        urgency: 1,
        challenger: { discordId: 'u1' },
        opponent: { discordId: 'u2' },
        createdAt: new Date(),
      },
      {
        id: 11,
        status: 'ACCEPTED',
        urgency: 3,
        challenger: { discordId: 'u1' },
        opponent: { discordId: 'u3' },
        createdAt: new Date(),
      },
    ]);
    const i = interaction();

    await handlePendingCommand(i);

    expect(i.editReply).toHaveBeenCalledTimes(1);
    const payload = i.editReply.mock.calls[0][0];
    expect(payload.embeds).toHaveLength(1);
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe('Suas Pendências');
    expect(embed.description).toContain('#10');
    expect(embed.description).toContain('#11');
    expect(embed.footer.text).toBe('2 duelo(s) pendente(s)');
  });

  it('should show time remaining for PROPOSED duels', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 1 });
    (getPendingDuels as any).mockResolvedValue([
      {
        id: 5,
        status: 'PROPOSED',
        urgency: 2,
        challenger: { discordId: 'u1' },
        opponent: { discordId: 'u2' },
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      },
    ]);
    const i = interaction();

    await handlePendingCommand(i);

    const embed = i.editReply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain('min restantes');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDuelCommand } from './duel';
import { getActiveSeason } from '../services/season.service';
import { getOrCreatePlayer } from '../services/player.service';
import { createDuel, hasActiveDuel, setMessageId } from '../services/duel.service';
import { canDuelToday } from '../services/antifarm.service';
import { buildDuelEmbed } from '../lib/embeds';

vi.mock('../services/season.service', () => ({
  getActiveSeason: vi.fn(),
}));
vi.mock('../services/player.service', () => ({
  getOrCreatePlayer: vi.fn(),
}));
vi.mock('../services/duel.service', () => ({
  createDuel: vi.fn(),
  setMessageId: vi.fn(),
  hasActiveDuel: vi.fn(),
}));
vi.mock('../services/antifarm.service', () => ({
  canDuelToday: vi.fn(),
}));
vi.mock('../lib/embeds', () => ({
  buildDuelEmbed: vi.fn(),
}));
vi.mock('../lib/notifications', () => ({
  notifyDuelCreated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/cooldown', () => ({
  checkCooldown: vi.fn().mockReturnValue(true),
  getRemainingCooldown: vi.fn().mockReturnValue(0),
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
}));

function makeInteraction(params?: {
  userId?: string;
  userName?: string;
  opponent?: { id: string; username: string; bot?: boolean };
  witness?: { id: string; username: string; bot?: boolean };
  format?: 'MD1' | 'MD3';
}) {
  const userId = params?.userId ?? 'u1';
  const userName = params?.userName ?? 'challenger';
  const opponent = params?.opponent ?? { id: 'u2', username: 'opponent', bot: false };
  const witness = params?.witness ?? { id: 'u3', username: 'witness', bot: false };
  const format = params?.format ?? 'MD3';

  return {
    user: { id: userId, username: userName },
    client: { users: { fetch: vi.fn() }, channels: { fetch: vi.fn() } },
    channelId: 'chan-1',
    options: {
      getUser: vi.fn((name: string) => (name === 'opponent' ? opponent : witness)),
      getString: vi.fn((name: string) => (name === 'format' ? format : null)),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue({ id: 'message-99' }),
  } as any;
}

describe('commands/duel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when user is on cooldown', async () => {
    const { checkCooldown, getRemainingCooldown } = await import('../lib/cooldown');
    (checkCooldown as any).mockReturnValueOnce(false);
    (getRemainingCooldown as any).mockReturnValueOnce(15);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Aguarde 15s antes de criar outro duelo.',
      ephemeral: true,
    });
    expect(getActiveSeason).not.toHaveBeenCalled();
  });

  it('should reply ephemeral when no active season exists', async () => {
    (getActiveSeason as any).mockResolvedValue(null);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Nenhuma season ativa no momento.',
      ephemeral: true,
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('should reject duel when season is expired but still active in DB', async () => {
    (getActiveSeason as any).mockResolvedValue({
      id: 10,
      endDate: new Date('2020-01-01T00:00:00.000Z'),
    });
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'A season atual está encerrando. Aguarde alguns minutos para a nova season começar.',
      ephemeral: true,
    });
    expect(createDuel).not.toHaveBeenCalled();
  });

  it('should reject self duel', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    const interaction = makeInteraction({
      userId: 'u1',
      opponent: { id: 'u1', username: 'same', bot: false },
    });

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Você não pode duelar contra si mesmo.',
      ephemeral: true,
    });
  });

  it('should reject bot opponent', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    const interaction = makeInteraction({
      opponent: { id: 'u2', username: 'botop', bot: true },
    });

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Você não pode duelar contra um bot.',
      ephemeral: true,
    });
  });

  it('should reject bot witness', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    const interaction = makeInteraction({
      witness: { id: 'u3', username: 'botwit', bot: true },
    });

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'A testemunha não pode ser um bot.',
      ephemeral: true,
    });
  });

  it('should reject witness that is one of duelists', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    const interaction = makeInteraction({
      witness: { id: 'u2', username: 'same-as-opponent', bot: false },
    });

    await handleDuelCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'A testemunha não pode ser um dos duelistas.',
      ephemeral: true,
    });
  });

  it('should block when challenger already has active duel', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    (getOrCreatePlayer as any)
      .mockResolvedValueOnce({ id: 1, discordId: 'u1' })
      .mockResolvedValueOnce({ id: 2, discordId: 'u2' })
      .mockResolvedValueOnce({ id: 3, discordId: 'u3' });
    (hasActiveDuel as any).mockResolvedValueOnce(true);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith('Você já tem um duelo ativo. Finalize-o antes de criar outro.');
    expect(createDuel).not.toHaveBeenCalled();
  });

  it('should block when opponent already has active duel', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    (getOrCreatePlayer as any)
      .mockResolvedValueOnce({ id: 1, discordId: 'u1' })
      .mockResolvedValueOnce({ id: 2, discordId: 'u2' })
      .mockResolvedValueOnce({ id: 3, discordId: 'u3' });
    (hasActiveDuel as any).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith('<@u2> já tem um duelo ativo.');
    expect(createDuel).not.toHaveBeenCalled();
  });

  it('should block when anti-farm rule does not allow duel', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    (getOrCreatePlayer as any)
      .mockResolvedValueOnce({ id: 1, discordId: 'u1' })
      .mockResolvedValueOnce({ id: 2, discordId: 'u2' })
      .mockResolvedValueOnce({ id: 3, discordId: 'u3' });
    (hasActiveDuel as any).mockResolvedValue(false);
    (canDuelToday as any).mockResolvedValue(false);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Vocês já tiveram um duelo confirmado hoje. Tente novamente amanhã.',
    );
    expect(createDuel).not.toHaveBeenCalled();
  });

  it('should create duel and persist message id on success', async () => {
    const season = { id: 10, endDate: new Date('2099-01-01') };
    const embed = { embed: true };
    const duel = { id: 77 };
    (getActiveSeason as any).mockResolvedValue(season);
    (getOrCreatePlayer as any)
      .mockResolvedValueOnce({ id: 1, discordId: 'u1' })
      .mockResolvedValueOnce({ id: 2, discordId: 'u2' })
      .mockResolvedValueOnce({ id: 3, discordId: 'u3' });
    (hasActiveDuel as any).mockResolvedValue(false);
    (canDuelToday as any).mockResolvedValue(true);
    (createDuel as any).mockResolvedValue(duel);
    (buildDuelEmbed as any).mockReturnValue(embed);
    (setMessageId as any).mockResolvedValue(undefined);
    const interaction = makeInteraction();

    await handleDuelCommand(interaction);

    expect(createDuel).toHaveBeenCalledWith({
      challengerId: 1,
      opponentId: 2,
      witnessId: 3,
      seasonId: 10,
      format: 'MD3',
      channelId: 'chan-1',
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@u2> <@u3> — Novo desafio de duelo!',
        embeds: [embed],
      }),
    );
    expect(setMessageId).toHaveBeenCalledWith(77, 'message-99');
  });

  it('should propagate errors from dependencies', async () => {
    (getActiveSeason as any).mockResolvedValue({ id: 10, endDate: new Date('2099-01-01') });
    (getOrCreatePlayer as any).mockRejectedValue(new Error('player fail'));
    const interaction = makeInteraction();

    await expect(handleDuelCommand(interaction)).rejects.toThrow('player fail');
  });
});

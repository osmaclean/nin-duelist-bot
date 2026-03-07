import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerInteractionEvent } from './interactionCreate';
import { commandHandlers } from '../commands';
import { buttonHandlers } from '../buttons';
import { modalHandlers } from '../modals';
import { handleRankPagination, handleHistoryPagination } from '../lib/pagination';

vi.mock('../commands', () => ({
  commandHandlers: {
    duel: vi.fn(),
    rank: vi.fn(),
    mvp: vi.fn(),
  },
}));
vi.mock('../buttons', () => ({
  buttonHandlers: {
    'accept-duel': vi.fn(),
    'accept-witness': vi.fn(),
    'start-duel': vi.fn(),
    'submit-result': vi.fn(),
    'confirm-result': vi.fn(),
    'reject-result': vi.fn(),
    'cancel-duel': vi.fn(),
  },
}));
vi.mock('../modals', () => ({
  modalHandlers: {
    'submit-score': vi.fn(),
  },
}));
vi.mock('../lib/pagination', () => ({
  handleRankPagination: vi.fn(),
  handleHistoryPagination: vi.fn(),
}));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const handleDuelCommand = commandHandlers.duel;
const handleRankCommand = commandHandlers.rank;
const handleMvpCommand = commandHandlers.mvp;
const handleAcceptDuel = buttonHandlers['accept-duel'];
const handleAcceptWitness = buttonHandlers['accept-witness'];
const handleStartDuel = buttonHandlers['start-duel'];
const handleSubmitResult = buttonHandlers['submit-result'];
const handleConfirmResult = buttonHandlers['confirm-result'];
const handleRejectResult = buttonHandlers['reject-result'];
const handleCancelDuel = buttonHandlers['cancel-duel'];
const handleSubmitScoreModal = modalHandlers['submit-score'];

function createBaseInteraction(extra: Record<string, unknown> = {}) {
  return {
    id: 'interaction-123',
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isRepliable: () => true,
    replied: false,
    deferred: false,
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    ...extra,
  } as any;
}

describe('events/interactionCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register InteractionCreate handler with client.on', () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    expect(on).toHaveBeenCalledTimes(1);
  });

  it('should dispatch known chat command handlers', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];

    const duelInteraction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'duel',
    });
    const rankInteraction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'rank',
    });
    const mvpInteraction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'mvp',
    });

    await callback(duelInteraction);
    await callback(rankInteraction);
    await callback(mvpInteraction);

    expect(handleDuelCommand).toHaveBeenCalledWith(duelInteraction);
    expect(handleRankCommand).toHaveBeenCalledWith(rankInteraction);
    expect(handleMvpCommand).toHaveBeenCalledWith(mvpInteraction);
  });

  it('should ignore unknown chat commands', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'unknown',
    });

    await callback(interaction);

    expect(handleDuelCommand).not.toHaveBeenCalled();
    expect(handleRankCommand).not.toHaveBeenCalled();
    expect(handleMvpCommand).not.toHaveBeenCalled();
  });

  it('should route rank-page buttons to pagination handler', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isButton: () => true,
      customId: 'rank-page-2',
    });

    await callback(interaction);

    expect(handleRankPagination).toHaveBeenCalledWith(interaction);
    expect(handleAcceptDuel).not.toHaveBeenCalled();
  });

  it('should route hist: buttons to history pagination handler', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isButton: () => true,
      customId: 'hist:u1:2:_:_:_',
    });

    await callback(interaction);

    expect(handleHistoryPagination).toHaveBeenCalledWith(interaction);
    expect(handleRankPagination).not.toHaveBeenCalled();
  });

  it('should route duel buttons to matching handler', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const cases = [
      ['accept-duel:1', handleAcceptDuel],
      ['accept-witness:1', handleAcceptWitness],
      ['start-duel:1', handleStartDuel],
      ['submit-result:1', handleSubmitResult],
      ['confirm-result:1', handleConfirmResult],
      ['reject-result:1', handleRejectResult],
      ['cancel-duel:1', handleCancelDuel],
    ] as const;

    for (const [customId, fn] of cases) {
      const interaction = createBaseInteraction({
        isButton: () => true,
        customId,
      });
      await callback(interaction);
      expect(fn).toHaveBeenCalledWith(interaction);
    }
  });

  it('should ignore unknown button actions', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isButton: () => true,
      customId: 'unknown-action:1',
    });

    await callback(interaction);

    expect(handleRankPagination).not.toHaveBeenCalled();
    expect(handleAcceptDuel).not.toHaveBeenCalled();
    expect(handleCancelDuel).not.toHaveBeenCalled();
  });

  it('should route submit-score modal and ignore other modals', async () => {
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const submitModal = createBaseInteraction({
      isModalSubmit: () => true,
      customId: 'submit-score:10',
    });
    const otherModal = createBaseInteraction({
      isModalSubmit: () => true,
      customId: 'other:10',
    });

    await callback(submitModal);
    await callback(otherModal);

    expect(handleSubmitScoreModal).toHaveBeenCalledTimes(1);
    expect(handleSubmitScoreModal).toHaveBeenCalledWith(submitModal);
  });

  it('should reply with generic error when handler throws and interaction is repliable', async () => {
    (handleDuelCommand as any).mockRejectedValue(new Error('boom'));
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'duel',
      replied: false,
      deferred: false,
    });

    await callback(interaction);

    const { logger } = await import('../lib/logger');
    expect(logger.error).toHaveBeenCalledWith(
      'Erro ao processar interação',
      expect.objectContaining({ error: 'Error: boom' }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ocorreu um erro ao processar esta ação.',
      ephemeral: true,
    });
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('should followUp with generic error when already replied/deferred', async () => {
    (handleRankPagination as any).mockRejectedValue(new Error('pagination fail'));
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isButton: () => true,
      customId: 'rank-page-1',
      replied: true,
      deferred: false,
    });

    await callback(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'Ocorreu um erro ao processar esta ação.',
      ephemeral: true,
    });
  });

  it('should not attempt to reply when interaction is not repliable', async () => {
    (handleMvpCommand as any).mockRejectedValue(new Error('mvp fail'));
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interaction = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'mvp',
      isRepliable: () => false,
    });

    await callback(interaction);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('should swallow reply/followUp failures in error path', async () => {
    (handleDuelCommand as any).mockRejectedValue(new Error('boom'));
    const on = vi.fn();
    registerInteractionEvent({ on } as any);
    const callback = on.mock.calls[0][1];
    const interactionReplyFails = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'duel',
      reply: vi.fn().mockRejectedValue(new Error('reply fail')),
    });

    await expect(callback(interactionReplyFails)).resolves.toBeUndefined();

    (handleRankCommand as any).mockRejectedValue(new Error('boom2'));
    const interactionFollowUpFails = createBaseInteraction({
      isChatInputCommand: () => true,
      commandName: 'rank',
      replied: true,
      followUp: vi.fn().mockRejectedValue(new Error('followUp fail')),
    });

    await expect(callback(interactionFollowUpFails)).resolves.toBeUndefined();
  });
});

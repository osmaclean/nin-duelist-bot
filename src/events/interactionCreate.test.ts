import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerInteractionEvent } from './interactionCreate';
import { handleDuelCommand } from '../commands/duel';
import { handleRankCommand } from '../commands/rank';
import { handleMvpCommand } from '../commands/mvp';
import { handleAcceptDuel } from '../buttons/accept-duel';
import { handleAcceptWitness } from '../buttons/accept-witness';
import { handleStartDuel } from '../buttons/start-duel';
import { handleSubmitResult } from '../buttons/submit-result';
import { handleConfirmResult } from '../buttons/confirm-result';
import { handleRejectResult } from '../buttons/reject-result';
import { handleCancelDuel } from '../buttons/cancel-duel';
import { handleSubmitScoreModal } from '../modals/submit-score';
import { handleRankPagination } from '../lib/pagination';

vi.mock('../commands/duel', () => ({ handleDuelCommand: vi.fn() }));
vi.mock('../commands/rank', () => ({ handleRankCommand: vi.fn() }));
vi.mock('../commands/mvp', () => ({ handleMvpCommand: vi.fn() }));
vi.mock('../buttons/accept-duel', () => ({ handleAcceptDuel: vi.fn() }));
vi.mock('../buttons/accept-witness', () => ({ handleAcceptWitness: vi.fn() }));
vi.mock('../buttons/start-duel', () => ({ handleStartDuel: vi.fn() }));
vi.mock('../buttons/submit-result', () => ({ handleSubmitResult: vi.fn() }));
vi.mock('../buttons/confirm-result', () => ({ handleConfirmResult: vi.fn() }));
vi.mock('../buttons/reject-result', () => ({ handleRejectResult: vi.fn() }));
vi.mock('../buttons/cancel-duel', () => ({ handleCancelDuel: vi.fn() }));
vi.mock('../modals/submit-score', () => ({ handleSubmitScoreModal: vi.fn() }));
vi.mock('../lib/pagination', () => ({ handleRankPagination: vi.fn() }));

function createBaseInteraction(extra: Record<string, unknown> = {}) {
  return {
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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    expect(errorSpy).toHaveBeenCalledWith(
      'Erro ao processar interação:',
      expect.any(Error),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ocorreu um erro ao processar esta ação.',
      ephemeral: true,
    });
    expect(interaction.followUp).not.toHaveBeenCalled();
    errorSpy.mockRestore();
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

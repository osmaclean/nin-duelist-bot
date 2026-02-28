import { ButtonInteraction } from 'discord.js';
import { handleAcceptDuel } from './accept-duel';
import { handleAcceptWitness } from './accept-witness';
import { handleStartDuel } from './start-duel';
import { handleSubmitResult } from './submit-result';
import { handleConfirmResult } from './confirm-result';
import { handleRejectResult } from './reject-result';
import { handleCancelDuel } from './cancel-duel';

export const buttonHandlers: Record<string, (i: ButtonInteraction) => Promise<void>> = {
  'accept-duel': handleAcceptDuel,
  'accept-witness': handleAcceptWitness,
  'start-duel': handleStartDuel,
  'submit-result': handleSubmitResult,
  'confirm-result': handleConfirmResult,
  'reject-result': handleRejectResult,
  'cancel-duel': handleCancelDuel,
};

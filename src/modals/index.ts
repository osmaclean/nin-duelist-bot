import { ModalSubmitInteraction } from 'discord.js';
import { handleSubmitScoreModal } from './submit-score';

export const modalHandlers: Record<string, (i: ModalSubmitInteraction) => Promise<void>> = {
  'submit-score': handleSubmitScoreModal,
};

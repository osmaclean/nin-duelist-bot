import { ChatInputCommandInteraction } from 'discord.js';
import { handleDuelCommand } from './duel';
import { handleRankCommand } from './rank';
import { handleMvpCommand } from './mvp';
import { handlePendingCommand } from './pending';
import { handleHistoryCommand } from './history';
import { handleProfileCommand } from './profile';
import { handleAdminCommand } from './admin';

export const commandHandlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  duel: handleDuelCommand,
  rank: handleRankCommand,
  mvp: handleMvpCommand,
  pending: handlePendingCommand,
  history: handleHistoryCommand,
  profile: handleProfileCommand,
  admin: handleAdminCommand,
};

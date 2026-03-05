import { ChatInputCommandInteraction } from 'discord.js';
import { handleDuelCommand } from './duel';
import { handleRankCommand } from './rank';
import { handleMvpCommand } from './mvp';
import { handlePendingCommand } from './pending';
import { handleHistoryCommand } from './history';
import { handleProfileCommand } from './profile';
import { handleAdminCommand } from './admin';
import { handleH2hCommand } from './h2h';
import { handleActivityCommand } from './activity';
import { handleRecordsCommand } from './records';
import { handleSettingsCommand } from './settings';

export const commandHandlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  duel: handleDuelCommand,
  rank: handleRankCommand,
  mvp: handleMvpCommand,
  pending: handlePendingCommand,
  history: handleHistoryCommand,
  profile: handleProfileCommand,
  admin: handleAdminCommand,
  h2h: handleH2hCommand,
  activity: handleActivityCommand,
  records: handleRecordsCommand,
  settings: handleSettingsCommand,
};

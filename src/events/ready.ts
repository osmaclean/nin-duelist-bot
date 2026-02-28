import { Client, Events } from 'discord.js';
import { ensureActiveSeason } from '../services/season.service';
import { startExpireDuelsJob } from '../jobs/expire-duels';
import { startSeasonCheckJob } from '../jobs/season-check';
import { logger } from '../lib/logger';

export function registerReadyEvent(client: Client) {
  client.once(Events.ClientReady, async (c) => {
    logger.info('Bot online', { tag: c.user.tag });

    try {
      await ensureActiveSeason();
      startExpireDuelsJob(c);
      startSeasonCheckJob();
    } catch (err) {
      logger.error('Falha crítica na inicialização', { error: String(err) });
      process.exit(1);
    }
  });
}

import { Client, Events } from 'discord.js';
import { ensureActiveSeason } from '../services/season.service';
import { startExpireDuelsJob } from '../jobs/expire-duels';
import { startSeasonCheckJob } from '../jobs/season-check';
import { reconcileStaleEmbeds } from '../jobs/reconcile-embeds';
import { logger } from '../lib/logger';
import { getJobHealth } from '../lib/job-health';

export function registerReadyEvent(client: Client) {
  client.once(Events.ClientReady, async (c) => {
    logger.info('Bot online', { tag: c.user.tag });

    try {
      await ensureActiveSeason();
      startExpireDuelsJob(c);
      startSeasonCheckJob();

      logger.info('Jobs registrados', { jobs: Object.keys(getJobHealth()) });

      // Fire-and-forget: reconcile stale embeds without blocking startup
      reconcileStaleEmbeds(c).catch(() => {});
    } catch (err) {
      logger.error('Falha crítica na inicialização', { error: String(err) });
      process.exit(1);
    }
  });
}

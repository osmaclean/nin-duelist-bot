import { SEASON_CHECK_INTERVAL_MS } from '../config';
import { getActiveSeason, closeSeason, ensureActiveSeason } from '../services/season.service';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { registerJob, markJobSuccess, checkJobHealth } from '../lib/job-health';

async function runSeasonCycle() {
  checkJobHealth('season-check');
  try {
    const season = await withRetry(() => getActiveSeason(), 'season-check:getActive');
    if (!season) {
      await withRetry(() => ensureActiveSeason(), 'season-check:ensure');
      return;
    }

    if (new Date() >= season.endDate) {
      logger.info('Season expirou, encerrando', { seasonId: season.id, seasonNumber: season.number });
      await withRetry(() => closeSeason(season.id), 'season-check:close');
      await withRetry(() => ensureActiveSeason(), 'season-check:ensureNext');
    }
    markJobSuccess('season-check');
  } catch (error) {
    logger.error('Erro no job season-check', { error: String(error) });
  }
}

export function startSeasonCheckJob() {
  registerJob('season-check', SEASON_CHECK_INTERVAL_MS);

  function scheduleNext() {
    setTimeout(async () => {
      await runSeasonCycle();
      scheduleNext();
    }, SEASON_CHECK_INTERVAL_MS);
  }

  scheduleNext();
  logger.info('Job season-check iniciado');
}

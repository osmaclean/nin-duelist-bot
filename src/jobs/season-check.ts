import { SEASON_CHECK_INTERVAL_MS } from '../config';
import { getActiveSeason, closeSeason, ensureActiveSeason } from '../services/season.service';
import { logger } from '../lib/logger';

async function runSeasonCycle() {
  try {
    const season = await getActiveSeason();
    if (!season) {
      await ensureActiveSeason();
      return;
    }

    if (new Date() >= season.endDate) {
      logger.info('Season expirou, encerrando', { seasonId: season.id, seasonNumber: season.number });
      await closeSeason(season.id);
      await ensureActiveSeason();
    }
  } catch (error) {
    logger.error('Erro no job season-check', { error: String(error) });
  }
}

export function startSeasonCheckJob() {
  function scheduleNext() {
    setTimeout(async () => {
      await runSeasonCycle();
      scheduleNext();
    }, SEASON_CHECK_INTERVAL_MS);
  }

  scheduleNext();
  logger.info('Job season-check iniciado');
}

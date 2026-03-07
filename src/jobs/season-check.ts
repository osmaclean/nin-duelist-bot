import { Client } from 'discord.js';
import { SEASON_CHECK_INTERVAL_MS, SEASON_ENDING_WARNING_MS } from '../config';
import { getActiveSeason, closeSeason, ensureActiveSeason, markSeasonEndingNotified } from '../services/season.service';
import { notifySeasonEnding } from '../lib/notifications';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { registerJob, markJobSuccess, checkJobHealth } from '../lib/job-health';
import { sendOpsAlert } from '../lib/ops-webhook';

let clientRef: Client | null = null;

async function runSeasonCycle() {
  checkJobHealth('season-check');
  try {
    const season = await withRetry(() => getActiveSeason(), 'season-check:getActive');
    if (!season) {
      await withRetry(() => ensureActiveSeason(), 'season-check:ensure');
      markJobSuccess('season-check');
      return;
    }

    const now = new Date();

    // Check if season is ending within 24h and hasn't been notified yet
    if (
      clientRef &&
      !season.endingNotificationSent &&
      season.endDate.getTime() - now.getTime() <= SEASON_ENDING_WARNING_MS &&
      now < season.endDate
    ) {
      await notifySeasonEnding(clientRef, season.id, season.number);
      await markSeasonEndingNotified(season.id);
      logger.info('Aviso de season encerrando enviado', { seasonId: season.id });
    }

    if (now >= season.endDate) {
      logger.info('Season expirou, encerrando', { seasonId: season.id, seasonNumber: season.number });
      await withRetry(() => closeSeason(season.id), 'season-check:close');
      await withRetry(() => ensureActiveSeason(), 'season-check:ensureNext');
    }
    markJobSuccess('season-check');
  } catch (error) {
    logger.error('Erro no job season-check', { error: String(error) });
    sendOpsAlert(
      'Falha no job season-check',
      `Erro: ${String(error)}`,
      'error',
    );
  }
}

export function startSeasonCheckJob(client: Client) {
  clientRef = client;
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

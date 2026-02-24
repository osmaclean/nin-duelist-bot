import { SEASON_CHECK_INTERVAL_MS } from '../config';
import { getActiveSeason, closeSeason, ensureActiveSeason } from '../services/season.service';

export function startSeasonCheckJob() {
  setInterval(async () => {
    try {
      const season = await getActiveSeason();
      if (!season) {
        await ensureActiveSeason();
        return;
      }

      if (new Date() >= season.endDate) {
        console.log(`Season ${season.number} expirou. Encerrando...`);
        await closeSeason(season.id);
        await ensureActiveSeason();
      }
    } catch (error) {
      console.error('Erro no job season-check:', error);
    }
  }, SEASON_CHECK_INTERVAL_MS);

  console.log('Job season-check iniciado.');
}

import { Client, Events } from 'discord.js';
import { ensureActiveSeason } from '../services/season.service';
import { startExpireDuelsJob } from '../jobs/expire-duels';
import { startSeasonCheckJob } from '../jobs/season-check';

export function registerReadyEvent(client: Client) {
  client.once(Events.ClientReady, async (c) => {
    console.log(`Bot online como ${c.user.tag}`);

    await ensureActiveSeason();
    startExpireDuelsJob(c);
    startSeasonCheckJob();
  });
}

import { Client, GatewayIntentBits } from 'discord.js';
import { DISCORD_TOKEN } from './config';
import { registerReadyEvent } from './events/ready';
import { registerInteractionEvent } from './events/interactionCreate';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

registerReadyEvent(client);
registerInteractionEvent(client);

client.login(DISCORD_TOKEN);

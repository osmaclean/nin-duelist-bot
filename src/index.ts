import { Client, GatewayIntentBits } from 'discord.js';
import { DISCORD_TOKEN } from './config';
import { registerReadyEvent } from './events/ready';
import { registerInteractionEvent } from './events/interactionCreate';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { startHealthServer, stopHealthServer } from './lib/health-server';
import { startCooldownCleanup } from './lib/cooldown';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

registerReadyEvent(client);
registerInteractionEvent(client);

client.login(DISCORD_TOKEN);
startHealthServer(client);
const cooldownTimer = startCooldownCleanup();

async function shutdown() {
  logger.info('Shutting down...');
  clearInterval(cooldownTimer);
  await stopHealthServer();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

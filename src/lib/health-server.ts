import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { Client } from 'discord.js';
import { getJobHealth } from './job-health';
import { getNotificationMetrics } from './notification-metrics';
import { logger } from './logger';
import { HEALTH_PORT } from '../config';

let server: Server | null = null;

export function handleHealthRequest(client: Client): { status: number; body: Record<string, unknown> } {
  const jobs = getJobHealth();
  const notifications = getNotificationMetrics();
  const botConnected = client.ws.status === 0;

  const jobStatuses: Record<string, unknown> = {};
  let allJobsHealthy = true;

  for (const [name, entry] of Object.entries(jobs)) {
    const gap = Date.now() - entry.lastSuccess;
    const healthy = gap <= entry.intervalMs * 2;
    if (!healthy) allJobsHealthy = false;
    jobStatuses[name] = {
      lastSuccessAgo: `${Math.round(gap / 1000)}s`,
      healthy,
    };
  }

  const ok = botConnected && allJobsHealthy;

  return {
    status: ok ? 200 : 503,
    body: {
      status: ok ? 'ok' : 'degraded',
      uptime: `${Math.round(process.uptime())}s`,
      bot: botConnected ? 'connected' : 'disconnected',
      jobs: jobStatuses,
      notifications,
    },
  };
}

export function startHealthServer(client: Client): Server {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      const result = handleHealthRequest(client);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(HEALTH_PORT, () => {
    logger.info('Health server iniciado', { port: HEALTH_PORT });
  });

  server.on('error', (err) => {
    logger.error('Falha ao iniciar health server', { error: String(err) });
  });

  return server;
}

export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
      server = null;
    } else {
      resolve();
    }
  });
}

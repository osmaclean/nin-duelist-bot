import { logger } from './logger';
import { sendOpsAlert } from './ops-webhook';

interface JobEntry {
  lastSuccess: number;
  intervalMs: number;
  alertSent: boolean;
}

const registry: Record<string, JobEntry> = {};

export function registerJob(name: string, intervalMs: number): void {
  registry[name] = { lastSuccess: Date.now(), intervalMs, alertSent: false };
}

export function markJobSuccess(name: string): void {
  if (registry[name]) {
    registry[name].lastSuccess = Date.now();
    registry[name].alertSent = false;
  }
}

export function checkJobHealth(name: string): void {
  const entry = registry[name];
  if (!entry) return;

  const gap = Date.now() - entry.lastSuccess;
  if (gap > entry.intervalMs * 2) {
    logger.warn('Job health: gap excessivo detectado', {
      job: name,
      gapMs: gap,
      expectedIntervalMs: entry.intervalMs,
    });

    if (!entry.alertSent) {
      entry.alertSent = true;
      const gapMin = Math.round(gap / 60_000);
      sendOpsAlert(
        `Job "${name}" sem sucesso`,
        `Último sucesso há ${gapMin}min (esperado: ${Math.round(entry.intervalMs / 60_000)}min).`,
        'error',
      );
    }
  }
}

export function getJobHealth(): Record<string, { lastSuccess: number; intervalMs: number }> {
  return Object.fromEntries(
    Object.entries(registry).map(([k, v]) => [k, { lastSuccess: v.lastSuccess, intervalMs: v.intervalMs }]),
  );
}

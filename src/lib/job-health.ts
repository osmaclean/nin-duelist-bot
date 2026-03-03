import { logger } from './logger';

interface JobEntry {
  lastSuccess: number;
  intervalMs: number;
}

const registry: Record<string, JobEntry> = {};

export function registerJob(name: string, intervalMs: number): void {
  registry[name] = { lastSuccess: Date.now(), intervalMs };
}

export function markJobSuccess(name: string): void {
  if (registry[name]) {
    registry[name].lastSuccess = Date.now();
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
  }
}

export function getJobHealth(): Record<string, { lastSuccess: number; intervalMs: number }> {
  return { ...registry };
}

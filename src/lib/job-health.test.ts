import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./ops-webhook', () => ({
  sendOpsAlert: vi.fn(),
}));

describe('lib/job-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register a job and return it in getJobHealth', async () => {
    const { registerJob, getJobHealth } = await import('./job-health');

    registerJob('test-job', 60_000);

    const health = getJobHealth();
    expect(health['test-job']).toEqual({
      lastSuccess: Date.now(),
      intervalMs: 60_000,
    });
  });

  it('should update lastSuccess on markJobSuccess', async () => {
    const { registerJob, markJobSuccess, getJobHealth } = await import('./job-health');

    registerJob('test-job', 60_000);
    vi.advanceTimersByTime(30_000);
    markJobSuccess('test-job');

    const health = getJobHealth();
    expect(health['test-job'].lastSuccess).toBe(Date.now());
  });

  it('should not log warn when gap is within threshold', async () => {
    const { registerJob, checkJobHealth } = await import('./job-health');
    const { logger } = await import('./logger');

    registerJob('test-job', 60_000);
    vi.advanceTimersByTime(60_000); // exactly 1x interval

    checkJobHealth('test-job');

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should log warn when gap exceeds 2x interval', async () => {
    const { registerJob, checkJobHealth } = await import('./job-health');
    const { logger } = await import('./logger');

    registerJob('test-job', 60_000);
    vi.advanceTimersByTime(120_001); // just over 2x

    checkJobHealth('test-job');

    expect(logger.warn).toHaveBeenCalledWith('Job health: gap excessivo detectado', {
      job: 'test-job',
      gapMs: 120_001,
      expectedIntervalMs: 60_000,
    });
  });

  it('should no-op for unregistered job', async () => {
    const { markJobSuccess, checkJobHealth } = await import('./job-health');
    const { logger } = await import('./logger');

    // Should not throw
    markJobSuccess('unknown-job');
    checkJobHealth('unknown-job');

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should send ops alert on first gap detection', async () => {
    const { registerJob, checkJobHealth } = await import('./job-health');
    const { sendOpsAlert } = await import('./ops-webhook');

    registerJob('test-job', 60_000);
    vi.advanceTimersByTime(120_001);

    checkJobHealth('test-job');

    expect(sendOpsAlert).toHaveBeenCalledWith(
      'Job "test-job" sem sucesso',
      expect.stringContaining('2min'),
      'error',
    );
  });

  it('should only send ops alert once until job recovers', async () => {
    const { registerJob, checkJobHealth, markJobSuccess } = await import('./job-health');
    const { sendOpsAlert } = await import('./ops-webhook');

    registerJob('test-job', 60_000);
    vi.advanceTimersByTime(120_001);

    checkJobHealth('test-job');
    checkJobHealth('test-job'); // second call

    expect(sendOpsAlert).toHaveBeenCalledTimes(1);

    // Recover
    markJobSuccess('test-job');
    vi.advanceTimersByTime(120_001);

    checkJobHealth('test-job'); // should alert again after recovery + new gap

    expect(sendOpsAlert).toHaveBeenCalledTimes(2);
  });
});

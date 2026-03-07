import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config', () => ({
  HEALTH_PORT: 0,
}));

vi.mock('./job-health', () => ({
  getJobHealth: vi.fn().mockReturnValue({}),
}));

vi.mock('./notification-metrics', () => ({
  getNotificationMetrics: vi.fn().mockReturnValue({
    dmSent: 5,
    dmFailed: 1,
    channelFallbackSent: 2,
    channelFallbackFailed: 0,
    throttled: 3,
  }),
}));

describe('lib/health-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleHealthRequest', () => {
    it('should return ok when bot is connected and no jobs registered', async () => {
      const { handleHealthRequest } = await import('./health-server');

      const client = { ws: { status: 0 } } as any;
      const result = handleHealthRequest(client);

      expect(result.status).toBe(200);
      expect(result.body.status).toBe('ok');
      expect(result.body.bot).toBe('connected');
      expect(result.body.notifications).toEqual({
        dmSent: 5,
        dmFailed: 1,
        channelFallbackSent: 2,
        channelFallbackFailed: 0,
        throttled: 3,
      });
    });

    it('should return degraded when bot is disconnected', async () => {
      const { handleHealthRequest } = await import('./health-server');

      const client = { ws: { status: 5 } } as any;
      const result = handleHealthRequest(client);

      expect(result.status).toBe(503);
      expect(result.body.status).toBe('degraded');
      expect(result.body.bot).toBe('disconnected');
    });

    it('should return degraded when a job is unhealthy', async () => {
      const { getJobHealth } = await import('./job-health');
      (getJobHealth as any).mockReturnValue({
        'expire-duels': {
          lastSuccess: Date.now() - 300_000, // 5 min ago
          intervalMs: 60_000, // expected every 1 min → gap > 2x
        },
      });

      const { handleHealthRequest } = await import('./health-server');

      const client = { ws: { status: 0 } } as any;
      const result = handleHealthRequest(client);

      expect(result.status).toBe(503);
      expect(result.body.status).toBe('degraded');
      expect((result.body.jobs as any)['expire-duels'].healthy).toBe(false);
    });

    it('should show healthy job when gap is within threshold', async () => {
      const { getJobHealth } = await import('./job-health');
      (getJobHealth as any).mockReturnValue({
        'expire-duels': {
          lastSuccess: Date.now() - 30_000, // 30s ago
          intervalMs: 60_000, // expected every 1 min → gap < 2x
        },
      });

      const { handleHealthRequest } = await import('./health-server');

      const client = { ws: { status: 0 } } as any;
      const result = handleHealthRequest(client);

      expect(result.status).toBe(200);
      expect((result.body.jobs as any)['expire-duels'].healthy).toBe(true);
    });

    it('should include uptime in response', async () => {
      const { handleHealthRequest } = await import('./health-server');

      const client = { ws: { status: 0 } } as any;
      const result = handleHealthRequest(client);

      expect(result.body.uptime).toMatch(/^\d+s$/);
    });
  });
});

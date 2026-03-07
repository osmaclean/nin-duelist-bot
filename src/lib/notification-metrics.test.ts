import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('lib/notification-metrics', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should start with all counters at zero', async () => {
    const { getNotificationMetrics } = await import('./notification-metrics');

    const m = getNotificationMetrics();
    expect(m).toEqual({
      dmSent: 0,
      dmFailed: 0,
      channelFallbackSent: 0,
      channelFallbackFailed: 0,
      throttled: 0,
    });
  });

  it('should increment individual counters', async () => {
    const {
      trackDmSent,
      trackDmFailed,
      trackChannelFallbackSent,
      trackChannelFallbackFailed,
      trackThrottled,
      getNotificationMetrics,
    } = await import('./notification-metrics');

    trackDmSent();
    trackDmSent();
    trackDmFailed();
    trackChannelFallbackSent();
    trackChannelFallbackSent();
    trackChannelFallbackSent();
    trackChannelFallbackFailed();
    trackThrottled();
    trackThrottled();

    const m = getNotificationMetrics();
    expect(m.dmSent).toBe(2);
    expect(m.dmFailed).toBe(1);
    expect(m.channelFallbackSent).toBe(3);
    expect(m.channelFallbackFailed).toBe(1);
    expect(m.throttled).toBe(2);
  });

  it('should reset all counters', async () => {
    const { trackDmSent, trackDmFailed, resetNotificationMetrics, getNotificationMetrics } =
      await import('./notification-metrics');

    trackDmSent();
    trackDmFailed();
    resetNotificationMetrics();

    const m = getNotificationMetrics();
    expect(m.dmSent).toBe(0);
    expect(m.dmFailed).toBe(0);
  });

  it('should return a copy, not the original object', async () => {
    const { getNotificationMetrics, trackDmSent } = await import('./notification-metrics');

    const m1 = getNotificationMetrics();
    trackDmSent();
    const m2 = getNotificationMetrics();

    expect(m1.dmSent).toBe(0);
    expect(m2.dmSent).toBe(1);
  });
});

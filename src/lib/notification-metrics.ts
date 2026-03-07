export interface NotificationMetrics {
  dmSent: number;
  dmFailed: number;
  channelFallbackSent: number;
  channelFallbackFailed: number;
  throttled: number;
}

const metrics: NotificationMetrics = {
  dmSent: 0,
  dmFailed: 0,
  channelFallbackSent: 0,
  channelFallbackFailed: 0,
  throttled: 0,
};

export function trackDmSent(): void {
  metrics.dmSent++;
}

export function trackDmFailed(): void {
  metrics.dmFailed++;
}

export function trackChannelFallbackSent(): void {
  metrics.channelFallbackSent++;
}

export function trackChannelFallbackFailed(): void {
  metrics.channelFallbackFailed++;
}

export function trackThrottled(): void {
  metrics.throttled++;
}

export function getNotificationMetrics(): NotificationMetrics {
  return { ...metrics };
}

export function resetNotificationMetrics(): void {
  metrics.dmSent = 0;
  metrics.dmFailed = 0;
  metrics.channelFallbackSent = 0;
  metrics.channelFallbackFailed = 0;
  metrics.throttled = 0;
}

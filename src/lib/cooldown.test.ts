import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCooldown, getRemainingCooldown, clearAllCooldowns, cleanupExpiredEntries } from './cooldown';

describe('lib/cooldown', () => {
  beforeEach(() => {
    clearAllCooldowns();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow first usage', () => {
    expect(checkCooldown('user:1', 5000)).toBe(true);
  });

  it('should block usage within cooldown period', () => {
    checkCooldown('user:1', 5000);
    expect(checkCooldown('user:1', 5000)).toBe(false);
  });

  it('should allow usage after cooldown expires', () => {
    checkCooldown('user:1', 5000);
    vi.advanceTimersByTime(5001);
    expect(checkCooldown('user:1', 5000)).toBe(true);
  });

  it('should track different keys independently', () => {
    checkCooldown('user:1', 5000);
    expect(checkCooldown('user:2', 5000)).toBe(true);
  });

  it('getRemainingCooldown should return 0 for unknown key', () => {
    expect(getRemainingCooldown('unknown', 5000)).toBe(0);
  });

  it('getRemainingCooldown should return remaining seconds', () => {
    checkCooldown('user:1', 5000);
    vi.advanceTimersByTime(2000);
    expect(getRemainingCooldown('user:1', 5000)).toBe(3);
  });

  it('getRemainingCooldown should return 0 after cooldown expires', () => {
    checkCooldown('user:1', 5000);
    vi.advanceTimersByTime(6000);
    expect(getRemainingCooldown('user:1', 5000)).toBe(0);
  });

  describe('cleanupExpiredEntries', () => {
    it('should remove entries older than 1 hour', () => {
      checkCooldown('old:1', 5000);
      checkCooldown('old:2', 5000);
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1h + 1ms
      checkCooldown('recent:1', 5000);

      const removed = cleanupExpiredEntries();

      expect(removed).toBe(2);
      // recent entry should still be blocked
      expect(checkCooldown('recent:1', 5000)).toBe(false);
      // old entries should allow usage again
      expect(checkCooldown('old:1', 5000)).toBe(true);
    });

    it('should not remove entries younger than 1 hour', () => {
      checkCooldown('young:1', 5000);
      vi.advanceTimersByTime(30 * 60 * 1000); // 30min

      const removed = cleanupExpiredEntries();

      expect(removed).toBe(0);
    });

    it('should return 0 when map is empty', () => {
      expect(cleanupExpiredEntries()).toBe(0);
    });
  });
});

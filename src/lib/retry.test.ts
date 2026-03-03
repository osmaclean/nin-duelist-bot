import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('lib/retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 'test');
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, 'test', 2, 1);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'));

    await expect(withRetry(fn, 'test', 1, 1)).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  it('should log warnings on each retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(fn, 'my-op', 2, 1);

    const { logger } = await import('./logger');
    expect(logger.warn).toHaveBeenCalledWith(
      'Retry 1/2 para my-op',
      expect.objectContaining({ error: 'Error: fail' }),
    );
  });
});

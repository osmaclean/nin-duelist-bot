import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('lib/logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('info should call console.log with JSON containing level and msg', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test message', { key: 'value' });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test message');
    expect(parsed.key).toBe('value');
    expect(parsed.time).toBeDefined();
  });

  it('warn should call console.warn with JSON', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('warning');

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.msg).toBe('warning');
  });

  it('error should call console.error with JSON', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('fail', { error: 'something broke' });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    expect(parsed.msg).toBe('fail');
    expect(parsed.error).toBe('something broke');
  });

  it('info without context should emit only level, msg, time', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('simple');

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(Object.keys(parsed).sort()).toEqual(['level', 'msg', 'time']);
  });
});

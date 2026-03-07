import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('lib/ops-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should send alert via webhook when OPS_WEBHOOK_URL is set', async () => {
    vi.doMock('../config', () => ({
      OPS_WEBHOOK_URL: 'https://discord.com/api/webhooks/test',
    }));

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const { sendOpsAlert } = await import('./ops-webhook');
    await sendOpsAlert('Test Alert', 'Something broke', 'error');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://discord.com/api/webhooks/test');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.embeds[0].title).toBe('Test Alert');
    expect(body.embeds[0].description).toBe('Something broke');
    expect(body.embeds[0].color).toBe(0xff0000);

    vi.unstubAllGlobals();
  });

  it('should use orange color for warn level', async () => {
    vi.doMock('../config', () => ({
      OPS_WEBHOOK_URL: 'https://discord.com/api/webhooks/test',
    }));

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const { sendOpsAlert } = await import('./ops-webhook');
    await sendOpsAlert('Warning', 'Minor issue', 'warn');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].color).toBe(0xffa500);

    vi.unstubAllGlobals();
  });

  it('should do nothing when OPS_WEBHOOK_URL is not set', async () => {
    vi.doMock('../config', () => ({
      OPS_WEBHOOK_URL: undefined,
    }));

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const { sendOpsAlert } = await import('./ops-webhook');
    await sendOpsAlert('Test', 'Nothing');

    expect(mockFetch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('should log error and not throw when fetch fails', async () => {
    vi.doMock('../config', () => ({
      OPS_WEBHOOK_URL: 'https://discord.com/api/webhooks/test',
    }));

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const { sendOpsAlert } = await import('./ops-webhook');
    const { logger } = await import('./logger');

    await expect(sendOpsAlert('Fail', 'Error')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Falha ao enviar alerta ops', expect.any(Object));

    vi.unstubAllGlobals();
  });
});

import { describe, expect, it, vi } from 'vitest';

describe('config', () => {
  it('should export env values and static constants', async () => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = 'token-x';
    process.env.DISCORD_CLIENT_ID = 'client-x';
    process.env.DISCORD_GUILD_ID = 'guild-x';
    process.env.DATABASE_URL = 'postgresql://localhost/test';

    const mod = await import('./config');

    expect(mod.DISCORD_TOKEN).toBe('token-x');
    expect(mod.DISCORD_CLIENT_ID).toBe('client-x');
    expect(mod.DISCORD_GUILD_ID).toBe('guild-x');
    expect(mod.SEASON_DURATION_DAYS).toBe(30);
    expect(mod.DUEL_EXPIRY_MS).toBe(30 * 60 * 1000);
    expect(mod.EXPIRE_CHECK_INTERVAL_MS).toBe(60 * 1000);
    expect(mod.SEASON_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(mod.RANK_PAGE_SIZE).toBe(20);
    expect(mod.POINTS_WIN).toBe(1);
    expect(mod.POINTS_LOSS).toBe(-1);
  });

  it('should throw if DISCORD_TOKEN is missing', async () => {
    vi.resetModules();
    delete process.env.DISCORD_TOKEN;
    process.env.DISCORD_CLIENT_ID = 'client-x';
    process.env.DATABASE_URL = 'postgresql://localhost/test';

    await expect(import('./config')).rejects.toThrow('DISCORD_TOKEN');
  });

  it('should throw if DATABASE_URL is missing', async () => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = 'token-x';
    process.env.DISCORD_CLIENT_ID = 'client-x';
    delete process.env.DATABASE_URL;

    await expect(import('./config')).rejects.toThrow('DATABASE_URL');
  });

  it('should default DISCORD_GUILD_ID to empty string when not set', async () => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = 'token-x';
    process.env.DISCORD_CLIENT_ID = 'client-x';
    delete process.env.DISCORD_GUILD_ID;
    process.env.DATABASE_URL = 'postgresql://localhost/test';

    const mod = await import('./config');

    expect(mod.DISCORD_GUILD_ID).toBe('');
  });
});

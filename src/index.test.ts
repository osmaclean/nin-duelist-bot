import { describe, expect, it, vi } from 'vitest';

describe('index', () => {
  it('should bootstrap client, register events and login', async () => {
    vi.resetModules();

    const clientInstance = { login: vi.fn(), destroy: vi.fn() };
    const Client = vi.fn(() => clientInstance);
    const registerReadyEvent = vi.fn();
    const registerInteractionEvent = vi.fn();

    vi.doMock('discord.js', () => ({
      Client,
      GatewayIntentBits: { Guilds: 123 },
    }));
    vi.doMock('./config', () => ({
      DISCORD_TOKEN: 'discord-token',
    }));
    vi.doMock('./events/ready', () => ({
      registerReadyEvent,
    }));
    vi.doMock('./events/interactionCreate', () => ({
      registerInteractionEvent,
    }));
    vi.doMock('./lib/prisma', () => ({
      prisma: { $disconnect: vi.fn() },
    }));
    vi.doMock('./lib/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    await import('./index');

    expect(Client).toHaveBeenCalledWith({ intents: [123] });
    expect(registerReadyEvent).toHaveBeenCalledWith(clientInstance);
    expect(registerInteractionEvent).toHaveBeenCalledWith(clientInstance);
    expect(clientInstance.login).toHaveBeenCalledWith('discord-token');
  });
});

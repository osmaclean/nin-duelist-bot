import { describe, expect, it, vi } from 'vitest';

class FakeOptionBuilder {
  private data: any = {};
  setName(name: string) {
    this.data.name = name;
    return this;
  }
  setDescription(description: string) {
    this.data.description = description;
    return this;
  }
  setRequired(required: boolean) {
    this.data.required = required;
    return this;
  }
  setMinValue(min: number) {
    this.data.min = min;
    return this;
  }
  addChoices(...choices: Array<{ name: string; value: string }>) {
    this.data.choices = choices;
    return this;
  }
  toJSON() {
    return this.data;
  }
}

class FakeSlashCommandBuilder {
  private data: any = { options: [] as any[] };
  setName(name: string) {
    this.data.name = name;
    return this;
  }
  setDescription(description: string) {
    this.data.description = description;
    return this;
  }
  addUserOption(cb: (o: FakeOptionBuilder) => FakeOptionBuilder) {
    this.data.options.push(cb(new FakeOptionBuilder()).toJSON());
    return this;
  }
  addStringOption(cb: (o: FakeOptionBuilder) => FakeOptionBuilder) {
    this.data.options.push(cb(new FakeOptionBuilder()).toJSON());
    return this;
  }
  addIntegerOption(cb: (o: FakeOptionBuilder) => FakeOptionBuilder) {
    this.data.options.push(cb(new FakeOptionBuilder()).toJSON());
    return this;
  }
  addSubcommand(cb: (o: FakeSlashCommandBuilder) => FakeSlashCommandBuilder) {
    this.data.options.push(cb(new FakeSlashCommandBuilder()).toJSON());
    return this;
  }
  toJSON() {
    return this.data;
  }
}

describe('deploy-commands', () => {
  it('should deploy guild commands when DISCORD_GUILD_ID is set', async () => {
    vi.resetModules();
    const put = vi.fn().mockResolvedValue(undefined);
    const setToken = vi.fn().mockReturnThis();
    const REST = vi.fn(() => ({ setToken, put }));
    const Routes = {
      applicationGuildCommands: vi.fn(() => 'guild-route'),
      applicationCommands: vi.fn(() => 'global-route'),
    };

    vi.doMock('discord.js', () => ({
      REST,
      Routes,
      SlashCommandBuilder: FakeSlashCommandBuilder,
    }));
    vi.doMock('./config', () => ({
      DISCORD_TOKEN: 'token',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_GUILD_ID: 'guild-id',
    }));
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    vi.doMock('./lib/logger', () => ({ logger: mockLogger }));

    await import('./deploy-commands');
    await Promise.resolve();

    expect(REST).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenCalledWith('token');
    expect(Routes.applicationGuildCommands).toHaveBeenCalledWith('client-id', 'guild-id');
    expect(put).toHaveBeenCalledWith(
      'guild-route',
      expect.objectContaining({ body: expect.any(Array) }),
    );
    const body = put.mock.calls[0][1].body;
    expect(body).toHaveLength(8);
    expect(body.map((c: any) => c.name)).toEqual(['duel', 'rank', 'mvp', 'pending', 'history', 'profile', 'h2h', 'admin']);
    expect(mockLogger.info).toHaveBeenCalledWith('Registrando slash commands');
  });

  it('should deploy global commands when DISCORD_GUILD_ID is empty', async () => {
    vi.resetModules();
    const put = vi.fn().mockResolvedValue(undefined);
    const setToken = vi.fn().mockReturnThis();
    const REST = vi.fn(() => ({ setToken, put }));
    const Routes = {
      applicationGuildCommands: vi.fn(() => 'guild-route'),
      applicationCommands: vi.fn(() => 'global-route'),
    };

    vi.doMock('discord.js', () => ({
      REST,
      Routes,
      SlashCommandBuilder: FakeSlashCommandBuilder,
    }));
    vi.doMock('./config', () => ({
      DISCORD_TOKEN: 'token',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_GUILD_ID: '',
    }));
    vi.doMock('./lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

    await import('./deploy-commands');
    await Promise.resolve();

    expect(Routes.applicationCommands).toHaveBeenCalledWith('client-id');
    expect(put).toHaveBeenCalledWith(
      'global-route',
      expect.objectContaining({ body: expect.any(Array) }),
    );
  });

  it('should catch and log errors from main', async () => {
    vi.resetModules();
    const err = new Error('deploy failed');
    const put = vi.fn().mockRejectedValue(err);
    const setToken = vi.fn().mockReturnThis();
    const REST = vi.fn(() => ({ setToken, put }));
    const Routes = {
      applicationGuildCommands: vi.fn(() => 'guild-route'),
      applicationCommands: vi.fn(() => 'global-route'),
    };

    vi.doMock('discord.js', () => ({
      REST,
      Routes,
      SlashCommandBuilder: FakeSlashCommandBuilder,
    }));
    vi.doMock('./config', () => ({
      DISCORD_TOKEN: 'token',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_GUILD_ID: 'guild-id',
    }));
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    vi.doMock('./lib/logger', () => ({ logger: mockLogger }));

    await import('./deploy-commands');
    await Promise.resolve();

    expect(mockLogger.error).toHaveBeenCalled();
  });
});

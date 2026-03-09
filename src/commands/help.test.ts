import { describe, expect, it, vi } from 'vitest';
import { handleHelpCommand } from './help';

function interaction() {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('commands/help', () => {
  it('should reply with ephemeral embed containing guide', async () => {
    const i = interaction();

    await handleHelpCommand(i);

    expect(i.reply).toHaveBeenCalledOnce();
    const call = i.reply.mock.calls[0][0];
    expect(call.ephemeral).toBe(true);
    expect(call.embeds).toHaveLength(1);

    const embed = call.embeds[0].toJSON();
    expect(embed.title).toBe('NinDuelist — Guia Rápido');
    expect(embed.description).toContain('duelos ranqueados');
    expect(embed.fields).toBeDefined();

    const fieldNames = embed.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('⚔️ Como funciona um duelo');
    expect(fieldNames).toContain('🔗 Documentação completa');

    const docsField = embed.fields.find((f: any) => f.name === '🔗 Documentação completa');
    expect(docsField.value).toContain('ninduelist.vercel.app');
  });
});

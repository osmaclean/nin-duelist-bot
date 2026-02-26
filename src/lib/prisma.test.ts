import { describe, expect, it, vi } from 'vitest';

describe('lib/prisma', () => {
  it('should create and export a PrismaClient instance', async () => {
    vi.resetModules();
    const ctor = vi.fn(() => ({ __tag: 'mock-prisma-client' }));

    vi.doMock('@prisma/client', () => ({
      PrismaClient: ctor,
    }));

    const mod = await import('./prisma');

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(mod.prisma).toEqual({ __tag: 'mock-prisma-client' });
  });
});

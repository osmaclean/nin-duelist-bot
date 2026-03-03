import { describe, expect, it } from 'vitest';
import { buildDuelEmbed, buildMvpEmbed, buildRankEmbed } from './embeds';

function duelBase(extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'PROPOSED',
    format: 'MD3',
    challenger: { discordId: '111' },
    opponent: { discordId: '222' },
    witness: { discordId: '333' },
    winner: null,
    opponentAccepted: false,
    witnessAccepted: false,
    scoreWinner: null,
    scoreLoser: null,
    createdAt: new Date('2026-02-26T10:00:00.000Z'),
    ...extra,
  } as any;
}

describe('lib/embeds', () => {
  it('buildDuelEmbed should include base fields and acceptance details for PROPOSED', () => {
    const embed = buildDuelEmbed(
      duelBase({
        opponentAccepted: true,
      }),
    );
    const json = embed.toJSON();

    expect(json.title).toBe('Duelo');
    expect(json.footer?.text).toBe('Duelo #1');
    expect(json.timestamp).toBe('2026-02-26T10:00:00.000Z');

    const acceptance = (json.fields ?? []).find((f) => f.name === 'Aceitação');
    expect(acceptance?.value).toBe('Oponente: Aceito');
  });

  it('buildDuelEmbed should include score when winner and score are present', () => {
    const embed = buildDuelEmbed(
      duelBase({
        status: 'CONFIRMED',
        winner: { discordId: '111' },
        scoreWinner: 2,
        scoreLoser: 1,
      }),
    );
    const json = embed.toJSON();
    const score = (json.fields ?? []).find((f) => f.name === 'Placar');

    expect(score?.value).toBe('<@111> venceu 2-1');
  });

  it('buildDuelEmbed should render MD1 format label', () => {
    const embed = buildDuelEmbed(
      duelBase({
        format: 'MD1',
      }),
    ).toJSON();

    const formatField = (embed.fields ?? []).find((f) => f.name === 'Formato');
    expect(formatField?.value).toBe('Melhor de 1');
  });

  it('buildDuelEmbed should show opponent pending in PROPOSED', () => {
    const embed = buildDuelEmbed(
      duelBase({
        status: 'PROPOSED',
        opponentAccepted: false,
      }),
    ).toJSON();

    const acceptance = (embed.fields ?? []).find((f) => f.name === 'Aceitação');
    expect(acceptance?.value).toBe('Oponente: Pendente');
  });

  it('buildDuelEmbed should not include score when winner is missing', () => {
    const embed = buildDuelEmbed(
      duelBase({
        status: 'AWAITING_VALIDATION',
        winner: null,
        scoreWinner: 2,
        scoreLoser: 1,
      }),
    );
    const json = embed.toJSON();
    const score = (json.fields ?? []).find((f) => f.name === 'Placar');

    expect(score).toBeUndefined();
  });

  it('buildRankEmbed should render ranked lines and footer', () => {
    const embed = buildRankEmbed(
      3,
      [
        {
          player: { discordId: '11' } as any,
          points: 10,
          wins: 6,
          losses: 1,
          streak: 4,
          peakStreak: 5,
        },
        {
          player: { discordId: '22' } as any,
          points: 8,
          wins: 5,
          losses: 2,
          streak: 2,
          peakStreak: 3,
        },
      ],
      2,
      4,
      21,
    );
    const json = embed.toJSON();

    expect(json.title).toBe('Ranking — Season 3');
    expect(json.footer?.text).toBe('Página 2/4');
    expect(json.description).toContain('<@11> — 10pts | 6V 1D | Streak: 4 (max 5)');
    expect(json.description).toContain('**22.** <@22> — 8pts | 5V 2D | Streak: 2 (max 3)');
  });

  it('buildRankEmbed should render top-3 branch (rank <= 3)', () => {
    const embed = buildRankEmbed(
      1,
      [
        {
          player: { discordId: '101' } as any,
          points: 3,
          wins: 3,
          losses: 0,
          streak: 3,
          peakStreak: 3,
        },
      ],
      1,
      1,
      1,
    ).toJSON();

    expect(embed.description).toContain('<@101> — 3pts | 3V 0D | Streak: 3 (max 3)');
  });

  it('buildRankEmbed should show empty state message', () => {
    const embed = buildRankEmbed(1, [], 1, 1, 1).toJSON();
    expect(embed.description).toBe('Nenhum jogador nesta season ainda.');
  });

  it('buildMvpEmbed should render top lines and empty state', () => {
    const nonEmpty = buildMvpEmbed(9, [
      {
        player: { discordId: '99' } as any,
        points: 20,
        wins: 10,
        losses: 0,
        streak: 10,
        peakStreak: 10,
      },
    ]).toJSON();
    const empty = buildMvpEmbed(9, []).toJSON();

    expect(nonEmpty.title).toBe('MVP — Season 9');
    expect(nonEmpty.description).toContain('<@99> — 20pts | 10V 0D | Peak Streak: 10');
    expect(empty.description).toBe('Nenhum jogador nesta season ainda.');
  });

  it('buildMvpEmbed should render fallback medal for index >= 5', () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      player: { discordId: `${i + 1}` } as any,
      points: 10 - i,
      wins: 10 - i,
      losses: i,
      streak: 0,
      peakStreak: 0,
    }));

    const embed = buildMvpEmbed(2, entries).toJSON();
    expect(embed.description).toContain('6. <@6> — 5pts | 5V 5D | Peak Streak: 0');
  });
});

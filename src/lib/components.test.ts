import { describe, expect, it } from 'vitest';
import { buildDuelComponents } from './components';

function duel(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    status,
    opponentAccepted: false,
    witnessAccepted: false,
    ...extra,
  } as any;
}

function buttonLabels(components: any[]) {
  return components.flatMap((row: any) =>
    row.components.map((b: any) => b.data.label),
  );
}

describe('lib/components', () => {
  it('PROPOSED with nobody accepted shows 3 buttons', () => {
    const result = buildDuelComponents(duel('PROPOSED'));
    expect(buttonLabels(result)).toEqual(['Aceitar Duelo', 'Aceitar (Testemunha)', 'Cancelar']);
  });

  it('PROPOSED with opponent accepted shows witness + cancel', () => {
    const result = buildDuelComponents(duel('PROPOSED', { opponentAccepted: true }));
    expect(buttonLabels(result)).toEqual(['Aceitar (Testemunha)', 'Cancelar']);
  });

  it('PROPOSED with witness accepted shows accept duel + cancel', () => {
    const result = buildDuelComponents(duel('PROPOSED', { witnessAccepted: true }));
    expect(buttonLabels(result)).toEqual(['Aceitar Duelo', 'Cancelar']);
  });

  it('ACCEPTED shows start + cancel', () => {
    const result = buildDuelComponents(duel('ACCEPTED'));
    expect(buttonLabels(result)).toEqual(['Iniciar Duelo', 'Cancelar']);
  });

  it('IN_PROGRESS shows submit + cancel', () => {
    const result = buildDuelComponents(duel('IN_PROGRESS'));
    expect(buttonLabels(result)).toEqual(['Enviar Resultado', 'Cancelar']);
  });

  it('AWAITING_VALIDATION shows confirm + reject', () => {
    const result = buildDuelComponents(duel('AWAITING_VALIDATION'));
    expect(buttonLabels(result)).toEqual(['Confirmar Resultado', 'Rejeitar Resultado']);
  });

  it('CONFIRMED returns no components', () => {
    expect(buildDuelComponents(duel('CONFIRMED'))).toEqual([]);
  });

  it('CANCELLED returns no components', () => {
    expect(buildDuelComponents(duel('CANCELLED'))).toEqual([]);
  });

  it('EXPIRED returns no components', () => {
    expect(buildDuelComponents(duel('EXPIRED'))).toEqual([]);
  });

  it('uses correct duel id in customIds', () => {
    const result = buildDuelComponents({ id: 42, status: 'ACCEPTED', opponentAccepted: true, witnessAccepted: true } as any);
    const customIds = result.flatMap((row: any) =>
      row.components.map((b: any) => b.data.custom_id),
    );
    expect(customIds).toEqual(['start-duel:42', 'cancel-duel:42']);
  });
});

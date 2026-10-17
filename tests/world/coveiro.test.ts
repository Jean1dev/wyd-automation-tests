import { describe, expect, it } from 'vitest';
import {
  ARENA_ENTRY, ARENA_SAFE_SPOT, ARENA_SPAWNS, INTRUDER_PROBE, isInCoveiroArea, NPC, resetDeadline, ROUTE_TO_ARMIA, ROUTE_TO_COVEIRO,
} from '../../src/world/coveiro.ts';

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('arena do Coveiro (2379,2076)–(2426,2133)', () => {
  it('comparação estrita, como guardQuest256Areas', () => {
    expect(isInCoveiroArea(2380, 2077)).toBe(true);
    expect(isInCoveiroArea(2425, 2132)).toBe(true);
    expect(isInCoveiroArea(2379, 2100)).toBe(false);
    expect(isInCoveiroArea(2400, 2133)).toBe(false);
  });

  it('o destino do teleporte (2398,2105)+rand(5)−3 cai sempre dentro', () => {
    for (let dx = -3; dx <= 1; dx++) for (let dy = -3; dy <= 1; dy++) expect(isInCoveiroArea(ARENA_ENTRY.x + dx, ARENA_ENTRY.y + dy)).toBe(true);
  });

  it('NPCs e rotas ficam fora da arena; o canto seguro e o ponto do intruso, dentro', () => {
    for (const n of Object.values(NPC)) {
      expect(isInCoveiroArea(n.pos.x, n.pos.y)).toBe(false);
      expect(isInCoveiroArea(n.stand.x, n.stand.y)).toBe(false);
    }
    for (const p of [...ROUTE_TO_COVEIRO, ...ROUTE_TO_ARMIA, INTRUDER_PROBE.from]) expect(isInCoveiroArea(p.x, p.y)).toBe(false);
    expect(isInCoveiroArea(ARENA_SAFE_SPOT.x, ARENA_SAFE_SPOT.y)).toBe(true);
    expect(isInCoveiroArea(INTRUDER_PROBE.to.x, INTRUDER_PROBE.to.y)).toBe(true);
  });

  it('canto seguro fora do alcance de aggro (4) de um mob que anda até 3 do spawn', () => {
    expect(Math.min(...ARENA_SPAWNS.map((s) => cheb(s, ARENA_SAFE_SPOT)))).toBeGreaterThan(3 + 4);
  });
});

describe('janela de espera do reset', () => {
  it('cobre o ciclo de 10 min do legado e a próxima hh:00', () => {
    const at = (iso: string) => Date.parse(iso);
    // Entrada às 22:20 → espera até 23:02 (virada da hora + 2 min).
    expect(new Date(resetDeadline(at('2026-10-16T22:20:00Z'))).toISOString()).toBe('2026-10-16T23:02:00.000Z');
    // Entrada às 22:55 → 23:02 viria antes de 10 min: espera até 23:07.
    expect(new Date(resetDeadline(at('2026-10-16T22:55:00Z'))).toISOString()).toBe('2026-10-16T23:07:00.000Z');
  });
});

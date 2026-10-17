import { describe, expect, it } from 'vitest';
import { nextStat, BUILDS, ALL_STR } from '../../src/bot/build.ts';
import { isInArea, isOutOfAggro, safeSpot, STEPS, TK_GEAR } from '../../src/world/quest256.ts';

describe('Quest 256, passos 2–5', () => {
  it('faixas de nível encadeadas como em quest256Steps (misc.go:852)', () => {
    expect(STEPS.map((s) => [s.step, s.level.min, s.level.max])).toEqual([[2, 115, 190], [3, 190, 265], [4, 265, 320], [5, 320, 350]]);
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i].level.min).toBe(STEPS[i - 1].level.max);
  });

  it('entrada e spawns dentro da arena; NPC e início do controle de intruso fora', () => {
    for (const s of STEPS) {
      expect(isInArea(s.area, s.entry.x, s.entry.y), `entrada do passo ${s.step}`).toBe(true);
      for (const p of s.spawns) expect(isInArea(s.area, p.x, p.y), `spawn ${p.x},${p.y} do passo ${s.step}`).toBe(true);
      expect(isInArea(s.area, s.npc.pos.x, s.npc.pos.y)).toBe(false);
      expect(isInArea(s.area, s.npc.stand.x, s.npc.stand.y)).toBe(false);
      expect(isInArea(s.area, s.intruder.from.x, s.intruder.from.y)).toBe(false);
      expect(isInArea(s.area, s.intruder.to.x, s.intruder.to.y)).toBe(true);
    }
  });

  it('ponto seguro dentro da arena e o mais longe possível dos spawns', () => {
    for (const s of STEPS) {
      const p = safeSpot(s);
      expect(isInArea(s.area, p.x, p.y)).toBe(true);
      expect(p.margin).toBeGreaterThanOrEqual(5);
    }
    // A arena do Coveiro dá margem 11 (coveiro.ts ARENA_SAFE_SPOT); as maiores daqui ficam longe do aggro.
    expect(STEPS.filter((s) => isOutOfAggro(safeSpot(s).margin)).map((s) => s.step).length).toBeGreaterThan(0);
  });

  it('o ticket certo nunca está entre os errados', () => {
    for (const s of STEPS) expect(s.wrongTickets).not.toContain(s.ticket);
  });

  it('equipamento do TK cabe no nível máximo da cadeia', () => {
    for (const g of TK_GEAR) expect(g.req.level).toBeLessThan(350);
  });
});

describe('build de atributos', () => {
  const a = (str: number, dex: number, con: number, int = 10) => ({ str, dex, con, int });

  it('cumpre primeiro o requisito do equipamento', () => {
    expect(nextStat(a(100, 96, 300), BUILDS[0], { str: 132, dex: 96 })).toBe('str');
    expect(nextStat(a(200, 50, 300), BUILDS[0], { str: 132, dex: 96 })).toBe('dex');
  });

  it('TK: segue as frações até os tetos de Con 600 e Dex 400, e o resto vai para Str', () => {
    expect(nextStat(a(10, 10, 10), BUILDS[0])).toBe('str');
    expect(nextStat(a(600, 10, 200), BUILDS[0])).toBe('dex');
    expect(nextStat(a(2000, 400, 600), BUILDS[0])).toBe('str');
  });

  it('tudo em Str para os cenários 1 a 3', () => {
    expect(nextStat(a(500, 10, 10), ALL_STR)).toBe('str');
  });
});

describe('Arch', () => {
  it('corpo do Arch = rosto do mortal + 5 + classe (DBSrv _MSG_DBCreateArchCharacter)', async () => {
    const { archFace, MORTAL_FACE } = await import('../../src/world/arch.ts');
    expect(archFace(MORTAL_FACE[0], 2)).toBe(8); // TK mortal → BM Arch
    expect([0, 1, 2, 3].map((c) => archFace(1, c))).toEqual([6, 7, 8, 9]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BLACK_MAGIC, BM_MAGIC, BM_SUMMON, BM_TRANSFORM, buffGain, HT_T1, HT_T2, HT_T3, cumulativePoints, summonCount, transformScore, healAmount, judgmentHp, learnBit, learnLevel, manaCost, masteryCapAt, skillIn, skillPointsAt, SPECIAL_MAGIC, WHITE_MAGIC,
} from '../../src/world/skillTrees.ts';

describe('árvores de skills da Foema', () => {
  it('Magia Branca = 24–31 (bits 0–7), Magia Negra = 32–39 (bits 8–15)', () => {
    expect(WHITE_MAGIC.skills.map((s) => s.id)).toEqual([24, 25, 26, 27, 28, 29, 30, 31]);
    expect(BLACK_MAGIC.skills.map((s) => s.id)).toEqual([32, 33, 34, 35, 36, 37, 38, 39]);
    expect(WHITE_MAGIC.skills.reduce((m, s) => m | learnBit(s.id), 0)).toBe(0xff);
    expect(BLACK_MAGIC.skills.reduce((m, s) => m | learnBit(s.id), 0)).toBe(0xff00);
  });

  it('custo de MP = BASE_GetManaSpent (combat/skill.go ManaSpent)', () => {
    expect(manaCost(10, 0)).toBe(10); // skill_test.go: 500 − ManaSpent(10, 0, 0) = 490
    expect(manaCost(85, 190)).toBe(165);
    expect(manaCost(75, 148, 10)).toBe(Math.trunc((90 * Math.trunc((75 * 174) / 100)) / 100));
  });

  it('pontos e teto de maestria por nível armazenado', () => {
    expect(skillPointsAt(219)).toBe(677);
    expect(cumulativePoints(BLACK_MAGIC, 39)).toBe(677);
    expect(cumulativePoints(WHITE_MAGIC, 31)).toBe(677);
    expect(masteryCapAt(75)).toBe(114);
    expect(masteryCapAt(300)).toBe(200);
  });

  it('nível armazenado em que cada skill fica disponível, na ordem da árvore', () => {
    expect(BLACK_MAGIC.skills.map((s) => learnLevel(BLACK_MAGIC, s.id))).toEqual([6, 23, 46, 70, 94, 124, 151, 219]);
    expect(WHITE_MAGIC.skills.map((s) => learnLevel(WHITE_MAGIC, s.id))).toEqual([4, 19, 40, 56, 82, 98, 132, 219]);
    expect(SPECIAL_MAGIC.skills.map((s) => learnLevel(SPECIAL_MAGIC, s.id))).toEqual([8, 21, 39, 60, 85, 109, 140, 219]);
    expect(cumulativePoints(SPECIAL_MAGIC, 47)).toBe(677);
    expect(SPECIAL_MAGIC.skills.reduce((m, s) => m | learnBit(s.id), 0)).toBe(0xff0000);
  });

  it('ganho dos buffs da Magia Especial (BASE_GetCurrentScore)', () => {
    expect(buffGain(2, 1, 0)).toBe(1);
    expect(buffGain(11, 15, 60)).toBe(35);
    expect(buffGain(9, 90, 60)).toBe(157); // (15 + 90) × 3/2
    expect(buffGain(9, 90, 60, 1 << 19)).toBe(471); // ×3 com o Escudo Mágico aprendido
    expect(buffGain(15, 7, 76)).toBe(14);
  });

  it('cura de mortal (_MSG_Attack.cpp:624-645): Cura 2×Special + 100, Recuperar 3×Special/2 + 150, teto 1100', () => {
    expect(healAmount(skillIn(WHITE_MAGIC, 27), 0)).toBe(100);
    expect(healAmount(skillIn(WHITE_MAGIC, 27), 180)).toBe(460);
    expect(healAmount(skillIn(WHITE_MAGIC, 29), 102)).toBe(303);
    expect(healAmount(skillIn(WHITE_MAGIC, 27), 600)).toBe(1100);
  });

  it('Julgamento Divino deixa a Foema com HP/6 + 1 a cada alvo', () => {
    expect(judgmentHp(600, 1)).toBe(101);
    expect(judgmentHp(600, 2)).toBe(17);
  });

  it('BeastMaster: bits, pontos e nível de cada skill', () => {
    expect([BM_MAGIC, BM_SUMMON, BM_TRANSFORM].map((t) => t.skills.reduce((m, k) => m | learnBit(k.id), 0))).toEqual([0xff, 0xff00, 0xff0000]);
    expect(BM_MAGIC.skills.map((k) => learnLevel(BM_MAGIC, k.id))).toEqual([8, 20, 43, 58, 83, 109, 139, 219]);
    expect(BM_SUMMON.skills.map((k) => learnLevel(BM_SUMMON, k.id))).toEqual([11, 28, 52, 76, 104, 135, 169, 232]);
    expect(BM_TRANSFORM.skills.map((k) => learnLevel(BM_TRANSFORM, k.id))).toEqual([11, 26, 48, 63, 96, 111, 155, 219]);
  });

  it('evocação: Special[2]/30, /40 ou /80 bichos (_MSG_Attack.cpp:818-828)', () => {
    expect([summonCount(1, 29), summonCount(1, 30), summonCount(4, 86), summonCount(6, 166), summonCount(8, 0)]).toEqual([0, 1, 2, 2, 1]);
  });

  it('transformação: AC×multi/100 do legado (Basedef.cpp:4180-4196)', () => {
    // Lobo sem a passiva, Level 0: multi 95; o legado trunca 49×95/100 = 46 (+5 do Lobo).
    expect(transformScore(1, 0, 0, { ac: 49, maxHp: 145, run: 2 })).toEqual({ ac: 51, maxHp: 137, run: 3 });
    // Com Coração de Lobo (bit 17): +3 de AC e +5 de HP no multiplicador.
    expect(transformScore(1, 0, 0x20000, { ac: 100, maxHp: 200, run: 2 })).toEqual({ ac: 103, maxHp: 200, run: 3 });
    // Titã, Level 200: AC 110+15 → 125+10.
    expect(transformScore(4, 200, 0, { ac: 100, maxHp: 100, run: 6 })).toEqual({ ac: 135, maxHp: 115, run: 6 });
  });

  it('Huntress: bits, pontos e nível de cada skill (a árvore 3 soma 680: a 8ª só no nível 220)', () => {
    expect([HT_T1, HT_T2, HT_T3].map((t) => t.skills.reduce((m, k) => m | learnBit(k.id), 0))).toEqual([0xff, 0xff00, 0xff0000]);
    expect(HT_T1.skills.map((k) => learnLevel(HT_T1, k.id))).toEqual([7, 20, 42, 59, 87, 116, 148, 219]);
    expect(HT_T2.skills.map((k) => learnLevel(HT_T2, k.id))).toEqual([6, 19, 42, 60, 88, 118, 145, 219]);
    expect(HT_T3.skills.map((k) => learnLevel(HT_T3, k.id))).toEqual([8, 22, 39, 62, 87, 117, 149, 220]);
  });

  it('Meditação e "Escudo Dourado" (affects 21 e 31) mexem na AC', () => {
    expect(buffGain(21, 15, 123)).toBe(-51);
    expect(buffGain(31, 150, 82)).toBe(191);
  });
});

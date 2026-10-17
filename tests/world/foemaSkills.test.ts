import { describe, expect, it } from 'vitest';
import {
  BLACK_MAGIC, cumulativePoints, healAmount, judgmentHp, learnBit, learnLevel, manaCost, masteryCapAt, skillIn, skillPointsAt, WHITE_MAGIC,
} from '../../src/world/foemaSkills.ts';

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
});

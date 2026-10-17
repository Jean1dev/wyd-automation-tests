import { describe, expect, it } from 'vitest';
import { BLACK_SKILLS, cumulativePoints, learnBit, learnLevel, manaCost, masteryCapAt, skillPointsAt } from '../../src/world/foemaBlackMagic.ts';

describe('Magia Negra da Foema', () => {
  it('as skills 32–39 são os bits 8–15 do LearnedSkill', () => {
    expect(BLACK_SKILLS.map((s) => s.id)).toEqual([32, 33, 34, 35, 36, 37, 38, 39]);
    expect(BLACK_SKILLS.reduce((m, s) => m | learnBit(s.id), 0)).toBe(0xff00);
  });

  it('custo de MP = BASE_GetManaSpent (combat/skill.go ManaSpent)', () => {
    expect(manaCost(10, 0)).toBe(10); // skill_test.go: 500 − ManaSpent(10, 0, 0) = 490
    expect(manaCost(85, 190)).toBe(165);
    expect(manaCost(75, 148, 10)).toBe(Math.trunc((90 * Math.trunc((75 * 174) / 100)) / 100));
  });

  it('pontos e teto de maestria por nível armazenado', () => {
    expect(skillPointsAt(219)).toBe(677);
    expect(cumulativePoints(39)).toBe(677);
    expect(masteryCapAt(75)).toBe(114);
    expect(masteryCapAt(300)).toBe(200);
  });

  it('nível armazenado em que cada skill fica disponível, na ordem da árvore', () => {
    expect(BLACK_SKILLS.map((s) => learnLevel(s.id))).toEqual([6, 23, 46, 70, 94, 124, 151, 219]);
  });
});
